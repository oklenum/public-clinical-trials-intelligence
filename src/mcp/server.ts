import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import http from "node:http";
import { performance } from "node:perf_hooks";

import { getToolList, loadToolSchemas } from "./toolSchemas.js";
import {
  tool_aggregate_trials,
  tool_compare_trials,
  tool_get_trial,
  tool_get_trial_details,
  tool_get_trial_endpoints,
  tool_search_pubmed,
  tool_search_trials,
} from "../dataAdapter.js";
import type { Err } from "../adapters/http.js";
import { formatToolInvocationLogLine, summarizeToolResultForLog } from "../utils/toolLogging.js";

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
  const startedAt = performance.now();

  if (!Object.prototype.hasOwnProperty.call(schemas.tools, toolName)) {
    const durationMs = performance.now() - startedAt;
    console.error(
      formatToolInvocationLogLine({
        toolName,
        args: request.params.arguments ?? {},
        durationMs,
        resultBytes: 0,
        resultSummary: "error code=UNKNOWN_TOOL",
      }),
    );
    return {
      isError: true,
      content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
    };
  }

  const args = (request.params.arguments ?? {}) as any;

  try {
    const output =
      toolName === "search_trials"
        ? await tool_search_trials(args)
        : toolName === "get_trial"
          ? await tool_get_trial(args)
          : toolName === "get_trial_details"
            ? await tool_get_trial_details(args)
            : toolName === "get_trial_endpoints"
              ? await tool_get_trial_endpoints(args)
              : toolName === "compare_trials"
                ? await tool_compare_trials(args)
                : toolName === "aggregate_trials"
                  ? await tool_aggregate_trials(args)
                  : toolName === "search_pubmed"
                    ? await tool_search_pubmed(args)
                    : ({
                        ok: false,
                        error: { code: "INTERNAL_ERROR", retryable: false, context: { tool: toolName } },
                      } satisfies Err);

    const responseText = JSON.stringify(output);
    const durationMs = performance.now() - startedAt;
    const resultBytes = Buffer.byteLength(responseText, "utf8");
    console.error(
      formatToolInvocationLogLine({
        toolName,
        args,
        durationMs,
        resultBytes,
        resultSummary: summarizeToolResultForLog(output),
      }),
    );

    return {
      isError: false,
      content: [{ type: "text", text: responseText }],
    };
  } catch (error) {
    const fallback: Err = {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        retryable: false,
        context: { error: error instanceof Error ? error.message : String(error), tool: toolName },
      },
    };

    const responseText = JSON.stringify(fallback);
    const durationMs = performance.now() - startedAt;
    const resultBytes = Buffer.byteLength(responseText, "utf8");
    console.error(
      formatToolInvocationLogLine({
        toolName,
        args,
        durationMs,
        resultBytes,
        resultSummary: summarizeToolResultForLog(fallback),
      }),
    );

    return {
      isError: false,
      content: [{ type: "text", text: responseText }],
    };
  }
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
