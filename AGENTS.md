# AGENTS.md — Agent Operating Guide

This file defines **how autonomous agents should work in this repository** so changes remain safe, predictable, and aligned with the project’s **public, demo-oriented** intent.

## Purpose (Why this exists)

- **For agents/copilots:** clear boundaries for autonomous work in a public MCP demo repo.
- **For human reviewers:** quick, enforceable expectations to review agent-generated changes.
- **How it differs from `README.md`:** `README.md` explains the project and how to run it; `AGENTS.md` governs *how work is performed* and what is in/out of scope.

## Scope & Responsibilities

Agents may:

- Implement and refine MCP tools, adapters, and validation layers.
- Improve demo stability, clarity, and determinism (e.g., better errors, retries, timeouts).
- Update documentation (`README.md`, `mcp_tools_overview.md`, demo docs) to match behavior.
- Add or improve tests, smoke checks, and validation scripts.
- Refactor for readability/maintainability **without changing observable behavior**.

Agents must not:

- Introduce internal, private, or proprietary assumptions (APIs, credentials, datasets, endpoints).
- Add non-public data sources, scraping of gated content, or anything requiring auth/secrets.
- Expand scope beyond “demo MCP server over public metadata” (no productization, no platform work).
- Make medical/clinical/regulatory claims (no advice, diagnosis, efficacy, safety, or success assertions).
- Add hidden retrieval pipelines or opaque inference steps that reduce provenance and traceability.

## Core Operating Rules (Imperative)

- Make **small, incremental** changes; keep PRs and diffs reviewable.
- Preserve **existing behavior** unless the task explicitly requires change.
- Respect **public demo flows**; do not break sample prompts, scripts, or quickstart steps.
- Treat **schemas and contracts** as stable; do not change them casually.
- Document **every behavior change** in the relevant docs and change notes.
- Fail **safely and visibly**: return structured errors, avoid silent fallbacks, and keep logs useful.
- Prefer **determinism over cleverness**: no “smart” guessing; surface uncertainty explicitly.

## Repository Interaction Guidelines

Before changing anything:

- Read the relevant context first: `README.md`, `demo_scope.md`, `tool_usage_rules.md`, and `mcp_tool_schemas.json`.
- Identify whether the change is **code** (behavior) or **docs** (expectations/examples). If both, update both.

TODOs and placeholders:

- Do not leave TODOs that change runtime behavior without a clear rationale and a tracked follow-up.
- Prefer explicit “Not implemented”/“Out of scope” responses over partially working placeholders.

Adding/modifying MCP tools:

- Add new tools only when they materially improve the demo and can be explained succinctly.
- Keep tools **narrow** (single responsibility), schema-validated, and easy to test.
- Update `mcp_tool_schemas.json` and `mcp_tools_overview.md` together when tool surface area changes.

Stop and request clarification when:

- A change could alter tool schemas, outputs, or demo flows in a breaking way.
- The task implies non-public data, credentials, or proprietary integrations.
- The task asks for clinical/medical interpretation rather than metadata retrieval.
- Requirements conflict between docs or expected outputs are ambiguous.

## MCP-Specific Constraints (Non-negotiable)

- MCP tool schemas are **contracts**; do not change inputs/outputs without strong justification and coordinated doc updates.
- Tool outputs must remain **structured and machine-consumable** (JSON objects with stable keys/types).
- Do not bypass MCP tools with free-text reasoning when the answer should come from a tool call.
- Preserve validation and logging; do not remove schema checks, error shaping, or traceability helpers.
- Prefer returning explicit, typed error information over partial/ambiguous “best effort” results.

## Demo Safety & Public Exposure Rules

- Assume **all code, logs, and outputs may be publicly visible** (GitHub, screenshots, live demos).
- Avoid speculation and authoritative language; prefer descriptive wording grounded in tool output.
- Do not present metadata as conclusions (e.g., “works”, “safe”, “effective”, “approved”, “recommended”).
- Do not include or infer personal data; handle any unexpected sensitive fields defensively (omit/redact and explain).

## Change Documentation Expectations

- Update `README.md` when user-facing behavior, setup, or scope changes.
- Update `AGENTS.md` when agent rules or operating assumptions change.
- Leave clear change notes: PR description or commit messages must state *what changed* and *why*, including any behavior change and how it was validated.

## Tone & Style

- Use a professional, neutral, open-source tone.
- Write clearly and concisely; define acronyms on first use.
- Prefer simple, explicit implementations over clever abstractions.

