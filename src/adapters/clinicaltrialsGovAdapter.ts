import { fetchJson, type Err, type Ok } from "./http.js";
import {
  normalizeFullTrialRecordFromStudy,
  normalizeTrialSummaryFromStudy,
  type FullTrialRecord,
  type TrialSummary,
} from "./clinicaltrialsGovNormalize.js";

const API_BASE = "https://clinicaltrials.gov/api/v2";
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const DEFAULT_SORT: TrialsSort = { field: "LAST_UPDATE_POSTED", direction: "DESC" };

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
  start_date_from?: string;
  start_date_to?: string;
  primary_completion_date_from?: string;
  primary_completion_date_to?: string;
  completion_date_from?: string;
  completion_date_to?: string;
};

export type SearchTrialsInput = {
  filters: TrialsFilters;
  page_size?: number;
  page_token?: string;
  sort?: TrialsSort;
  include_fields?: TrialIncludeField[];
};

export type SearchTrialsOutput = Ok<{
  trials: TrialSummary[];
  page: { page_size: number; next_page_token?: string };
}> | Err;

export type GetTrialInput = { nct_id: string };
export type GetTrialOutput = Ok<{ trial: FullTrialRecord }> | Err;

export type TrialIncludeField =
  | "NCT_ID"
  | "BRIEF_TITLE"
  | "OFFICIAL_TITLE"
  | "ACRONYM"
  | "OVERALL_STATUS"
  | "PHASES"
  | "STUDY_TYPE"
  | "ENROLLMENT"
  | "SPONSORS"
  | "CONDITIONS"
  | "INTERVENTIONS"
  | "COUNTRIES"
  | "FIRST_POSTED"
  | "LAST_UPDATE_POSTED"
  | "START_DATE"
  | "PRIMARY_COMPLETION_DATE"
  | "COMPLETION_DATE";

const DEFAULT_INCLUDE_FIELDS: TrialIncludeField[] = [
  "NCT_ID",
  "BRIEF_TITLE",
  "OVERALL_STATUS",
  "PHASES",
  "STUDY_TYPE",
  "ENROLLMENT",
  "SPONSORS",
  "CONDITIONS",
  "INTERVENTIONS",
  "FIRST_POSTED",
  "LAST_UPDATE_POSTED",
  "START_DATE",
  "PRIMARY_COMPLETION_DATE",
  "COMPLETION_DATE",
];

const INCLUDE_FIELD_TO_CT_FIELDS: Record<TrialIncludeField, string[]> = {
  NCT_ID: ["protocolSection.identificationModule.nctId"],
  BRIEF_TITLE: ["protocolSection.identificationModule.briefTitle"],
  OFFICIAL_TITLE: ["protocolSection.identificationModule.officialTitle"],
  ACRONYM: ["protocolSection.identificationModule.acronym"],
  OVERALL_STATUS: ["protocolSection.statusModule.overallStatus"],
  PHASES: ["protocolSection.designModule.phases"],
  STUDY_TYPE: ["protocolSection.designModule.studyType"],
  ENROLLMENT: ["protocolSection.designModule.enrollmentInfo"],
  SPONSORS: [
    "protocolSection.sponsorCollaboratorsModule.leadSponsor",
    "protocolSection.sponsorCollaboratorsModule.collaborators",
  ],
  CONDITIONS: ["protocolSection.conditionsModule.conditions"],
  INTERVENTIONS: [
    "protocolSection.armsInterventionsModule.interventions.name",
    "protocolSection.armsInterventionsModule.armGroups.interventionNames",
  ],
  COUNTRIES: ["protocolSection.contactsLocationsModule.locations.country"],
  FIRST_POSTED: ["protocolSection.statusModule.studyFirstPostDateStruct.date"],
  LAST_UPDATE_POSTED: ["protocolSection.statusModule.lastUpdatePostDateStruct.date"],
  START_DATE: ["protocolSection.statusModule.startDateStruct.date"],
  PRIMARY_COMPLETION_DATE: ["protocolSection.statusModule.primaryCompletionDateStruct.date"],
  COMPLETION_DATE: ["protocolSection.statusModule.completionDateStruct.date"],
};

function normalizeCountry(code: string | undefined): string | undefined {
  if (typeof code !== "string") return undefined;
  const trimmed = code.trim();
  if (!trimmed) return undefined;
  return trimmed.toUpperCase();
}

function normalizeTerm(term: string | undefined): string | undefined {
  if (typeof term !== "string") return undefined;
  const trimmed = term.trim();
  return trimmed || undefined;
}

function asRange(from?: string, to?: string): string | undefined {
  const start = normalizeTerm(from);
  const end = normalizeTerm(to);
  if (!start && !end) return undefined;
  return `RANGE[${start ?? ""},${end ?? ""}]`;
}

type BuiltQueryTerm = { term: string; rejected: boolean };

function buildQueryTerm(filters: TrialsFilters | undefined): BuiltQueryTerm {
  const parts: string[] = [];
  const userTerm = normalizeTerm(filters?.query_term);
  if (userTerm) parts.push(userTerm);

  const phases = Array.isArray(filters?.phases) ? filters.phases : [];
  if (phases.length > 20) return { term: "", rejected: true };
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
  if (statuses.length > 20) return { term: "", rejected: true };
  if (statuses.length) {
    parts.push(`(${statuses.map((s) => `AREA[OverallStatus]${s}`).join(" OR ")})`);
  }

  if (typeof filters?.study_type === "string" && filters.study_type) {
    parts.push(`AREA[StudyType]${filters.study_type}`);
  }

  const sponsor = normalizeTerm(filters?.sponsor_or_collaborator);
  if (sponsor) {
    parts.push(`AREA[SponsorCollaborators]${sponsor}`);
  }

  const lastUpdateRange = asRange(filters?.last_update_posted_from, filters?.last_update_posted_to);
  if (lastUpdateRange) parts.push(`AREA[LastUpdatePostDate]${lastUpdateRange}`);

  const firstPostedRange = asRange(filters?.first_posted_from, filters?.first_posted_to);
  if (firstPostedRange) parts.push(`AREA[StudyFirstPostDate]${firstPostedRange}`);

  const startDateRange = asRange(filters?.start_date_from, filters?.start_date_to);
  if (startDateRange) parts.push(`AREA[StartDate]${startDateRange}`);

  const primaryCompletionRange = asRange(filters?.primary_completion_date_from, filters?.primary_completion_date_to);
  if (primaryCompletionRange) parts.push(`AREA[PrimaryCompletionDate]${primaryCompletionRange}`);

  const completionRange = asRange(filters?.completion_date_from, filters?.completion_date_to);
  if (completionRange) parts.push(`AREA[CompletionDate]${completionRange}`);

  const countries = Array.isArray(filters?.countries)
    ? filters.countries.map((c) => normalizeCountry(c)).filter(Boolean)
    : [];
  if (countries.length > 50) return { term: "", rejected: true };
  if (countries.length) {
    parts.push(`(${countries.map((c) => `AREA[LocationCountry]${c}`).join(" OR ")})`);
  }

  return { term: parts.join(" AND "), rejected: false };
}

function mapSort(sort: TrialsSort | undefined): string | undefined {
  if (!sort) return undefined;
  if (sort.field === "RELEVANCE") return undefined;
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
    const indication = typeof input?.filters?.indication === "string" ? input.filters.indication.trim() : "";
    const { term: queryTerm, rejected } = buildQueryTerm(input?.filters);
    if (rejected || (!indication && !queryTerm)) {
      return { ok: false, error: { code: "INVALID_ARGUMENT", retryable: false } };
    }

    const pageSize = Number.isInteger(input?.page_size) ? (input.page_size as number) : DEFAULT_PAGE_SIZE;
    const url = new URL(`${API_BASE}/studies`);
    if (indication) url.searchParams.set("query.cond", indication);
    if (queryTerm) url.searchParams.set("query.term", queryTerm);
    url.searchParams.set("pageSize", String(Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE)));

    if (typeof input?.page_token === "string" && input.page_token.trim()) {
      url.searchParams.set("pageToken", input.page_token.trim());
    }

    const sortParam = mapSort(input?.sort) ?? mapSort(DEFAULT_SORT);
    if (sortParam) url.searchParams.set("sort", sortParam);

    const includeFields =
      Array.isArray(input?.include_fields) && input.include_fields.length ? input.include_fields : DEFAULT_INCLUDE_FIELDS;
    const ctFields = new Set<string>();
    for (const field of ["NCT_ID", ...includeFields] as TrialIncludeField[]) {
      for (const ctField of INCLUDE_FIELD_TO_CT_FIELDS[field] ?? []) ctFields.add(ctField);
    }
    if (ctFields.size) url.searchParams.set("fields", Array.from(ctFields).join(","));

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
          page_size: Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE),
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
