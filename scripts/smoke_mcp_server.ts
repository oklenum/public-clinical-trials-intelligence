import path from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const serverPath = path.resolve(process.cwd(), "dist/src/mcp/server.js");

const env = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
);

const transport = new StdioClientTransport({
  command: "node",
  args: [serverPath],
  env,
});

const client = new Client(
  { name: "pcti-smoke", version: "0.0.0" },
  { capabilities: {} },
);

await client.connect(transport);
const { tools } = await client.listTools();

console.log(tools.map((t) => t.name).sort());

await client.close();
