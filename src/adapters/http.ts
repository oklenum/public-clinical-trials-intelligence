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

export async function fetchJson<T = unknown>(
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

