import AjvModule from "ajv";
import type { ErrorObject, ValidateFunction } from "ajv";
import addFormats from "ajv-formats";

import type { ToolSchemasFile } from "./toolSchemas.js";

type ValidationOk = { ok: true; value: unknown };
type ValidationErr = {
  ok: false;
  error: {
    code: "INVALID_ARGUMENTS";
    message: string;
    issues: Array<{ path: string; message: string }>;
  };
};

function formatAjvIssues(errors: ErrorObject[] | null | undefined): Array<{ path: string; message: string }> {
  if (!errors?.length) return [{ path: "/", message: "Invalid arguments." }];

  return errors.map((err) => {
    const basePath = err.instancePath?.length ? err.instancePath : "";
    let path = basePath.length ? basePath : "/";

    const params = err.params as Record<string, unknown> | undefined;
    if (err.keyword === "required" && typeof params?.missingProperty === "string") {
      path = `${basePath}/${params.missingProperty}`.replace(/^\/\//, "/") || "/";
    }
    if (err.keyword === "additionalProperties" && typeof params?.additionalProperty === "string") {
      path = `${basePath}/${params.additionalProperty}`.replace(/^\/\//, "/") || "/";
    }

    const keywordSuffix = err.keyword ? ` (${err.keyword})` : "";
    let message = err.message ? `${err.message}${keywordSuffix}` : `Invalid value${keywordSuffix}`;
    if (err.keyword === "enum" && Array.isArray(params?.allowedValues)) {
      message = `${message}; allowed: ${params.allowedValues.map(String).join(", ")}`;
    }

    return { path, message };
  });
}

function schemaForToolInput(schemas: ToolSchemasFile, toolName: string): unknown {
  const tool = schemas.tools[toolName];
  const input = tool?.input_schema;

  if (!input || typeof input !== "object") return input;

  const defs = schemas.$defs;
  if (!defs || typeof defs !== "object") return input;

  // Tool input schemas reference `#/$defs/*` from the root schema file, so
  // we inline `$defs` here to make those refs resolvable when compiling the tool schema.
  return { ...(input as Record<string, unknown>), $defs: defs };
}

export function createToolArgumentsValidator(schemas: ToolSchemasFile) {
  const AjvCtor = ((AjvModule as unknown as { default?: unknown }).default ?? AjvModule) as any;
  const ajv = new AjvCtor({
    allErrors: true,
    allowUnionTypes: true,
    strict: false,
    validateFormats: true,
  });
  const addFormatsFn = ((addFormats as unknown as { default?: unknown }).default ?? addFormats) as any;
  addFormatsFn(ajv);

  const validators = new Map<string, ValidateFunction>();

  for (const toolName of Object.keys(schemas.tools)) {
    const schema = schemaForToolInput(schemas, toolName);
    validators.set(toolName, ajv.compile(schema as any));
  }

  return function validateToolArguments(toolName: string, args: unknown): ValidationOk | ValidationErr {
    const validate = validators.get(toolName);
    if (!validate) {
      return {
        ok: false,
        error: {
          code: "INVALID_ARGUMENTS",
          message: `Invalid arguments for tool '${toolName}': unknown tool schema`,
          issues: [{ path: "/", message: "Unknown tool schema." }],
        },
      };
    }

    const valid = validate(args);
    if (valid) return { ok: true, value: args };

    const issues = formatAjvIssues(validate.errors);
    const message =
      issues.length === 1
        ? `Invalid arguments for tool '${toolName}': ${issues[0]?.path} ${issues[0]?.message}`
        : `Invalid arguments for tool '${toolName}': ${issues.length} validation errors`;

    return {
      ok: false,
      error: {
        code: "INVALID_ARGUMENTS",
        message,
        issues,
      },
    };
  };
}
