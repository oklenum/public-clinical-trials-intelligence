const REDACT_KEY_RE = /(^|_)(api_?key|token|secret|password|auth|authorization|cookie|session)(_|$)/i;

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeStringForLog(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function summarizeValue(
  value: unknown,
  {
    depth,
    maxDepth,
    maxArrayItems,
    maxObjectKeys,
  }: { depth: number; maxDepth: number; maxArrayItems: number; maxObjectKeys: number },
): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = normalizeStringForLog(value);
    if (normalized.length <= 120) return normalized;
    return `<string len=${normalized.length}>`;
  }

  if (Array.isArray(value)) {
    const len = value.length;
    if (depth >= maxDepth) return `<array len=${len}>`;
    const head = value
      .slice(0, maxArrayItems)
      .map((v) => summarizeValue(v, { depth: depth + 1, maxDepth, maxArrayItems, maxObjectKeys }));
    return len > maxArrayItems ? [...head, `<… +${len - maxArrayItems} items>`] : head;
  }

  if (!isPlainObject(value)) return `<${Object.prototype.toString.call(value)}>`;

  const keys = Object.keys(value);
  if (depth >= maxDepth) return `<object keys=${keys.length}>`;

  keys.sort();
  const out: Record<string, unknown> = {};
  const limitedKeys = keys.slice(0, maxObjectKeys);
  for (const key of limitedKeys) {
    if (REDACT_KEY_RE.test(key)) {
      out[key] = "<redacted>";
      continue;
    }
    out[key] = summarizeValue((value as Record<string, unknown>)[key], {
      depth: depth + 1,
      maxDepth,
      maxArrayItems,
      maxObjectKeys,
    });
  }

  if (keys.length > maxObjectKeys) {
    out["<…>"] = `+${keys.length - maxObjectKeys} keys`;
  }

  return out;
}

export function summarizeArgsForLog(args: unknown): string {
  try {
    const summary = summarizeValue(args, { depth: 0, maxDepth: 4, maxArrayItems: 10, maxObjectKeys: 30 });
    const text = JSON.stringify(summary);
    if (text.length <= 900) return text;
    return `${text.slice(0, 900)}…`;
  } catch {
    return "<unserializable args>";
  }
}

export function summarizeToolResultForLog(output: unknown): string {
  try {
    if (!isPlainObject(output)) return "result=<non-object>";
    const ok = (output as Record<string, unknown>).ok;
    if (ok === true) {
      const data = (output as Record<string, unknown>).data;
      if (!isPlainObject(data)) return "ok";
      const d = data as Record<string, unknown>;
      if (Array.isArray(d.trials)) return `ok trials=${d.trials.length}`;
      if (isPlainObject(d.trial)) return "ok trial=1";
      if (Array.isArray(d.citations)) return `ok citations=${d.citations.length}`;
      if (Array.isArray(d.groups)) return `ok groups=${d.groups.length}`;
      if (Array.isArray(d.comparisons)) return `ok comparisons=${d.comparisons.length}`;
      if (Array.isArray(d.outcomes)) return `ok outcomes=${d.outcomes.length}`;
      return `ok keys=${Object.keys(d).length}`;
    }

    if (ok === false) {
      const error = (output as Record<string, unknown>).error;
      if (!isPlainObject(error)) return "error";
      const e = error as Record<string, unknown>;
      const code = typeof e.code === "string" ? e.code : "UNKNOWN";
      const httpStatus = typeof e.http_status === "number" ? e.http_status : undefined;
      const upstreamService = isPlainObject(e.upstream) && typeof e.upstream.service === "string" ? String(e.upstream.service) : undefined;
      const parts = [
        `error code=${code}`,
        ...(typeof httpStatus === "number" ? [`http=${httpStatus}`] : []),
        ...(upstreamService ? [`upstream=${upstreamService}`] : []),
      ];
      return parts.join(" ");
    }

    return "result=<unknown shape>";
  } catch {
    return "result=<unserializable>";
  }
}

export function formatToolInvocationLogLine({
  toolName,
  args,
  durationMs,
  resultBytes,
  resultSummary,
}: {
  toolName: string;
  args: unknown;
  durationMs: number;
  resultBytes: number;
  resultSummary: string;
}): string {
  const ms = clamp(durationMs, 0, 24 * 60 * 60 * 1000);
  return `[tool] name=${toolName} ms=${ms.toFixed(1)} result_bytes=${resultBytes} ${resultSummary} args=${summarizeArgsForLog(args)}`;
}
