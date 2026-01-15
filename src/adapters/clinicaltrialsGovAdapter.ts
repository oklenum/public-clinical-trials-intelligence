import { fetchJson, type Err, type Ok } from "./http.js";
import {
  normalizeFullTrialRecordFromStudy,
  normalizeTrialSummaryFromStudy,
  type FullTrialRecord,
  type TrialSummary,
} from "./clinicaltrialsGovNormalize.js";

const API_BASE = "https://clinicaltrials.gov/api/v2";

export type TrialsSortField =
  | "RELEVANCE"
  | "LAST_UPDATE_POSTED"
  | "FIRST_POSTED"
  | "START_DATE"
  | "PRIMARY_COMPLETION_DATE"
  | "COMPLETION_DATE";

export type SortDirection = "ASC" | "DESC";

export type TrialsSort = { field: TrialsSortField; direction: SortDirection };

export type OverallStatus =
  | "NOT_YET_RECRUITING"
  | "RECRUITING"
  | "ENROLLING_BY_INVITATION"
  | "ACTIVE_NOT_RECRUITING"
  | "SUSPENDED"
  | "TERMINATED"
  | "WITHDRAWN"
  | "COMPLETED"
  | "UNKNOWN_STATUS";

export type Phase =
  | "EARLY_PHASE_1"
  | "PHASE_1"
  | "PHASE_1_2"
  | "PHASE_2"
  | "PHASE_2_3"
  | "PHASE_3"
  | "PHASE_4"
  | "NOT_APPLICABLE";

export type StudyType = "INTERVENTIONAL" | "OBSERVATIONAL" | "EXPANDED_ACCESS";

export type TrialsFilters = {
  indication?: string;
  query_term?: string;
  phases?: Phase[];
  overall_statuses?: OverallStatus[];
  study_type?: StudyType;
  sponsor_or_collaborator?: string;
  countries?: string[];
  first_posted_from?: string;
  first_posted_to?: string;
  last_update_posted_from?: string;
  last_update_posted_to?: string;
};

export type SearchTrialsInput = {
  filters: TrialsFilters;
  page_size?: number;
  page_token?: string;
  sort?: TrialsSort;
  include_fields?: string[];
};

export type SearchTrialsOutput = Ok<{
  trials: TrialSummary[];
  page: { page_size: number; next_page_token?: string };
}> | Err;

export type GetTrialInput = { nct_id: string };
export type GetTrialOutput = Ok<{ trial: FullTrialRecord }> | Err;

function buildQueryTerm(filters: TrialsFilters | undefined): string {
  const parts: string[] = [];
  const base = filters?.query_term ?? filters?.indication;
  if (typeof base === "string" && base.trim()) parts.push(base.trim());

  const phases = Array.isArray(filters?.phases) ? filters.phases : [];
  if (phases.length) {
    const phaseTokens = phases
      .flatMap((p) => {
        switch (p) {
          case "EARLY_PHASE_1":
            return ["EARLY_PHASE1"];
          case "PHASE_1":
            return ["PHASE1"];
          case "PHASE_1_2":
            return ["PHASE1", "PHASE2"];
          case "PHASE_2":
            return ["PHASE2"];
          case "PHASE_2_3":
            return ["PHASE2", "PHASE3"];
          case "PHASE_3":
            return ["PHASE3"];
          case "PHASE_4":
            return ["PHASE4"];
          case "NOT_APPLICABLE":
            return ["NA"];
          default:
            return [];
        }
      })
      .filter(Boolean);
    if (phaseTokens.length) {
      parts.push(`(${phaseTokens.map((t) => `AREA[Phase]${t}`).join(" OR ")})`);
    }
  }

  const statuses = Array.isArray(filters?.overall_statuses) ? filters.overall_statuses : [];
  if (statuses.length) {
    parts.push(`(${statuses.map((s) => `AREA[OverallStatus]${s}`).join(" OR ")})`);
  }

  if (typeof filters?.study_type === "string" && filters.study_type) {
    parts.push(`AREA[StudyType]${filters.study_type}`);
  }

  if (typeof filters?.sponsor_or_collaborator === "string" && filters.sponsor_or_collaborator.trim()) {
    parts.push(filters.sponsor_or_collaborator.trim());
  }

  // Note: date ranges and country filters are intentionally omitted here; the adapter
  // remains a thin access layer and only uses stable, validated query primitives.

  return parts.join(" AND ");
}

function mapSort(sort: TrialsSort | undefined): string | undefined {
  if (!sort) return undefined;
  const direction = sort.direction === "ASC" ? "asc" : sort.direction === "DESC" ? "desc" : undefined;
  if (!direction) return undefined;

  const fieldMap: Partial<Record<TrialsSortField, string>> = {
    LAST_UPDATE_POSTED: "LastUpdatePostDate",
    FIRST_POSTED: "StudyFirstPostDate",
    START_DATE: "StartDate",
    PRIMARY_COMPLETION_DATE: "PrimaryCompletionDate",
    COMPLETION_DATE: "CompletionDate",
  };
  const field = fieldMap[sort.field];
  if (!field) return undefined;
  return `${field}:${direction}`;
}

export async function searchTrials(input: SearchTrialsInput, { timeoutMs }: { timeoutMs?: number } = {}): Promise<SearchTrialsOutput> {
  try {
    const queryTerm = buildQueryTerm(input?.filters);
    if (!queryTerm) {
      return { ok: false, error: { code: "INVALID_ARGUMENT", retryable: false } };
    }

    const pageSize = Number.isInteger(input?.page_size) ? (input.page_size as number) : 25;
    const url = new URL(`${API_BASE}/studies`);
    url.searchParams.set("query.term", queryTerm);
    url.searchParams.set("pageSize", String(Math.min(Math.max(pageSize, 1), 100)));

    if (typeof input?.page_token === "string" && input.page_token.trim()) {
      url.searchParams.set("pageToken", input.page_token.trim());
    }

    const sortParam = mapSort(input?.sort);
    if (sortParam) url.searchParams.set("sort", sortParam);

    const result = await fetchJson<{ studies?: unknown[]; nextPageToken?: unknown }>(url.toString(), {
      timeoutMs,
      upstream: { service: "CLINICALTRIALS_GOV" },
    });
    if (!result.ok) return result;

    const studies = Array.isArray(result.data?.studies) ? result.data.studies : [];
    const trials = studies.map(normalizeTrialSummaryFromStudy).filter(Boolean) as TrialSummary[];

    const nextPageToken =
      typeof result.data?.nextPageToken === "string" && result.data.nextPageToken.trim()
        ? result.data.nextPageToken
        : undefined;

    return {
      ok: true,
      data: {
        trials,
        page: {
          page_size: Math.min(Math.max(pageSize, 1), 100),
          ...(nextPageToken ? { next_page_token: nextPageToken } : {}),
        },
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        retryable: false,
        context: { error: error instanceof Error ? error.message : String(error) },
      },
    };
  }
}

export async function getTrial(input: GetTrialInput, { timeoutMs }: { timeoutMs?: number } = {}): Promise<GetTrialOutput> {
  try {
    const nctId = typeof input?.nct_id === "string" ? input.nct_id.trim() : "";
    if (!/^NCT\d{8}$/.test(nctId)) {
      return { ok: false, error: { code: "INVALID_ARGUMENT", retryable: false } };
    }

    const url = `${API_BASE}/studies/${encodeURIComponent(nctId)}`;
    const result = await fetchJson<unknown>(url, { timeoutMs, upstream: { service: "CLINICALTRIALS_GOV" } });
    if (!result.ok) return result;

    const trial = normalizeFullTrialRecordFromStudy(result.data);
    if (!trial) {
      return {
        ok: false,
        error: {
          code: "UPSTREAM_ERROR",
          retryable: true,
          upstream: { service: "CLINICALTRIALS_GOV", endpoint: url },
          context: { reason: "Normalization returned empty record" },
        },
      };
    }

    return { ok: true, data: { trial } };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        retryable: false,
        context: { error: error instanceof Error ? error.message : String(error) },
      },
    };
  }
}

