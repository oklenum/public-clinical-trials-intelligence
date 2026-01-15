# Adapters

## ClinicalTrials.gov (`src/adapters/clinicaltrialsGovAdapter.ts`)

### `searchTrials(input)`

**Supported filters (deterministic)**

- `filters.indication`: passed as `query.cond` (condition/indication keyword)
- `filters.query_term`: passed as `query.term` (free-form keyword string; no narrative)
- `filters.phases`: added to `query.term` as `AREA[Phase]...` constraints
- `filters.overall_statuses`: added to `query.term` as `AREA[OverallStatus]...` constraints

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
