import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";

import { loadToolSchemas } from "../../src/mcp/toolSchemas.js";
import { createToolArgumentsValidator } from "../../src/mcp/toolArgumentValidation.js";

test("rejects missing required properties", async () => {
  const { schemas } = await loadToolSchemas({ schemasPath: path.resolve(process.cwd(), "mcp_tool_schemas.json") });
  const validate = createToolArgumentsValidator(schemas);

  const result = validate("get_trial", {});
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "INVALID_ARGUMENTS");
  assert.ok(result.error.issues.some((issue) => issue.path === "/nct_id"));
});

test("rejects invalid scalar types", async () => {
  const { schemas } = await loadToolSchemas({ schemasPath: path.resolve(process.cwd(), "mcp_tool_schemas.json") });
  const validate = createToolArgumentsValidator(schemas);

  const result = validate("search_trials", "nope");
  assert.equal(result.ok, false);
  assert.ok(result.error.issues.some((issue) => issue.path === "/"));
});

test("rejects invalid patterns in $ref'd defs", async () => {
  const { schemas } = await loadToolSchemas({ schemasPath: path.resolve(process.cwd(), "mcp_tool_schemas.json") });
  const validate = createToolArgumentsValidator(schemas);

  const result = validate("get_trial", { nct_id: "not-an-nct" });
  assert.equal(result.ok, false);
  assert.ok(result.error.issues.some((issue) => issue.path === "/nct_id"));
});

test("rejects unexpected additionalProperties", async () => {
  const { schemas } = await loadToolSchemas({ schemasPath: path.resolve(process.cwd(), "mcp_tool_schemas.json") });
  const validate = createToolArgumentsValidator(schemas);

  const result = validate("search_trials", { filters: {}, extra: 1 });
  assert.equal(result.ok, false);
  assert.ok(result.error.issues.some((issue) => issue.path === "/extra"));
});

