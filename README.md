# MCP Demo Project — Public Clinical Trials Intelligence

## Purpose

This project is a **demo-only implementation of an MCP (Model Context Protocol) server** designed to showcase how LLMs can interact with **structured, trustworthy data sources** in a controlled and auditable way.

The demo is intentionally scoped to **publicly accessible data** and **non-sensitive use cases**, while remaining clearly relevant to pharmaceutical R&D and decision-making contexts (e.g. Lundbeck).

The goal is **not** to build a production system, but to demonstrate:

- Why MCP is superior to ad-hoc RAG or plugins
- How LLMs can reason safely over structured tools
- How the same design could later front internal, regulated systems

---

## What This Is

- A lightweight MCP server exposing a small set of tools
- Tools provide **structured access to public clinical trial data**
- An LLM client uses MCP tools to answer domain-relevant questions
- All answers must be grounded in tool outputs

---

## What This Is NOT

- Not a production system
- Not using internal, proprietary, or sensitive data
- Not making clinical, regulatory, or strategic decisions
- Not a free-text search or document summarization engine

---

## Demo Scope

### Supported Capabilities

- Search public clinical trials by indication, phase, and status
- Retrieve structured trial metadata
- Compare key attributes (e.g. endpoints, populations) across trials
- Produce answers that explicitly reference data sources

### Out of Scope

- Internal Lundbeck systems
- Patient-level data
- Predictive analytics or success likelihoods
- Medical or regulatory advice

---

## Data Sources (Public Only)

- ClinicalTrials.gov (primary source)
- Optional: PubMed abstracts (summary-level only)

All data sources:

- Are publicly accessible
- Require no authentication
- Have clear usage terms suitable for demos

---

## Technical Overview

### Architecture

LLM Client
|
| (MCP tool calls)
v
MCP Server
|
| (structured adapters)
v
Public Data APIs

### Key Principles

- **Strict tool schemas**: inputs and outputs are fully structured
- **No hallucination**: LLM must refuse to answer if data is missing
- **Thin adapters**: data access layers do not interpret or infer
- **Observability**: tool calls and responses are logged
- **Determinism**: same input → same output

---

## MCP Tools (High-Level)

The MCP server exposes a small, stable set of tools such as:

- `search_trials`
- `get_trial_details`
- `get_trial_endpoints`
- `compare_trials`

Each tool:

- Has a single responsibility
- Maps to one data access path
- Returns schema-validated JSON

---

## LLM Behavior Constraints

The LLM must:

- Use MCP tools for all factual claims
- Cite tool outputs in its responses
- Explicitly state when information is unavailable
- Avoid speculation or interpretation beyond data

---

## Success Criteria

The demo is successful if:

1. All demo questions are answered using MCP tools only
2. Outputs are grounded, traceable, and repeatable
3. Failure cases are handled gracefully
4. The value of MCP is clear to both technical and non-technical audiences

---

## Future Extension (Not Implemented)

In a real internal deployment, the same MCP interface could:

- Front internal clinical, safety, or regulatory systems
- Enforce role-based access and audit trails
- Integrate with validated enterprise data sources

This demo is intentionally designed to make that transition obvious.

---
