import { spawn } from "node:child_process";
import path from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const serverPath = path.resolve(process.cwd(), "dist/src/mcp/server.js");

const server = spawn("node", [serverPath], {
  env: {
    ...process.env,
    MCP_TRANSPORT: "streamable-http",
    MCP_HTTP_HOST: "127.0.0.1",
    MCP_HTTP_PORT: "0",
    MCP_HTTP_PATH: "/mcp",
  },
  stdio: ["ignore", "inherit", "pipe"],
});

const serverUrl = await new Promise<URL>((resolve, reject) => {
  const timeout = setTimeout(() => {
    server.kill("SIGTERM");
    reject(new Error("Timed out waiting for MCP HTTP server to start"));
  }, 10_000);
  server.once("error", (err) => {
    clearTimeout(timeout);
    reject(err);
  });
  server.once("exit", (code, signal) => {
    clearTimeout(timeout);
    reject(new Error(`MCP HTTP server exited before ready (code=${code ?? "null"} signal=${signal ?? "null"})`));
  });
  server.stderr.setEncoding("utf8");
  let stderrBuffer = "";
  server.stderr.on("data", (chunk: string) => {
    stderrBuffer += chunk;
    process.stderr.write(chunk);
    const match = stderrBuffer.match(/MCP Streamable HTTP listening on (http:\/\/\S+)/);
    if (match?.[1]) {
      clearTimeout(timeout);
      resolve(new URL(match[1]));
    }
  });
});

const transport = new StreamableHTTPClientTransport(serverUrl);
const client = new Client({ name: "pcti-smoke-http", version: "0.0.0" }, { capabilities: {} });

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  console.log(tools.map((t) => t.name).sort());
} finally {
  await client.close();
  server.kill("SIGTERM");
}
