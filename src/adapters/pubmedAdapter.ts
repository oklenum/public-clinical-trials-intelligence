import { fetchJson, type Err, type Ok } from "./http.js";

const API_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const MAX_RETMX = 200;

export type PubmedSort = "RELEVANCE" | "PUB_DATE";

export type SearchPubmedInput = {
  nct_id?: string;
  query?: string;
  retmax?: number;
  sort?: PubmedSort;
};

export type PubmedCitation = {
  pmid: string;
  title: string;
  journal?: string;
  year?: number;
  doi?: string;
  authors?: string[];
  pub_date?: string;
  source?: { db: "PUBMED" };
};

export type SearchPubmedOutput =
  | Ok<{ citations: PubmedCitation[]; query_used?: { term: string; retmax?: number; sort?: PubmedSort } }>
  | Err;

type ESearchResponse = {
  esearchresult?: { idlist?: unknown[] };
};

type ESummaryResponse = {
  result?: { uids?: unknown[] } & Record<string, unknown>;
};

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function parseYear(pubDate: string | undefined): number | undefined {
  if (!pubDate) return undefined;
  const m = pubDate.match(/(\d{4})/);
  if (!m) return undefined;
  const y = Number.parseInt(m[1] ?? "", 10);
  return Number.isFinite(y) && y >= 1800 && y <= 2100 ? y : undefined;
}

function parseDoiFromSummary(summary: Record<string, unknown>): string | undefined {
  const articleIds = asArray(summary.articleids);
  for (const id of articleIds) {
    const obj = (id ?? {}) as Record<string, unknown>;
    if (obj.idtype === "doi") {
      const doi = asNonEmptyString(obj.value);
      if (doi) return doi;
    }
  }

  const elocation = asNonEmptyString(summary.elocationid);
  if (elocation) {
    const m = elocation.match(/10\\.[^\\s]+/);
    if (m?.[0]) return m[0];
  }

  return undefined;
}

function normalizeCitation(pmid: string, summary: Record<string, unknown>): PubmedCitation | undefined {
  const title = asNonEmptyString(summary.title);
  if (!/^[0-9]+$/.test(pmid) || !title) return undefined;

  const journal = asNonEmptyString(summary.fulljournalname) ?? asNonEmptyString(summary.source);
  const pubDate = asNonEmptyString(summary.pubdate);
  const year = parseYear(pubDate);

  const authors = asArray(summary.authors)
    .map((a) => asNonEmptyString(((a ?? {}) as Record<string, unknown>).name))
    .filter(Boolean) as string[];

  const doi = parseDoiFromSummary(summary);

  return {
    pmid,
    title,
    ...(journal ? { journal } : {}),
    ...(typeof year === "number" ? { year } : {}),
    ...(doi ? { doi } : {}),
    ...(authors.length ? { authors } : {}),
    ...(pubDate ? { pub_date: pubDate } : {}),
    source: { db: "PUBMED" },
  };
}

function buildEntrezTerm(input: SearchPubmedInput): string | undefined {
  const nctId = asNonEmptyString(input.nct_id);
  if (nctId) return `${nctId}[All Fields]`;
  return asNonEmptyString(input.query);
}

function mapSort(sort: PubmedSort | undefined): string | undefined {
  if (sort === "PUB_DATE") return "pub+date";
  if (sort === "RELEVANCE") return "relevance";
  return undefined;
}

export async function searchPubmed(input: SearchPubmedInput, { timeoutMs }: { timeoutMs?: number } = {}): Promise<SearchPubmedOutput> {
  try {
    const term = buildEntrezTerm(input);
    if (!term) return { ok: false, error: { code: "INVALID_ARGUMENT", retryable: false } };

    const retmaxRaw = Number.isInteger(input.retmax) ? (input.retmax as number) : undefined;
    const retmax = typeof retmaxRaw === "number" ? Math.min(Math.max(retmaxRaw, 1), MAX_RETMX) : undefined;

    const esearch = new URL(`${API_BASE}/esearch.fcgi`);
    esearch.searchParams.set("db", "pubmed");
    esearch.searchParams.set("term", term);
    esearch.searchParams.set("retmode", "json");
    if (typeof retmax === "number") esearch.searchParams.set("retmax", String(retmax));
    const sortParam = mapSort(input.sort);
    if (sortParam) esearch.searchParams.set("sort", sortParam);

    const searchResult = await fetchJson<ESearchResponse>(esearch.toString(), {
      timeoutMs,
      upstream: { service: "PUBMED" },
    });
    if (!searchResult.ok) return searchResult;

    const ids = asArray(searchResult.data?.esearchresult?.idlist)
      .map((v) => asNonEmptyString(v))
      .filter(Boolean) as string[];

    if (!ids.length) {
      return {
        ok: true,
        data: {
          citations: [],
          query_used: {
            term,
            ...(typeof retmax === "number" ? { retmax } : {}),
            ...(input.sort ? { sort: input.sort } : {}),
          },
        },
      };
    }

    const esummary = new URL(`${API_BASE}/esummary.fcgi`);
    esummary.searchParams.set("db", "pubmed");
    esummary.searchParams.set("id", ids.join(","));
    esummary.searchParams.set("retmode", "json");

    const summaryResult = await fetchJson<ESummaryResponse>(esummary.toString(), {
      timeoutMs,
      upstream: { service: "PUBMED" },
    });
    if (!summaryResult.ok) return summaryResult;

    const resultObj = (summaryResult.data?.result ?? {}) as Record<string, unknown>;
    const uids = asArray(resultObj.uids).map((v) => asNonEmptyString(v)).filter(Boolean) as string[];

    const citations = uids
      .map((pmid) => normalizeCitation(pmid, ((resultObj[pmid] ?? {}) as Record<string, unknown>) ?? {}))
      .filter(Boolean) as PubmedCitation[];

    return {
      ok: true,
      data: {
        citations,
        query_used: {
          term,
          ...(typeof retmax === "number" ? { retmax } : {}),
          ...(input.sort ? { sort: input.sort } : {}),
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

