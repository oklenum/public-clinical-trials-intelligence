# Answer Formatting (Demo-Safe)

All assistant responses should include clear provenance so a demo audience can trace every factual statement back to a tool result.

## Required Sections (in order)

```md
## Answer
<tool-grounded answer only>

## Provenance
- Tool: <tool_name>
  - Key fields used (from tool output): <comma-separated JSON paths>

## Data source
- <upstream public source name(s)>

## Evidence
- <verbatim quote(s) from tool outputs>

## Missing data (only if needed)
- <what is missing + minimal tool calls/params to fetch it>
```

## Data source mapping

- ClinicalTrials.gov Data API v2: `search_trials`, `get_trial`, `get_trial_details`, `get_trial_endpoints`, `compare_trials`, `aggregate_trials`
- NCBI PubMed Entrez E-utilities: `search_pubmed`
