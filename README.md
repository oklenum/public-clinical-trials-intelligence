# Public Clinical Trials Intelligence (MCP Demo)

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-black)](https://modelcontextprotocol.io/)
![Demo Only](https://img.shields.io/badge/status-demo--only-orange)
![Public Data](https://img.shields.io/badge/data-public-brightgreen)

**A demo MCP (Model Context Protocol) server that lets LLMs query public clinical-trial metadata via structured tools.**  
This repository is intentionally scoped to **public data sources** (no auth, no private datasets) and is meant for learning and demos.

---

## 1) Project Title & Tagline

This project demonstrates **LLM ↔ MCP Server ↔ Public APIs** integration using public clinical trials data (ClinicalTrials.gov primary; PubMed optional).

---

## 2) Overview

**What it is:** a small TypeScript MCP server exposing a handful of schema-validated tools for searching and retrieving clinical trial metadata.  
**Why it exists:** to show how “grounding” can be achieved through deterministic tool calls instead of free-form retrieval.  
**Who it’s for:** developers, AI engineers, and curious readers who want a concrete, runnable MCP example using public data.

> **Design principles**
> - Keep tools small, deterministic, and schema-validated.
> - Prefer traceability over cleverness (every factual claim should come from tool output).
> - Keep adapters “thin” (fetch + normalize; no inference).

---

## 3) Why MCP 🧩

[Model Context Protocol (MCP)](https://modelcontextprotocol.io/) standardizes how models call tools and receive structured results.

Compared to “traditional RAG” or bespoke plugins, MCP makes it easier to:
- Define **stable, typed** interfaces (tool schemas) between an LLM and external systems.
- Keep an **audit-friendly boundary**: tool calls are explicit and loggable.
- Swap clients/transports (e.g., stdio vs HTTP) without changing tool semantics.

> **What this demo shows**
> - How tool schemas constrain what the model can ask for.
> - How a server can enforce validation and return predictable JSON.
> - How to wire public APIs behind an MCP interface.

---

## 4) Architecture Overview 🏗️

```text
┌──────────────┐     MCP tool calls      ┌────────────────────┐     HTTPS      ┌─────────────────────┐
│ LLM / Client  ├───────────────────────►│  MCP Server (Node)  ├──────────────►│ ClinicalTrials.gov  │
└──────────────┘  (stdio or HTTP transport)└────────────────────┘               └─────────────────────┘
                                              │     HTTPS
                                              └──────────────►┌───────────────┐
                                                              │ PubMed (opt.)  │
                                                              └───────────────┘
```

- **Client**: any MCP-capable client (or a custom client; see `scripts/smoke_mcp_server.ts`).
- **Server**: this repo (`src/mcp/server.ts`), validating inputs and returning schema-shaped JSON.
- **Adapters**: thin fetch/normalize layers for public APIs (`src/adapters/*`).

---

## 5) Features

**Capabilities**
- Search ClinicalTrials.gov with structured filters (indication, phase, status, etc.).
- Fetch a full trial record by NCT ID and return normalized JSON.
- Fetch “details” (design/eligibility) and “endpoints” as separate, stable tool calls.
- Compare multiple trials on caller-selected attributes.
- Optional PubMed citation lookup (metadata only).

**Non-features (by design)**
- No private/internal data sources, credentials, or user accounts.
- No “medical reasoning”, clinical advice, regulatory guidance, or decision support.
- No free-text document ingestion, vector DB, embeddings, or RAG pipeline.
- No hosted service; this is intended to run locally.

> **What this demo avoids**
> - “Smart” free-text interpretation or clinical recommendations.
> - Hidden retrieval pipelines (embeddings/vector DB) that blur provenance.
> - Product-grade concerns (auth, multi-tenancy, deployment, SLAs).

---

## 6) Getting Started 🚀

**Prerequisites**
- Node.js `>= 18`
- npm (comes with Node)

**Environment**
- Local machine only (macOS/Linux/Windows)
- Internet access to reach public APIs

**Setup time:** ~2–5 minutes.

---

## 7) Installation 🧰

```bash
git clone https://github.com/<OWNER>/public-clinical-trials-intelligence.git
cd public-clinical-trials-intelligence
npm ci
```

Build once:

```bash
npm run build
```

Start the MCP server (stdio transport; common for desktop MCP clients):

```bash
npm run mcp:server
```

Run a basic demo query without an LLM (spawns a client, lists tools, calls a few tools):

```bash
npm run smoke:mcp
```

Optional: start an HTTP transport for debugging/integration tests:

```bash
npm run mcp:server:http
```

---

## 8) Usage / Demo Examples 🧪

Use these as example “prompts” in an MCP-capable client (or adapt them into tool calls). For a longer set, see `demo_prompts.md`.

- “Find Phase 3 Alzheimer’s trials that are recruiting or completed; return 5 results and show NCT ID, title, phase, status, sponsor, countries count, and last update.”
- “Open `NCT03887455` and summarize phase, status, enrollment, sponsors, dates, and conditions using only tool output.”
- “For `NCT03887455`, list primary and secondary outcomes with timeframes (no interpretation).”
- “Compare `NCT03887455` vs `NCT04437511` on phase, status, enrollment, primary outcomes, and countries.”
- “Aggregate Phase 3 Alzheimer’s trials by overall status and show the top 3 statuses by count.”

Expected behavior:
- The client should invoke tools like `search_trials`, `get_trial`, and `compare_trials`.
- If a claim can’t be grounded in tool output, the model should say so.

---

## 9) Development 🛠️

**Project structure**
- `src/mcp/server.ts`: MCP server entrypoint (stdio + streamable HTTP transports).
- `src/dataAdapter.ts`: tool implementations (orchestrates adapters; minimal logic).
- `src/adapters/*`: API adapters and normalization (ClinicalTrials.gov, PubMed, HTTP).
- `mcp_tool_schemas.json`: canonical tool input schemas (validated at runtime).
- `scripts/*`: smoke tests and local utilities.

**Run in dev mode**

```bash
npm run dev
```

Notes:
- The server logs tool calls to stderr (duration, bytes, and a summary).
- Minimal in-memory caching exists for demo performance; see environment flags below.

**Caching & debugging**
- `DEMO_CACHE_TTL_MS=300000` (default) override cache TTL
- `DEMO_CACHE_DISABLE=1` disable caching
- `DEMO_CACHE_DEBUG=1` log cache hits/coalescing

**Where to add new MCP tools**
1. Add a tool schema in `mcp_tool_schemas.json`.
2. Implement the tool in `src/dataAdapter.ts` (call an adapter and normalize output).
3. Wire it into the tool dispatch in `src/mcp/server.ts`.

---

## 10) Contributing 🤝

This is a **demo-focused** repository. Contributions should be small, readable, and easy to review.

- **Propose changes:** open an issue describing the goal and what you plan to change.
- **PR expectations:** keep diffs scoped; include a short rationale; update docs when behavior changes.
- **Coding expectations:** maintain deterministic tool behavior; validate inputs; keep adapters thin; avoid speculative interpretation.

**Welcome**
- Bug fixes, clearer schemas, better examples/docs, additional public-data tools with tight scope, improved tests (`npm test`).

**Not welcome**
- Features that introduce private data access, authentication flows, or production deployment complexity.
- Medical/clinical/regulatory advice logic or “decision support” features.

---

## 11) Disclaimer ⚠️

This project is a **demo / reference implementation** only.

- Uses **public data sources** and does not include private datasets.
- Not intended for medical, clinical, regulatory, safety, or operational decision-making.
- No warranty; results may be incomplete, outdated, or incorrect.

---

## 12) License 📄

MIT — see `LICENSE`.
