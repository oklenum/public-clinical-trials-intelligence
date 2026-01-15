# Demo Scope — Public Clinical Trials Intelligence

## Demo objective (3–5 sentences)

This demo shows an MCP server that gives an LLM **structured, auditable access** to **public clinical trial data** (primarily ClinicalTrials.gov, optionally PubMed abstracts). The LLM must answer questions by calling tools and grounding every factual claim in returned fields, or explicitly refuse when the data is missing. The demo proves that MCP enables repeatable, traceable answers over trusted sources without relying on ad-hoc RAG or free-text search. Success is measured by whether the same question consistently yields the same, source-grounded answer and a clear “cannot answer” path when appropriate.

## User questions the demo must answer well (exactly 5)

1. “Find currently recruiting Phase 2 or Phase 3 trials for `INDICATION` and list each trial’s NCT ID, title, phase, status, sponsor, and locations.”
2. “For NCT `ID`, what are the primary and secondary outcome measures (including time frames), and what is the study design (allocation, masking, arms/interventions)?”
3. “Compare NCT `ID_A` vs NCT `ID_B` on: phase, status, target enrollment, population (key inclusion/exclusion highlights), endpoints, and study duration.”
4. “Which organizations are sponsoring or collaborating on active trials for `INDICATION` in Phase `X`, and how many trials does each organization have?”
5. “For `INDICATION`, what is the distribution of trials by phase and status (e.g., recruiting/active/completed), and which trials were first posted or last updated most recently?”

## Explicit non-goals

- No internal/proprietary data sources (e.g., Lundbeck systems) and no authentication-required datasets.
- No patient-level data, re-identification risk, or linkage to private datasets.
- No clinical, medical, regulatory, or strategic conclusions; the demo reports structured facts only.
- No predictive analytics (e.g., success likelihood, efficacy inference, competitive outcome forecasting).
- No ungrounded summaries: if a claim is not available in tool output, the LLM must say so.
- No production-grade concerns (SLA, full coverage of edge cases, long-term storage, enterprise auth/RBAC), beyond basic logging/auditability for the demo.
