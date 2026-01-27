# MCP Tool Inventory (Minimal)

This demo MCP server exposes a small, stable set of **non-overlapping** tools for grounded Q&A over **public clinical trial data** (ClinicalTrials.gov primary, PubMed optional).

| Tool name | One-sentence purpose | Primary user intent |
|---|---|---|
| `search_trials` | Search ClinicalTrials.gov for studies matching structured filters (e.g., condition/indication, phase, status, sponsor, geography) and return NCT IDs plus summary fields. | “Find trials that match criteria and get the shortlist of NCT IDs to inspect.” |
| `get_trial` | Retrieve the full structured record for a single NCT ID (metadata, sponsors, status/dates, design, arms/interventions, eligibility, outcomes/endpoints, locations) as schema-validated JSON. | “Open a specific trial and pull all authoritative fields needed to answer detailed questions.” |
| `compare_trials` | Produce a deterministic, side-by-side comparison for multiple NCT IDs over a caller-selected set of attributes (e.g., phase, status, enrollment, endpoints, population, duration). | “Compare trials A vs B (or many) on specific attributes without free-text interpretation.” |
| `aggregate_trials` | Compute grouped summaries over a query result set (e.g., counts by phase/status/sponsor, top-N sponsors, recent postings/updates) using explicit `group_by` fields and metrics. | “Get distributions and leaderboards from trial search results (counts, breakdowns, recency).” |
| `search_pubmed` | Search PubMed for citations related to an NCT ID or topic and return bibliographic metadata (e.g., PMID, title, journal, year, DOI) without interpretation. | “Find related publications to support follow-up reading while keeping the demo grounded in public metadata.” |

## Defaults and Limits

### `search_trials`

- **Filters:** `indication` → `query.cond`; `query_term` → free term; `phases`, `overall_statuses`, `study_type`, `sponsor_or_collaborator`, `countries`, `first_posted_from/to`, `last_update_posted_from/to`, `start_date_from/to`, `primary_completion_date_from/to`, `completion_date_from/to` encode to ClinicalTrials.gov `AREA[...]` filters (dates as `RANGE[from,to]`).
- **Pagination:** `page_size` defaults to `25` (bounded to `1..100`); use `next_page_token` from the prior response to continue.
- **Sorting:** defaults to `LAST_UPDATE_POSTED` descending for stable ordering.
