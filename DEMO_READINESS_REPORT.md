# Demo Readiness Report — Public Clinical Trials Intelligence (Task 20)

Date: 2026-01-15  
Workspace: `public-clinical-trials-intelligence`

## Summary (Pass/Fail)

- Install from scratch (per README): **PASS** (validated via a fresh workspace copy + `npm ci`)
- Build + unit tests: **PASS**
- MCP tools schema validation (bad args / no-result / deterministic happy-path): **PASS** (unit tests; mocked fetch)
- End-to-end demo prompts against live upstream APIs: **PARTIAL**
  - In this execution environment, outbound `fetch()` to public APIs failed (`UPSTREAM_ERROR` / `fetch failed`).
- Public artifacts present (README/AGENTS/LICENSE/tool schemas/demo prompts): **PASS**
- Secrets / sensitive content scan: **PASS** (no obvious keys/tokens/private keys found)

## Evidence (Commands + Observed Output)

### Environment

```bash
node -v && npm -v
```

Output:
```text
v22.11.0
10.9.0
```

### Fresh install + tests (simulated “clone from scratch”)

Create a fresh copy (excluding `node_modules/` + `dist/`), then install + test:

```bash
rm -rf .tmp_fresh_copy && mkdir -p .tmp_fresh_copy \
  && rsync -a --exclude '.git' --exclude 'node_modules' --exclude 'dist' --exclude '.tmp_*' ./ .tmp_fresh_copy/
cd .tmp_fresh_copy
npm ci
npm test
```

Observed output excerpts:
```text
added 93 packages in 899ms
```

```text
# pass 10
# fail 0
```

### MCP “stdio” smoke demo (tool listing + first tool call)

```bash
npm run -s smoke:mcp; echo EXIT:$?
```

Observed output excerpt:
```text
tools: [
  'aggregate_trials',
  'compare_trials',
  'get_trial',
  'get_trial_details',
  'get_trial_endpoints',
  'search_pubmed',
  'search_trials'
]
search_trials.ok: false
... "code": "UPSTREAM_ERROR" ... "context": { "error": "fetch failed" } ...
EXIT:1
```

Interpretation: tool wiring and structured error shaping work; live upstream access was not available in this environment.

### Optional MCP “streamable HTTP” smoke demo

```bash
npm run -s smoke:mcp:http; echo EXIT:$?
```

Observed output excerpt:
```text
Error: listen EPERM: operation not permitted 127.0.0.1
EXIT:1
```

Interpretation: this environment disallowed binding a local TCP listener; the HTTP transport is expected to work in a normal local dev environment.

### Secrets scan

```bash
rg -n "(API[_-]?KEY|SECRET|TOKEN|PASSWORD|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|ghp_)" . --hidden --glob '!.git/*'
```

Observed output:
```text
(no matches)
```

## Quick “How To Demo” (Recommended)

Prereqs: Node.js `>=18`, internet access for `clinicaltrials.gov` and `eutils.ncbi.nlm.nih.gov`.

```bash
npm ci
npm run build
npm run mcp:server
```

Then, in your MCP client, copy/paste prompts from `demo_prompts.md` (they include ready-to-use JSON arguments).

Optional smoke checks:
```bash
npm run smoke:mcp        # stdio client -> server -> public APIs
npm run mcp:server:http  # HTTP transport for debugging
```

## Changes Made During This Readiness Pass

- `README.md`: removed an unresolved `git clone https://github.com/<OWNER>/...` placeholder in favor of `git clone <THIS_REPOSITORY_URL>`.
- `scripts/smoke_mcp_server.ts` and `scripts/smoke_clinicaltrials_gov.ts`: fail visibly (non-zero exit) and print structured error JSON when upstream calls fail.
- `scripts/smoke_mcp_http.ts`: made stderr parsing robust to chunking and surfaced server stderr for easier debugging.
- `scripts/tests/edgeCases.test.ts`: added deterministic “happy path” tests (mocked fetch) for `search_trials` and `search_pubmed`.
- `demo_scope.md` and `demo_story.md`: removed organization-specific/internal references to keep the repo public/demo-safe.

## Addendum (2026-01-30)

- Live pagination check against ClinicalTrials.gov via `search_trials` succeeded (page 1 returned `next_page_token`, page 2 fetched with the same params + `page_token`).
