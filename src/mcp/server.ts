import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import http from "node:http";

import { getToolList, loadToolSchemas } from "./toolSchemas.js";

const { schemas } = await loadToolSchemas();

const server = new Server(
  { name: "public-clinical-trials-intelligence", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: getToolList(schemas) };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;

  if (!Object.prototype.hasOwnProperty.call(schemas.tools, toolName)) {
    return {
      isError: true,
      content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
    };
  }

  return {
    isError: true,
    content: [{ type: "text", text: `Tool '${toolName}' is registered but not implemented.` }],
  };
});

async function startStdio() {
  await server.connect(new StdioServerTransport());
}

async function startStreamableHttp() {
  const requestedPort = Number(process.env.MCP_HTTP_PORT ?? "3333");
  const host = process.env.MCP_HTTP_HOST ?? "127.0.0.1";
  const routePath = process.env.MCP_HTTP_PATH ?? "/mcp";

  if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) {
    throw new Error(`Invalid MCP_HTTP_PORT: ${process.env.MCP_HTTP_PORT ?? ""}`);
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await server.connect(transport);

  let actualPort = requestedPort;

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (url.pathname !== routePath) {
      res.statusCode = 404;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    try {
      let parsedBody: unknown = undefined;

      if (req.method === "POST") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const bodyText = Buffer.concat(chunks).toString("utf8").trim();
        parsedBody = bodyText.length ? JSON.parse(bodyText) : undefined;
      }

      await transport.handleRequest(req, res, parsedBody);
    } catch (error) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: (error as Error).message ?? String(error) }));
    }
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(requestedPort, host, () => {
      const address = httpServer.address();
      if (address && typeof address === "object") actualPort = address.port;
      resolve();
    });
  });

  const shutdown = async () => {
    await transport.close();
    await server.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  };

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());

  console.error(`MCP Streamable HTTP listening on http://${host}:${actualPort}${routePath}`);
}

try {
  const transport = (process.env.MCP_TRANSPORT ?? "stdio").toLowerCase();

  if (transport === "streamable-http" || transport === "http") {
    await startStreamableHttp();
  } else {
    await startStdio();
  }
} catch (error) {
  console.error(error);
  process.exit(1);
}
