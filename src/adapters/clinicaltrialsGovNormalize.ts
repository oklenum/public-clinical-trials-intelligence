const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NCT_ID_RE = /^NCT\d{8}$/;
const ISO_COUNTRY_CODE_RE = /^[A-Z]{2}$/;

type JsonObject = Record<string, unknown>;

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function uniqueStrings(values: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of asArray(values)) {
    const v = asNonEmptyString(value);
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function normalizeCountryName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[().,']/g, "")
    .replace(/\s+/g, " ");
}

let countryNameToCodeCache: Map<string, string> | undefined;

function getCountryNameToCodeMap(): Map<string, string> {
  if (countryNameToCodeCache) return countryNameToCodeCache;
  const map = new Map<string, string>();

  const supportedValuesOf = (Intl as any).supportedValuesOf as undefined | ((key: string) => string[]);
  const displayNames = (Intl as any).DisplayNames as
    | undefined
    | (new (locales: string[], options: { type: string }) => { of(code: string): string | undefined });

  if (typeof supportedValuesOf === "function" && typeof displayNames === "function") {
    try {
      const display = new displayNames(["en"], { type: "region" });
      for (const code of supportedValuesOf("region")) {
        if (!ISO_COUNTRY_CODE_RE.test(code)) continue;
        const name = display.of(code);
        if (!name) continue;
        map.set(normalizeCountryName(name), code);
      }
    } catch {
      // Older runtimes may not support `Intl.supportedValuesOf('region')`.
    }
  }

  // Minimal fallbacks for older runtimes / edge cases.
  map.set(normalizeCountryName("United States"), "US");
  map.set(normalizeCountryName("United Kingdom"), "GB");
  map.set(normalizeCountryName("Korea, Republic of"), "KR");
  map.set(normalizeCountryName("Russian Federation"), "RU");

  countryNameToCodeCache = map;
  return map;
}

function normalizeCountries(contactsLocationsModule: unknown): Array<{ code: string; name?: string }> {
  const obj = (contactsLocationsModule ?? {}) as JsonObject;
  const locations = asArray(obj.locations);
  const nameToCode = getCountryNameToCodeMap();

  const seen = new Set<string>();
  const out: Array<{ code: string; name?: string }> = [];

  for (const loc of locations) {
    const countryName = asNonEmptyString(((loc ?? {}) as JsonObject).country);
    if (!countryName) continue;
    const code = nameToCode.get(normalizeCountryName(countryName));
    if (!code) continue;
    if (seen.has(code)) continue;
    seen.add(code);
    out.push({ code, name: countryName });
  }

  return out;
}

function normalizeOverallStatus(value: unknown):
  | "NOT_YET_RECRUITING"
  | "RECRUITING"
  | "ENROLLING_BY_INVITATION"
  | "ACTIVE_NOT_RECRUITING"
  | "SUSPENDED"
  | "TERMINATED"
  | "WITHDRAWN"
  | "COMPLETED"
  | "UNKNOWN_STATUS"
  | undefined {
  const v = asNonEmptyString(value);
  if (!v) return undefined;
  const allowed = new Set([
    "NOT_YET_RECRUITING",
    "RECRUITING",
    "ENROLLING_BY_INVITATION",
    "ACTIVE_NOT_RECRUITING",
    "SUSPENDED",
    "TERMINATED",
    "WITHDRAWN",
    "COMPLETED",
    "UNKNOWN_STATUS",
  ]);
  return allowed.has(v) ? (v as any) : "UNKNOWN_STATUS";
}

function normalizePhase(
  value: unknown,
):
  | "EARLY_PHASE_1"
  | "PHASE_1"
  | "PHASE_1_2"
  | "PHASE_2"
  | "PHASE_2_3"
  | "PHASE_3"
  | "PHASE_4"
  | "NOT_APPLICABLE"
  | undefined {
  const v = asNonEmptyString(value);
  if (!v) return undefined;
  const map = new Map<string, any>([
    ["EARLY_PHASE1", "EARLY_PHASE_1"],
    ["PHASE1", "PHASE_1"],
    ["PHASE2", "PHASE_2"],
    ["PHASE3", "PHASE_3"],
    ["PHASE4", "PHASE_4"],
    ["NA", "NOT_APPLICABLE"],
    ["NOT_APPLICABLE", "NOT_APPLICABLE"],
  ]);
  return map.get(v);
}

function normalizeStudyType(
  value: unknown,
): "INTERVENTIONAL" | "OBSERVATIONAL" | "EXPANDED_ACCESS" | undefined {
  const v = asNonEmptyString(value);
  if (!v) return undefined;
  const allowed = new Set(["INTERVENTIONAL", "OBSERVATIONAL", "EXPANDED_ACCESS"]);
  return allowed.has(v) ? (v as any) : undefined;
}

function normalizeSponsorClass(
  value: unknown,
): "NIH" | "OTHER_GOV" | "INDUSTRY" | "OTHER" | "UNKNOWN" | undefined {
  const v = asNonEmptyString(value);
  if (!v) return undefined;
  const allowed = new Set(["NIH", "OTHER_GOV", "INDUSTRY", "OTHER", "UNKNOWN"]);
  return allowed.has(v) ? (v as any) : "UNKNOWN";
}

function normalizeIsoDate(value: unknown): string | undefined {
  const v = asNonEmptyString(value);
  if (!v) return undefined;
  return ISO_DATE_RE.test(v) ? v : undefined;
}

function normalizeEnrollment(enrollmentInfo: unknown):
  | { count: number; type: "ACTUAL" | "ESTIMATED" }
  | undefined {
  const obj = (enrollmentInfo ?? {}) as JsonObject;
  const count = obj.count;
  const type = obj.type;
  if (typeof count !== "number" || !Number.isFinite(count) || count < 0) return undefined;
  if (type !== "ACTUAL" && type !== "ESTIMATED") return undefined;
  return { count: Math.trunc(count), type };
}

function normalizeSponsors(sponsorCollaboratorsModule: unknown): {
  lead_sponsor?: { name: string; class?: "NIH" | "OTHER_GOV" | "INDUSTRY" | "OTHER" | "UNKNOWN" };
  collaborators: Array<{ name: string; class?: "NIH" | "OTHER_GOV" | "INDUSTRY" | "OTHER" | "UNKNOWN" }>;
} {
  const obj = (sponsorCollaboratorsModule ?? {}) as JsonObject;
  const leadSponsor = (obj.leadSponsor ?? {}) as JsonObject;
  const leadSponsorName = asNonEmptyString(leadSponsor.name);
  const leadSponsorClass = normalizeSponsorClass(leadSponsor.class);

  const collaborators = asArray(obj.collaborators)
    .map((c) => {
      const collaborator = (c ?? {}) as JsonObject;
      const name = asNonEmptyString(collaborator.name);
      if (!name) return undefined;
      const klass = normalizeSponsorClass(collaborator.class);
      return { name, ...(klass ? { class: klass } : {}) };
    })
    .filter(Boolean) as Array<{ name: string; class?: "NIH" | "OTHER_GOV" | "INDUSTRY" | "OTHER" | "UNKNOWN" }>;

  const dedupedCollaborators = collaborators.filter(
    (c, idx) => collaborators.findIndex((d) => d.name === c.name) === idx,
  );

  return {
    lead_sponsor: leadSponsorName
      ? { name: leadSponsorName, ...(leadSponsorClass ? { class: leadSponsorClass } : {}) }
      : undefined,
    collaborators: dedupedCollaborators,
  };
}

function normalizeOutcomes(outcomesModule: unknown): Array<{
  type: "PRIMARY" | "SECONDARY" | "OTHER";
  measure: string;
  time_frame?: string;
  description?: string;
}> {
  const obj = (outcomesModule ?? {}) as JsonObject;

  const primary = asArray(obj.primaryOutcomes).map((o) => {
    const outcome = (o ?? {}) as JsonObject;
    return {
      type: "PRIMARY" as const,
      measure: asNonEmptyString(outcome.measure),
      ...(asNonEmptyString(outcome.timeFrame) ? { time_frame: outcome.timeFrame as string } : {}),
      ...(asNonEmptyString(outcome.description) ? { description: outcome.description as string } : {}),
    };
  });

  const secondary = asArray(obj.secondaryOutcomes).map((o) => {
    const outcome = (o ?? {}) as JsonObject;
    return {
      type: "SECONDARY" as const,
      measure: asNonEmptyString(outcome.measure),
      ...(asNonEmptyString(outcome.timeFrame) ? { time_frame: outcome.timeFrame as string } : {}),
      ...(asNonEmptyString(outcome.description) ? { description: outcome.description as string } : {}),
    };
  });

  const other = asArray(obj.otherOutcomes).map((o) => {
    const outcome = (o ?? {}) as JsonObject;
    return {
      type: "OTHER" as const,
      measure: asNonEmptyString(outcome.measure),
      ...(asNonEmptyString(outcome.timeFrame) ? { time_frame: outcome.timeFrame as string } : {}),
      ...(asNonEmptyString(outcome.description) ? { description: outcome.description as string } : {}),
    };
  });

  return [...primary, ...secondary, ...other].filter(
    (o): o is { type: "PRIMARY" | "SECONDARY" | "OTHER"; measure: string; time_frame?: string; description?: string } =>
      Boolean(o.measure),
  );
}

function normalizeArms(armsInterventionsModule: unknown): Array<{
  label: string;
  type?: "EXPERIMENTAL" | "ACTIVE_COMPARATOR" | "PLACEBO_COMPARATOR" | "SHAM_COMPARATOR" | "NO_INTERVENTION" | "OTHER";
  description?: string;
  interventions: string[];
}> {
  const obj = (armsInterventionsModule ?? {}) as JsonObject;
  const allowedTypes = new Set([
    "EXPERIMENTAL",
    "ACTIVE_COMPARATOR",
    "PLACEBO_COMPARATOR",
    "SHAM_COMPARATOR",
    "NO_INTERVENTION",
    "OTHER",
  ]);

  return asArray(obj.armGroups)
    .map((arm) => {
      const a = (arm ?? {}) as JsonObject;
      const label = asNonEmptyString(a.label);
      if (!label) return undefined;
      const armType = asNonEmptyString(a.type);
      return {
        label,
        ...(armType && allowedTypes.has(armType) ? { type: armType as any } : {}),
        ...(asNonEmptyString(a.description) ? { description: a.description as string } : {}),
        interventions: uniqueStrings(a.interventionNames).map((name) => {
          const idx = name.indexOf(":");
          return idx >= 0 ? name.slice(idx + 1).trim() : name;
        }),
      };
    })
    .filter(Boolean) as any;
}

function normalizeInterventions(armsInterventionsModule: unknown): string[] {
  const obj = (armsInterventionsModule ?? {}) as JsonObject;
  const fromInterventions = uniqueStrings(asArray(obj.interventions).map((i) => (i as any)?.name));
  const fromArmNames = uniqueStrings(
    asArray(obj.armGroups).flatMap((arm) => ((arm as any)?.interventionNames as unknown[]) ?? []),
  ).map((name) => {
    const idx = name.indexOf(":");
    return idx >= 0 ? name.slice(idx + 1).trim() : name;
  });
  return uniqueStrings([...fromInterventions, ...fromArmNames]);
}

function normalizeEligibility(eligibilityModule: unknown):
  | {
      criteria?: string;
      healthy_volunteers?: boolean;
      sex?: "ALL" | "MALE" | "FEMALE";
      minimum_age?: string;
      maximum_age?: string;
      standard_age?: Array<"CHILD" | "ADULT" | "OLDER_ADULT">;
    }
  | undefined {
  if (!eligibilityModule || typeof eligibilityModule !== "object") return undefined;
  const obj = eligibilityModule as JsonObject;

  const out: any = {};
  const criteria = asNonEmptyString(obj.eligibilityCriteria);
  if (criteria) out.criteria = criteria;
  if (typeof obj.healthyVolunteers === "boolean") out.healthy_volunteers = obj.healthyVolunteers;

  const sex = asNonEmptyString(obj.sex);
  if (sex === "ALL" || sex === "MALE" || sex === "FEMALE") out.sex = sex;

  const minAge = asNonEmptyString(obj.minimumAge);
  if (minAge) out.minimum_age = minAge;
  const maxAge = asNonEmptyString(obj.maximumAge);
  if (maxAge) out.maximum_age = maxAge;

  const allowedAges = new Set(["CHILD", "ADULT", "OLDER_ADULT"]);
  const standardAge = uniqueStrings(obj.stdAges).filter((a) => allowedAges.has(a)) as any;
  if (standardAge.length) out.standard_age = standardAge;

  return Object.keys(out).length ? out : undefined;
}

function normalizeStudyDesign(designInfo: unknown):
  | {
      allocation?: "RANDOMIZED" | "NON_RANDOMIZED" | "NA";
      intervention_model?: string;
      masking?: string;
      primary_purpose?: string;
    }
  | undefined {
  if (!designInfo || typeof designInfo !== "object") return undefined;
  const obj = designInfo as JsonObject;
  const out: any = {};

  const allocation = asNonEmptyString(obj.allocation);
  if (allocation === "RANDOMIZED" || allocation === "NON_RANDOMIZED" || allocation === "NA") {
    out.allocation = allocation;
  }
  const interventionModel = asNonEmptyString(obj.interventionModel);
  if (interventionModel) out.intervention_model = interventionModel;
  const masking = asNonEmptyString((obj.maskingInfo as any)?.masking);
  if (masking) out.masking = masking;
  const primaryPurpose = asNonEmptyString(obj.primaryPurpose);
  if (primaryPurpose) out.primary_purpose = primaryPurpose;

  return Object.keys(out).length ? out : undefined;
}

export type TrialSummary = {
  nct_id: string;
  brief_title: string;
  official_title?: string;
  acronym?: string;
  overall_status?: ReturnType<typeof normalizeOverallStatus>;
  phases?: Array<Exclude<ReturnType<typeof normalizePhase>, undefined>>;
  study_type?: ReturnType<typeof normalizeStudyType>;
  enrollment?: ReturnType<typeof normalizeEnrollment>;
  lead_sponsor?: NonNullable<ReturnType<typeof normalizeSponsors>["lead_sponsor"]>;
  collaborators?: ReturnType<typeof normalizeSponsors>["collaborators"];
  conditions?: string[];
  interventions?: string[];
  countries?: ReturnType<typeof normalizeCountries>;
  first_posted?: string;
  last_update_posted?: string;
  start_date?: string;
  primary_completion_date?: string;
  completion_date?: string;
};

export type FullTrialRecord = {
  nct_id: string;
  brief_title?: string;
  official_title?: string;
  overall_status?: ReturnType<typeof normalizeOverallStatus>;
  study_type?: ReturnType<typeof normalizeStudyType>;
  phases?: Array<Exclude<ReturnType<typeof normalizePhase>, undefined>>;
  enrollment?: ReturnType<typeof normalizeEnrollment>;
  conditions?: string[];
  interventions?: string[];
  lead_sponsor?: NonNullable<ReturnType<typeof normalizeSponsors>["lead_sponsor"]>;
  collaborators?: ReturnType<typeof normalizeSponsors>["collaborators"];
  first_posted?: string;
  last_update_posted?: string;
  start_date?: string;
  primary_completion_date?: string;
  completion_date?: string;
  study_design?: ReturnType<typeof normalizeStudyDesign>;
  arms?: ReturnType<typeof normalizeArms>;
  eligibility?: ReturnType<typeof normalizeEligibility>;
  outcomes?: ReturnType<typeof normalizeOutcomes>;
  countries?: ReturnType<typeof normalizeCountries>;
  source: { registry: "CLINICALTRIALS_GOV"; api_version?: string };
};

export function normalizeTrialSummaryFromStudy(study: unknown): TrialSummary | undefined {
  const s = (study ?? {}) as JsonObject;
  const protocol = (s.protocolSection ?? {}) as JsonObject;
  const identification = (protocol.identificationModule ?? {}) as JsonObject;

  const nctId = asNonEmptyString(identification.nctId);
  if (!nctId || !NCT_ID_RE.test(nctId)) return undefined;

  const briefTitle =
    asNonEmptyString(identification.briefTitle) ??
    asNonEmptyString(identification.officialTitle) ??
    nctId;

  const status = (protocol.statusModule ?? {}) as JsonObject;
  const design = (protocol.designModule ?? {}) as JsonObject;
  const sponsors = normalizeSponsors(protocol.sponsorCollaboratorsModule);

  const conditions = uniqueStrings((protocol.conditionsModule as any)?.conditions);
  const interventions = normalizeInterventions(protocol.armsInterventionsModule);
  const countries = normalizeCountries(protocol.contactsLocationsModule);

  const phases = uniqueStrings(design.phases).map(normalizePhase).filter(Boolean) as any;

  const overallStatus = normalizeOverallStatus(status.overallStatus);
  const studyType = normalizeStudyType(design.studyType);
  const enrollment = normalizeEnrollment(design.enrollmentInfo);
  const firstPosted = normalizeIsoDate((status.studyFirstPostDateStruct as any)?.date);
  const lastUpdatePosted = normalizeIsoDate((status.lastUpdatePostDateStruct as any)?.date);
  const startDate = normalizeIsoDate((status.startDateStruct as any)?.date);
  const primaryCompletionDate = normalizeIsoDate((status.primaryCompletionDateStruct as any)?.date);
  const completionDate = normalizeIsoDate((status.completionDateStruct as any)?.date);

  const out: TrialSummary = {
    nct_id: nctId,
    brief_title: briefTitle,
    ...(asNonEmptyString(identification.officialTitle) ? { official_title: identification.officialTitle as string } : {}),
    ...(asNonEmptyString(identification.acronym) ? { acronym: identification.acronym as string } : {}),
    ...(overallStatus ? { overall_status: overallStatus } : {}),
    ...(phases.length ? { phases } : {}),
    ...(studyType ? { study_type: studyType } : {}),
    ...(enrollment ? { enrollment } : {}),
    ...(sponsors.lead_sponsor ? { lead_sponsor: sponsors.lead_sponsor } : {}),
    ...(sponsors.collaborators.length ? { collaborators: sponsors.collaborators } : {}),
    ...(conditions.length ? { conditions } : {}),
    ...(interventions.length ? { interventions } : {}),
    ...(countries.length ? { countries } : {}),
    ...(firstPosted ? { first_posted: firstPosted } : {}),
    ...(lastUpdatePosted ? { last_update_posted: lastUpdatePosted } : {}),
    ...(startDate ? { start_date: startDate } : {}),
    ...(primaryCompletionDate ? { primary_completion_date: primaryCompletionDate } : {}),
    ...(completionDate ? { completion_date: completionDate } : {}),
  };

  return out;
}

export function normalizeFullTrialRecordFromStudy(study: unknown): FullTrialRecord | undefined {
  const summary = normalizeTrialSummaryFromStudy(study);
  if (!summary) return undefined;

  const s = (study ?? {}) as JsonObject;
  const protocol = (s.protocolSection ?? {}) as JsonObject;
  const design = (protocol.designModule ?? {}) as JsonObject;

  const outcomes = normalizeOutcomes(protocol.outcomesModule);
  const arms = normalizeArms(protocol.armsInterventionsModule);
  const eligibility = normalizeEligibility(protocol.eligibilityModule);
  const studyDesign = normalizeStudyDesign((design as any).designInfo);
  const apiVersion = asNonEmptyString(((s.derivedSection as any)?.miscInfoModule as any)?.versionHolder);
  const countries = normalizeCountries(protocol.contactsLocationsModule);

  return {
    nct_id: summary.nct_id,
    ...(summary.brief_title ? { brief_title: summary.brief_title } : {}),
    ...(summary.official_title ? { official_title: summary.official_title } : {}),
    ...(summary.overall_status ? { overall_status: summary.overall_status } : {}),
    ...(summary.study_type ? { study_type: summary.study_type } : {}),
    ...(summary.phases ? { phases: summary.phases } : {}),
    ...(summary.enrollment ? { enrollment: summary.enrollment } : {}),
    ...(summary.conditions ? { conditions: summary.conditions } : {}),
    ...(summary.interventions ? { interventions: summary.interventions } : {}),
    ...(summary.lead_sponsor ? { lead_sponsor: summary.lead_sponsor } : {}),
    ...(summary.collaborators ? { collaborators: summary.collaborators } : {}),
    ...(summary.first_posted ? { first_posted: summary.first_posted } : {}),
    ...(summary.last_update_posted ? { last_update_posted: summary.last_update_posted } : {}),
    ...(summary.start_date ? { start_date: summary.start_date } : {}),
    ...(summary.primary_completion_date ? { primary_completion_date: summary.primary_completion_date } : {}),
    ...(summary.completion_date ? { completion_date: summary.completion_date } : {}),
    ...(studyDesign ? { study_design: studyDesign } : {}),
    ...(arms.length ? { arms } : {}),
    ...(eligibility ? { eligibility } : {}),
    ...(outcomes.length ? { outcomes } : {}),
    ...(countries.length ? { countries } : {}),
    source: {
      registry: "CLINICALTRIALS_GOV",
      ...(apiVersion ? { api_version: apiVersion } : {}),
    },
  };
}
