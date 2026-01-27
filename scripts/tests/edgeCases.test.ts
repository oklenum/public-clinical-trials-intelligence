import assert from "node:assert/strict";
import test from "node:test";

import { getTrial, searchTrials } from "../../src/adapters/clinicaltrialsGovAdapter.js";
import { searchPubmed } from "../../src/adapters/pubmedAdapter.js";
import { tool_aggregate_trials } from "../../src/dataAdapter.js";

function jsonResponse(body: unknown, { status = 200, headers = {} }: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

test("no results found: search_trials returns ok with empty trials", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input: any) => {
      const url = String(input);
      if (url.includes("clinicaltrials.gov/api/v2/studies")) {
        return jsonResponse({ studies: [] });
      }
      throw new Error(`Unexpected fetch url: ${url}`);
    };

    const result = await searchTrials({ filters: { indication: "glioblastoma" } }, { timeoutMs: 50 });
    assert.equal(result.ok, true);
    assert.deepEqual(result.data.trials, []);
    assert.equal(result.data.page.page_size, 25);
    assert.ok(!("next_page_token" in result.data.page));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("partial trial data: get_trial returns minimal structured record", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input: any) => {
      const url = String(input);
      if (url.includes("clinicaltrials.gov/api/v2/studies/NCT00000001")) {
        return jsonResponse({
          protocolSection: {
            identificationModule: {
              nctId: "NCT00000001",
            },
          },
        });
      }
      throw new Error(`Unexpected fetch url: ${url}`);
    };

    const result = await getTrial({ nct_id: "NCT00000001" }, { timeoutMs: 50 });
    assert.equal(result.ok, true);
    assert.equal(result.data.trial.nct_id, "NCT00000001");
    assert.equal(result.data.trial.source.registry, "CLINICALTRIALS_GOV");
    assert.equal(result.data.trial.brief_title, "NCT00000001");
    assert.ok(!("outcomes" in result.data.trial) || Array.isArray(result.data.trial.outcomes));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ambiguous indications: adapter encodes query.cond and query.term and does not crash", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input: any) => {
      const url = new URL(String(input));
      if (url.hostname === "clinicaltrials.gov" && url.pathname === "/api/v2/studies") {
        assert.equal(url.searchParams.get("query.cond"), "AML / ALL");
        assert.equal(url.searchParams.get("query.term"), "BCL2 inhibitor");
        return jsonResponse({ studies: [] });
      }
      throw new Error(`Unexpected fetch url: ${url.toString()}`);
    };

    const result = await searchTrials(
      { filters: { indication: "AML / ALL", query_term: "BCL2 inhibitor" } },
      { timeoutMs: 50 },
    );
    assert.equal(result.ok, true);
    assert.deepEqual(result.data.trials, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("truncates excessive phases/statuses/countries to avoid runaway URLs", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input: any) => {
      const url = new URL(String(input));
      if (url.hostname === "clinicaltrials.gov" && url.pathname === "/api/v2/studies") {
        assert.equal(url.searchParams.get("query.term"), "");
        return jsonResponse({ studies: [] });
      }
      throw new Error(`Unexpected fetch url: ${url.toString()}`);
    };

    const many = Array.from({ length: 60 }, (_, i) => `X${i}`);
    const result = await searchTrials(
      {
        filters: {
          phases: many as any,
          overall_statuses: many as any,
          countries: many,
        },
      },
      { timeoutMs: 50 },
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "INVALID_ARGUMENT");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("encodes sponsor, dates, and countries into query.term", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input: any) => {
      const url = new URL(String(input));
      if (url.hostname === "clinicaltrials.gov" && url.pathname === "/api/v2/studies") {
        assert.equal(url.searchParams.get("query.cond"), null);
        const term = url.searchParams.get("query.term");
        assert.ok(term?.includes("AREA[SponsorCollaborators]Lundbeck"));
        assert.ok(term?.includes("AREA[LastUpdatePostDate]RANGE[2024-01-01,2024-12-31]"));
        assert.ok(term?.includes("AREA[StudyFirstPostDate]RANGE[2023-01-01,]"));
        assert.ok(term?.includes("AREA[StartDate]RANGE[2022-01-01,2022-12-31]"));
        assert.ok(term?.includes("AREA[PrimaryCompletionDate]RANGE[,2025-06-30]"));
        assert.ok(term?.includes("AREA[CompletionDate]RANGE[2025-07-01,]"));
        assert.ok(term?.includes("AREA[LocationCountry]US"));
        assert.ok(term?.includes("AREA[LocationCountry]DK"));
        return jsonResponse({ studies: [] });
      }
      throw new Error(`Unexpected fetch url: ${url.toString()}`);
    };

    const result = await searchTrials(
      {
        filters: {
          sponsor_or_collaborator: "  Lundbeck  ",
          last_update_posted_from: "2024-01-01",
          last_update_posted_to: "2024-12-31",
          first_posted_from: "2023-01-01",
          start_date_from: "2022-01-01",
          start_date_to: "2022-12-31",
          primary_completion_date_to: "2025-06-30",
          completion_date_from: "2025-07-01",
          countries: ["us", "DK", ""],
        },
      },
      { timeoutMs: 50 },
    );
    assert.equal(result.ok, true);
    assert.deepEqual(result.data.trials, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("partial ranges emit open-ended RANGE tokens", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input: any) => {
      const url = new URL(String(input));
      if (url.hostname === "clinicaltrials.gov" && url.pathname === "/api/v2/studies") {
        const term = url.searchParams.get("query.term") ?? "";
        assert.ok(term.includes("AREA[LastUpdatePostDate]RANGE[,2024-12-31]"));
        assert.ok(term.includes("AREA[StudyFirstPostDate]RANGE[2023-01-01,]"));
        assert.ok(term.includes("AREA[StartDate]RANGE[,2022-12-31]"));
        assert.ok(term.includes("AREA[CompletionDate]RANGE[2025-07-01,]"));
        return jsonResponse({ studies: [] });
      }
      throw new Error(`Unexpected fetch url: ${url.toString()}`);
    };

    const result = await searchTrials(
      {
        filters: {
          last_update_posted_to: "2024-12-31",
          first_posted_from: "2023-01-01",
          start_date_to: "2022-12-31",
          completion_date_from: "2025-07-01",
        },
      },
      { timeoutMs: 50 },
    );
    assert.equal(result.ok, true);
    assert.deepEqual(result.data.trials, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("no results found: aggregate_trials does not loop on empty pages with a nextPageToken", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input: any) => {
      const url = new URL(String(input));
      if (url.hostname === "clinicaltrials.gov" && url.pathname === "/api/v2/studies") {
        return jsonResponse({ studies: [], nextPageToken: "stuck" });
      }
      throw new Error(`Unexpected fetch url: ${url.toString()}`);
    };

    const result = await tool_aggregate_trials({
      filters: { indication: "no-such-indication" },
      group_by: ["PHASE"],
      metrics: ["COUNT_TRIALS"],
    });
    assert.equal(result.ok, true);
    assert.equal(result.data.total_trials, 0);
    assert.deepEqual(result.data.groups, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("happy path: search_trials normalizes a minimal trial summary", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input: any) => {
      const url = new URL(String(input));
      if (url.hostname === "clinicaltrials.gov" && url.pathname === "/api/v2/studies") {
        return jsonResponse({
          studies: [
            {
              protocolSection: {
                identificationModule: { nctId: "NCT00000002", briefTitle: "Example Trial" },
                statusModule: { overallStatus: "RECRUITING", lastUpdatePostDateStruct: { date: "2024-01-02" } },
                designModule: { phases: ["PHASE3"], studyType: "INTERVENTIONAL", enrollmentInfo: { count: 123, type: "ESTIMATED" } },
                sponsorCollaboratorsModule: { leadSponsor: { name: "Example Sponsor", class: "INDUSTRY" } },
              },
            },
          ],
          nextPageToken: "next",
        });
      }
      throw new Error(`Unexpected fetch url: ${url.toString()}`);
    };

    const result = await searchTrials(
      { filters: { indication: "diabetes" }, page_size: 1, sort: { field: "LAST_UPDATE_POSTED", direction: "DESC" } },
      { timeoutMs: 50 },
    );
    assert.equal(result.ok, true);
    assert.equal(result.data.trials.length, 1);
    assert.equal(result.data.trials[0]?.nct_id, "NCT00000002");
    assert.equal(result.data.trials[0]?.brief_title, "Example Trial");
    assert.equal(result.data.trials[0]?.overall_status, "RECRUITING");
    assert.equal(result.data.page.page_size, 1);
    assert.equal(result.data.page.next_page_token, "next");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("happy path: search_pubmed returns ok with empty citations on no matches", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input: any) => {
      const url = new URL(String(input));
      if (url.hostname === "eutils.ncbi.nlm.nih.gov" && url.pathname.endsWith("/esearch.fcgi")) {
        return jsonResponse({ esearchresult: { idlist: [] } });
      }
      throw new Error(`Unexpected fetch url: ${url.toString()}`);
    };

    const result = await searchPubmed({ nct_id: "NCT00000001", retmax: 5, sort: "RELEVANCE" }, { timeoutMs: 50 });
    assert.equal(result.ok, true);
    assert.deepEqual(result.data.citations, []);
    assert.ok(result.data.query_used?.term.includes("NCT00000001"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
