# Adapters

## ClinicalTrials.gov (`src/adapters/clinicaltrialsGovAdapter.ts`)

### `searchTrials(input)`

**Supported filters (deterministic)**

- `filters.indication`: passed as `query.cond` (condition/indication keyword)
- `filters.query_term` / `filters.query` / `filters.q`: passed as `query.term` (free-form keyword string; no narrative)
- `filters.sponsor_or_collaborator` / `filters.sponsor` / `filters.lead_sponsor` / `filters.collaborator`: passed as `query.lead` and `query.spons`
- `filters.countries` / `filters.country` / `filters.location_country`: joined with `OR` and passed as `query.locn`
- `filters.overall_statuses` / `filters.status`: passed as `filter.overallStatus` (comma-separated)
- `filters.phases`, `filters.study_type`, and date/year filters: encoded into `filter.advanced` with `AREA[...]` clauses
- `AREA[LocationCountry]...` is only emitted when `query.locn` is not used

**Pagination / bounds**

- `page_size`: defaults to `25`, clamped to `1..100`
- `page_token`: opaque token from the previous response (`next_page_token`)

**Sorting**

- `sort`: defaults to `LAST_UPDATE_POSTED` descending (stable ordering for the same query)
- `sort.field = RELEVANCE`: omits `sort` and relies on upstream relevance ordering

**Field selection (overfetch control)**

- `include_fields`: mapped to ClinicalTrials.gov `fields=...` to limit returned payload
- Default when omitted: `NCT_ID`, titles, status, phases, study type, enrollment, sponsors, conditions, interventions, and key posted/date fields

## Upstream Caching (Demo)

All outbound JSON `GET` requests made via `fetchJson()` (`src/adapters/http.ts`) are cached **in-memory** by request signature (canonical URL + headers + upstream service).

- Default TTL: `DEMO_CACHE_TTL_MS` (defaults to `5` minutes)
- Disable caching: `DEMO_CACHE_DISABLE=1`
- Clear cache in-process: `clearFetchJsonCache()` (process restart also clears it)
