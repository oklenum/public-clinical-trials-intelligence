import { TtlCache } from "../utils/ttlCache.js";

export type UpstreamService = "CLINICALTRIALS_GOV" | "PUBMED";

export type ErrorCode =
  | "INVALID_ARGUMENT"
  | "NOT_FOUND"
  | "UPSTREAM_ERROR"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "INTERNAL_ERROR";

export type ToolError = {
  code: ErrorCode;
  retryable: boolean;
  http_status?: number;
  upstream?: {
    service: UpstreamService;
    endpoint: string;
  };
  context?: Record<string, unknown>;
};

export type Ok<T> = { ok: true; data: T };
export type Err = { ok: false; error: ToolError };

export type FetchJsonOptions = {
  timeoutMs?: number;
  headers?: Record<string, string>;
  upstream?: {
    service: UpstreamService;
  };
};

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

const ENV: Record<string, string | undefined> =
  (
    globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env ?? {};

const DEFAULT_CACHE_TTL_MS = 5 * 60_000;
const CACHE_TTL_MS = parsePositiveInt(ENV.DEMO_CACHE_TTL_MS) ?? DEFAULT_CACHE_TTL_MS;
const CACHE_DISABLED = ENV.DEMO_CACHE_DISABLE === "1" || ENV.DEMO_CACHE_DISABLE === "true";
const CACHE_DEBUG = ENV.DEMO_CACHE_DEBUG === "1" || ENV.DEMO_CACHE_DEBUG === "true";

type CachedOk = Ok<unknown>;
const responseCache = new TtlCache<string, CachedOk>({ defaultTtlMs: CACHE_TTL_MS });
const inFlight = new Map<string, Promise<Ok<unknown> | Err>>();

function stableHeaderPairs(headers: Record<string, string> | undefined): [string, string][] {
  const pairs = Object.entries(headers ?? {})
    .map(([k, v]) => [k.toLowerCase(), String(v)] as [string, string])
    .filter(([k, v]) => k.trim() && v.trim());

  pairs.sort(([aKey, aValue], [bKey, bValue]) =>
    aKey === bKey ? aValue.localeCompare(bValue) : aKey.localeCompare(bKey),
  );
  return pairs;
}

function canonicalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pairs: [string, string][] = [];
    parsed.searchParams.forEach((value, key) => pairs.push([key, value]));
    pairs.sort(([aKey, aValue], [bKey, bValue]) =>
      aKey === bKey ? aValue.localeCompare(bValue) : aKey.localeCompare(bKey),
    );
    parsed.search = "";
    for (const [k, v] of pairs) parsed.searchParams.append(k, v);
    return parsed.toString();
  } catch {
    return url;
  }
}

function requestSignature(url: string, headers: Record<string, string> | undefined, upstream: UpstreamService): string {
  // Signature must be deterministic across equivalent calls.
  return JSON.stringify({
    url: canonicalizeUrl(url),
    upstream,
    headers: stableHeaderPairs({ accept: "application/json", ...(headers ?? {}) }),
  });
}

export function clearFetchJsonCache(): void {
  responseCache.clear();
  inFlight.clear();
}

export function getFetchJsonCacheStatus(): {
  disabled: boolean;
  ttlMs: number;
  entries: number;
  inFlight: number;
  stats: { hits: number; misses: number; sets: number; evictions: number };
} {
  return {
    disabled: CACHE_DISABLED,
    ttlMs: CACHE_TTL_MS,
    entries: responseCache.size,
    inFlight: inFlight.size,
    stats: { ...responseCache.stats },
  };
}

async function fetchJsonUncached<T = unknown>(
  url: string,
  { timeoutMs = 15_000, headers, upstream = { service: "CLINICALTRIALS_GOV" } }: FetchJsonOptions = {},
): Promise<Ok<T> | Err> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        ...(headers ?? {}),
      },
      signal: controller.signal,
    });

    const bodyText = await response.text();
    const contentType = response.headers.get("content-type") ?? "";

    if (!response.ok) {
      const code: ErrorCode =
        response.status === 400 || response.status === 422
          ? "INVALID_ARGUMENT"
          : response.status === 404
            ? "NOT_FOUND"
            : response.status === 429
              ? "RATE_LIMITED"
              : response.status >= 500
                ? "UPSTREAM_ERROR"
                : "UPSTREAM_ERROR";

      return {
        ok: false,
        error: {
          code,
          retryable: code !== "INVALID_ARGUMENT" && (response.status === 429 || response.status >= 500),
          http_status: response.status,
          upstream: {
            service: upstream.service,
            endpoint: url,
          },
          context: {
            content_type: contentType,
            body: bodyText.slice(0, 2_000),
          },
        },
      };
    }

    if (!contentType.toLowerCase().includes("application/json")) {
      return {
        ok: false,
        error: {
          code: "UPSTREAM_ERROR",
          retryable: true,
          http_status: response.status,
          upstream: {
            service: upstream.service,
            endpoint: url,
          },
          context: {
            content_type: contentType,
            body: bodyText.slice(0, 2_000),
          },
        },
      };
    }

    try {
      return { ok: true, data: JSON.parse(bodyText) as T };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "UPSTREAM_ERROR",
          retryable: true,
          http_status: response.status,
          upstream: {
            service: upstream.service,
            endpoint: url,
          },
          context: {
            parse_error: error instanceof Error ? error.message : String(error),
            body: bodyText.slice(0, 2_000),
          },
        },
      };
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        ok: false,
        error: {
          code: "TIMEOUT",
          retryable: true,
          upstream: { service: upstream.service, endpoint: url },
        },
      };
    }

    return {
      ok: false,
      error: {
        code: "UPSTREAM_ERROR",
        retryable: true,
        upstream: { service: upstream.service, endpoint: url },
        context: {
          error: error instanceof Error ? error.message : String(error),
        },
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchJson<T = unknown>(
  url: string,
  { timeoutMs = 15_000, headers, upstream = { service: "CLINICALTRIALS_GOV" } }: FetchJsonOptions = {},
): Promise<Ok<T> | Err> {
  if (CACHE_DISABLED) {
    return await fetchJsonUncached<T>(url, { timeoutMs, headers, upstream });
  }

  const key = requestSignature(url, headers, upstream.service);
  const cached = responseCache.get(key);
  if (cached) {
    if (CACHE_DEBUG) console.log(`[cache hit] ${upstream.service} ${url}`);
    return cached as Ok<T>;
  }

  const existing = inFlight.get(key);
  if (existing) {
    if (CACHE_DEBUG) console.log(`[cache coalesce] ${upstream.service} ${url}`);
    return (await existing) as Ok<T> | Err;
  }

  const promise = (async (): Promise<Ok<unknown> | Err> => {
    try {
      return await fetchJsonUncached<unknown>(url, { timeoutMs, headers, upstream });
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  const result = await promise;
  if (result.ok) responseCache.set(key, result);
  return result as Ok<T> | Err;
}
