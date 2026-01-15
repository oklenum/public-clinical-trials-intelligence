import { getTrial, searchTrials, type GetTrialInput, type SearchTrialsInput, type TrialIncludeField } from "./adapters/clinicaltrialsGovAdapter.js";
import type { FullTrialRecord } from "./adapters/clinicaltrialsGovNormalize.js";
import { searchPubmed, type SearchPubmedInput, type SearchPubmedOutput } from "./adapters/pubmedAdapter.js";
import type { Err, Ok } from "./adapters/http.js";

const NCT_ID_RE = /^NCT\d{8}$/;
const MAX_AGG_TRIALS = 500;
const AGG_PAGE_SIZE = 100;

export type ToolOutput<T> = Ok<T> | Err;

export async function tool_search_trials(input: SearchTrialsInput): Promise<ToolOutput<{ trials: unknown[]; page: unknown }>> {
  return await searchTrials(input);
}

export async function tool_get_trial(input: GetTrialInput): Promise<ToolOutput<{ trial: FullTrialRecord }>> {
  return await getTrial(input);
}

export async function tool_get_trial_details(
  input: GetTrialInput,
): Promise<ToolOutput<{ trial: Omit<FullTrialRecord, "outcomes"> }>> {
  const result = await getTrial(input);
  if (!result.ok) return result;

  // Schema forbids the `outcomes` property entirely (not even as `undefined`).
  const { outcomes: _outcomes, ...trial } = result.data.trial;
  return { ok: true, data: { trial } };
}

export async function tool_get_trial_endpoints(
  input: GetTrialInput,
): Promise<ToolOutput<{ nct_id: string; outcomes: NonNullable<FullTrialRecord["outcomes"]> }>> {
  const nctId = typeof input?.nct_id === "string" ? input.nct_id.trim() : "";
  if (!NCT_ID_RE.test(nctId)) return { ok: false, error: { code: "INVALID_ARGUMENT", retryable: false } };

  const result = await getTrial({ nct_id: nctId });
  if (!result.ok) return result;

  return { ok: true, data: { nct_id: nctId, outcomes: result.data.trial.outcomes ?? [] } };
}

export type CompareAttribute =
  | "PHASES"
  | "OVERALL_STATUS"
  | "ENROLLMENT"
  | "LEAD_SPONSOR"
  | "COLLABORATORS"
  | "CONDITIONS"
  | "INTERVENTIONS"
  | "ARMS"
  | "ELIGIBILITY"
  | "OUTCOMES_PRIMARY"
  | "OUTCOMES_SECONDARY"
  | "START_DATE"
  | "PRIMARY_COMPLETION_DATE"
  | "COMPLETION_DATE"
  | "COUNTRIES";

export type CompareTrialsInput = { nct_ids: string[]; attributes: CompareAttribute[] };
export type CompareTrialsOutput = ToolOutput<{
  nct_ids: string[];
  comparisons: Array<{ attribute: CompareAttribute; values: Array<{ nct_id: string; value: unknown }> }>;
}>;

function selectCompareValue(trial: FullTrialRecord, attribute: CompareAttribute): unknown {
  switch (attribute) {
    case "PHASES":
      return trial.phases ?? null;
    case "OVERALL_STATUS":
      return trial.overall_status ?? null;
    case "ENROLLMENT":
      return trial.enrollment ?? null;
    case "LEAD_SPONSOR":
      return trial.lead_sponsor ?? null;
    case "COLLABORATORS":
      return trial.collaborators ?? null;
    case "CONDITIONS":
      return trial.conditions ?? null;
    case "INTERVENTIONS":
      return trial.interventions ?? null;
    case "ARMS":
      return trial.arms ?? null;
    case "ELIGIBILITY":
      return trial.eligibility ?? null;
    case "OUTCOMES_PRIMARY":
      return (trial.outcomes ?? []).filter((o) => o.type === "PRIMARY");
    case "OUTCOMES_SECONDARY":
      return (trial.outcomes ?? []).filter((o) => o.type === "SECONDARY");
    case "START_DATE":
      return trial.start_date ?? null;
    case "PRIMARY_COMPLETION_DATE":
      return trial.primary_completion_date ?? null;
    case "COMPLETION_DATE":
      return trial.completion_date ?? null;
    case "COUNTRIES":
      return trial.countries ?? null;
    default: {
      const exhaustive: never = attribute;
      return exhaustive;
    }
  }
}

export async function tool_compare_trials(input: CompareTrialsInput): Promise<CompareTrialsOutput> {
  const nctIds = Array.isArray(input?.nct_ids) ? input.nct_ids.map((v) => String(v).trim()).filter(Boolean) : [];
  const attributes = Array.isArray(input?.attributes) ? (input.attributes as CompareAttribute[]) : [];

  const dedupedNctIds: string[] = [];
  const seen = new Set<string>();
  for (const id of nctIds) {
    if (!NCT_ID_RE.test(id)) return { ok: false, error: { code: "INVALID_ARGUMENT", retryable: false } };
    if (seen.has(id)) continue;
    seen.add(id);
    dedupedNctIds.push(id);
  }

  if (dedupedNctIds.length < 2 || attributes.length < 1) {
    return { ok: false, error: { code: "INVALID_ARGUMENT", retryable: false } };
  }

  const trialsById = new Map<string, FullTrialRecord>();

  const results = await Promise.all(dedupedNctIds.map((nct_id) => getTrial({ nct_id })));
  for (let i = 0; i < results.length; i += 1) {
    const nct_id = dedupedNctIds[i] as string;
    const result = results[i]!;
    if (!result.ok) {
      return {
        ok: false,
        error: {
          ...result.error,
          context: { ...(result.error.context ?? {}), nct_id },
        },
      };
    }
    trialsById.set(nct_id, result.data.trial);
  }

  const comparisons = attributes.map((attribute) => ({
    attribute,
    values: dedupedNctIds.map((nct_id) => ({
      nct_id,
      value: selectCompareValue(trialsById.get(nct_id)!, attribute),
    })),
  }));

  return { ok: true, data: { nct_ids: dedupedNctIds, comparisons } };
}

export type GroupByKey =
  | "PHASE"
  | "OVERALL_STATUS"
  | "LEAD_SPONSOR"
  | "COUNTRY"
  | "FIRST_POSTED_MONTH"
  | "LAST_UPDATE_POSTED_MONTH";

export type AggregateMetric = "COUNT_TRIALS";
export type AggregateTrialsInput = {
  filters: SearchTrialsInput["filters"];
  group_by: [GroupByKey];
  metrics: AggregateMetric[];
  limit?: number;
  sort?: { metric: AggregateMetric; direction: "ASC" | "DESC" };
};

export type AggregateTrialsOutput = ToolOutput<{
  group_by: [GroupByKey];
  metrics: AggregateMetric[];
  groups: Array<{ group: { key: GroupByKey; value: string | null }; metrics: { count_trials: number } }>;
  total_trials: number;
}>;

function monthKey(isoDate: string | undefined): string | null {
  if (typeof isoDate !== "string") return null;
  const m = isoDate.match(/^(\d{4})-(\d{2})-\d{2}$/);
  return m ? `${m[1]}-${m[2]}` : null;
}

function groupValuesForTrial(trial: any, key: GroupByKey): Array<string | null> {
  switch (key) {
    case "PHASE": {
      const phases = Array.isArray(trial.phases) ? (trial.phases as unknown[]) : [];
      const values = phases.map((p) => (typeof p === "string" ? p : null)).filter((v) => typeof v === "string") as string[];
      return values.length ? values : [null];
    }
    case "OVERALL_STATUS":
      return [typeof trial.overall_status === "string" ? trial.overall_status : null];
    case "LEAD_SPONSOR":
      return [typeof trial.lead_sponsor?.name === "string" ? (trial.lead_sponsor.name as string) : null];
    case "COUNTRY": {
      const countries = Array.isArray(trial.countries) ? (trial.countries as any[]) : [];
      const values = countries
        .map((c) => (typeof c?.code === "string" ? (c.code as string) : null))
        .filter((v) => typeof v === "string") as string[];
      return values.length ? values : [null];
    }
    case "FIRST_POSTED_MONTH":
      return [monthKey(trial.first_posted)];
    case "LAST_UPDATE_POSTED_MONTH":
      return [monthKey(trial.last_update_posted)];
    default: {
      const exhaustive: never = key;
      return [exhaustive];
    }
  }
}

function normalizeAggregateLimit(limit: unknown): number {
  const n = Number.isInteger(limit) ? (limit as number) : 50;
  return Math.min(Math.max(n, 1), 500);
}

async function collectTrialsForAggregation(filters: SearchTrialsInput["filters"]): Promise<ToolOutput<{ trials: any[] }>> {
  const include_fields: TrialIncludeField[] = [
    "NCT_ID",
    "PHASES",
    "OVERALL_STATUS",
    "SPONSORS",
    "COUNTRIES",
    "FIRST_POSTED",
    "LAST_UPDATE_POSTED",
  ];

  const collected: any[] = [];
  let pageToken: string | undefined = undefined;

  while (collected.length < MAX_AGG_TRIALS) {
    const result = await searchTrials({
      filters,
      page_size: AGG_PAGE_SIZE,
      ...(pageToken ? { page_token: pageToken } : {}),
      include_fields,
    });

    if (!result.ok) return result;

    collected.push(...result.data.trials);
    pageToken = result.data.page.next_page_token;
    if (!pageToken) break;
  }

  return { ok: true, data: { trials: collected.slice(0, MAX_AGG_TRIALS) } };
}

export async function tool_aggregate_trials(input: AggregateTrialsInput): Promise<AggregateTrialsOutput> {
  const key = Array.isArray(input?.group_by) ? (input.group_by[0] as GroupByKey | undefined) : undefined;
  const metrics = Array.isArray(input?.metrics) ? (input.metrics as AggregateMetric[]) : [];
  if (!key || !metrics.length) return { ok: false, error: { code: "INVALID_ARGUMENT", retryable: false } };

  const limit = normalizeAggregateLimit(input.limit);
  const sortDirection = input.sort?.direction === "ASC" || input.sort?.direction === "DESC" ? input.sort.direction : "DESC";

  const collected = await collectTrialsForAggregation(input.filters);
  if (!collected.ok) return collected;

  const counts = new Map<string | null, number>();
  for (const trial of collected.data.trials) {
    for (const value of groupValuesForTrial(trial, key)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  const groups = Array.from(counts.entries()).map(([value, count]) => ({
    group: { key, value },
    metrics: { count_trials: count },
  }));

  groups.sort((a, b) => {
    if (a.metrics.count_trials !== b.metrics.count_trials) {
      return sortDirection === "ASC"
        ? a.metrics.count_trials - b.metrics.count_trials
        : b.metrics.count_trials - a.metrics.count_trials;
    }

    const av = a.group.value;
    const bv = b.group.value;
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return av.localeCompare(bv);
  });

  return {
    ok: true,
    data: {
      group_by: [key],
      metrics,
      groups: groups.slice(0, limit),
      total_trials: collected.data.trials.length,
    },
  };
}

export async function tool_search_pubmed(input: SearchPubmedInput): Promise<SearchPubmedOutput> {
  return await searchPubmed(input);
}
