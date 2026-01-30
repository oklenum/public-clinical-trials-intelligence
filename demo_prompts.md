# Demo Prompt Set — Public Clinical Trials Intelligence

Each prompt is designed to reliably exercise a different MCP tool with valid, copy/paste-able tool arguments (no placeholders, no manual edits).

---

## 1) `search_trials` — Shortlist Phase 3 Alzheimer’s trials

**Prompt (copy/paste):**

Use the `search_trials` tool with the exact arguments below, then list the 5 returned trials as a table with: NCT ID, brief title, phase(s), overall status, lead sponsor (name), countries (count), and last update posted. Use the required demo answer format (Answer / Provenance / Data source / Evidence).

```json
{
  "filters": {
    "indication": "alzheimer disease",
    "phases": ["PHASE_3"],
    "overall_statuses": ["RECRUITING", "ACTIVE_NOT_RECRUITING", "COMPLETED"]
  },
  "page_size": 5,
  "sort": { "field": "LAST_UPDATE_POSTED", "direction": "DESC" },
  "include_fields": ["NCT_ID", "BRIEF_TITLE", "PHASES", "OVERALL_STATUS", "SPONSORS", "COUNTRIES", "LAST_UPDATE_POSTED"]
}
```

---

## 2) `search_trials` — Sponsor + phase + year + country (alias coverage)

**Prompt (copy/paste):**

Use the `search_trials` tool with the exact arguments below, then list up to 5 returned trials as a table with: NCT ID, brief title, phase(s), overall status, lead sponsor (name), first posted, and last update posted. Use the required demo answer format (Answer / Provenance / Data source / Evidence).

```json
{
  "filters": {
    "sponsor": "Lundbeck",
    "phase": ["PHASE_2"],
    "status": ["RECRUITING"],
    "first_posted_year": 2024,
    "country": ["US", "DK"]
  },
  "page_size": 5,
  "sort": { "field": "LAST_UPDATE_POSTED", "direction": "DESC" },
  "include_fields": ["NCT_ID", "BRIEF_TITLE", "PHASES", "OVERALL_STATUS", "SPONSORS", "FIRST_POSTED", "LAST_UPDATE_POSTED"]
}
```

---

## 3) `get_trial` — Full authoritative record (single NCT ID)

**Prompt (copy/paste):**

Use the `get_trial` tool for NCT `NCT03887455`. From the returned JSON, extract and report: brief title, official title (if present), overall status, phase(s), study type, start date, primary completion date, completion date, enrollment (count + type if present), lead sponsor (name), and all listed conditions. Use the required demo answer format (Answer / Provenance / Data source / Evidence).

```json
{ "nct_id": "NCT03887455" }
```

---

## 4) `get_trial_details` — Design + eligibility (without outcomes)

**Prompt (copy/paste):**

Use the `get_trial_details` tool for NCT `NCT04437511`. From the returned JSON, extract and report the study design details (allocation, masking, intervention model, primary purpose if present), the arm/intervention summaries, and the key eligibility highlights (age range + a few inclusion/exclusion criteria if present). Use the required demo answer format (Answer / Provenance / Data source / Evidence).

```json
{ "nct_id": "NCT04437511" }
```

---

## 5) `get_trial_endpoints` — Primary/secondary outcomes with timeframes

**Prompt (copy/paste):**

Use the `get_trial_endpoints` tool for NCT `NCT03887455`. List all primary outcomes and all secondary outcomes, including each outcome’s measure and time frame (and description if present). Use the required demo answer format (Answer / Provenance / Data source / Evidence).

```json
{ "nct_id": "NCT03887455" }
```

---

## 6) `compare_trials` — Side-by-side comparison (two NCT IDs)

**Prompt (copy/paste):**

Use the `compare_trials` tool with the exact arguments below. Present a side-by-side table comparing the two trials on: phase(s), overall status, enrollment, primary outcomes, and countries. Use the required demo answer format (Answer / Provenance / Data source / Evidence).

```json
{
  "nct_ids": ["NCT03887455", "NCT04437511"],
  "attributes": ["PHASES", "OVERALL_STATUS", "ENROLLMENT", "OUTCOMES_PRIMARY", "COUNTRIES"]
}
```

---

## 7) `aggregate_trials` — Distribution by overall status

**Prompt (copy/paste):**

Use the `aggregate_trials` tool with the exact arguments below. Report the distribution of Phase 3 Alzheimer’s trials by overall status (status → count). Highlight the top 3 statuses by count. Use the required demo answer format (Answer / Provenance / Data source / Evidence).

```json
{
  "filters": { "indication": "alzheimer disease", "phases": ["PHASE_3"] },
  "group_by": ["OVERALL_STATUS"],
  "metrics": ["COUNT_TRIALS"],
  "limit": 20,
  "sort": { "metric": "COUNT_TRIALS", "direction": "DESC" }
}
```
