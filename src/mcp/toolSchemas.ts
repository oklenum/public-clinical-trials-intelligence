import fs from "node:fs/promises";
import path from "node:path";

type ToolSchemaDef = {
  description: string;
  input_schema: unknown;
  output_schema?: unknown;
};

export type ToolSchemasFile = {
  schema_version?: string;
  tools: Record<string, ToolSchemaDef>;
};

export async function loadToolSchemas(options?: { schemasPath?: string }) {
  const schemasPath =
    options?.schemasPath ??
    process.env.MCP_TOOL_SCHEMAS_PATH ??
    path.resolve(process.cwd(), "mcp_tool_schemas.json");

  const parsed = JSON.parse(await fs.readFile(schemasPath, "utf8")) as ToolSchemasFile;

  if (!parsed || typeof parsed !== "object" || !parsed.tools || typeof parsed.tools !== "object") {
    throw new Error(`Invalid tool schemas file at ${schemasPath}`);
  }

  return { schemasPath, schemas: parsed };
}

export function getToolList(schemas: ToolSchemasFile) {
  return Object.entries(schemas.tools).map(([name, def]) => ({
    name,
    description: def.description,
    inputSchema: def.input_schema,
  }));
}

