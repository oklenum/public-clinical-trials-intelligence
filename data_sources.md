# Public Data Sources (Demo)

This demo uses **only free, public, unauthenticated** data sources. No API keys, accounts, or paid/licensed datasets are required.

## 1) ClinicalTrials.gov — Data API v2 (Primary)

- **URL (docs):** https://clinicaltrials.gov/data-api/api
- **URL (API base):** https://clinicaltrials.gov/api/v2/
- **Example endpoints:** `GET /studies` (search/list), `GET /studies/{nctId}` (record)

**Data coverage**

- Trial registry records for studies registered in ClinicalTrials.gov (global scope, but not a complete registry of all trials worldwide).
- Structured study metadata (e.g., identifiers, sponsors, conditions, interventions, eligibility, locations, dates, status) and posted results when available.

**Rate limits**

- No explicit numeric rate limit is published in the API documentation; requests may be **throttled** under high load.
- Demo guidance: keep requests modest (cache responses, use pagination, and back off/retry on `429`/transient errors).

**Known limitations**

- Not all global trials are registered; coverage depends on sponsor/jurisdiction and compliance.
- Data quality varies (many fields are sponsor-entered/free text); some fields may be missing or outdated.
- Results reporting is incomplete—many studies do not post results or post them with delays.
- Records can change over time; implement stable snapshots/caching if you need repeatable outputs for a demo.

**Free + unauthenticated check**

- API responds without credentials (e.g., `curl 'https://clinicaltrials.gov/api/v2/studies?query.term=diabetes&pageSize=1'`).

---

## 2) NCBI PubMed — Entrez E-utilities (Optional, bibliographic metadata only)

- **URL (docs):** https://www.ncbi.nlm.nih.gov/books/NBK25497/
- **URL (API base):** https://eutils.ncbi.nlm.nih.gov/entrez/eutils/
- **Example endpoints:** `esearch.fcgi` (query → PMIDs), `esummary.fcgi` (record summaries), `efetch.fcgi` (record details)

**Data coverage**

- PubMed bibliographic metadata (citations, journal info, dates, authors) and identifiers (e.g., PMID, DOI where available).
- Abstract text exists for many (not all) records, but to avoid copyright ambiguity this demo should treat abstracts as **display-only** and prefer metadata-only outputs.

**Rate limits**

- Without an API key: **≤ 3 requests/second** per IP (NCBI guidance).
- API keys can raise the default ceiling to **≤ 10 requests/second**, but this demo stays **unauthenticated** (no keys).

**Known limitations**

- Not all records have abstracts; indexing and MeSH annotation can lag behind publication.
- NCBI may block clients that exceed usage policies; include `tool` and `email` parameters and batch requests where possible.
- Abstract text may incorporate copyrighted material; avoid redistribution and keep usage within demo display contexts.

**Free + unauthenticated check**

- API responds without credentials (e.g., `curl 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=diabetes&retmode=json&retmax=1'`).

