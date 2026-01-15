import path from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const serverPath = path.resolve(process.cwd(), "dist/src/mcp/server.js");

const env = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
);

const transport = new StdioClientTransport({
  command: "node",
  args: [serverPath],
  env,
});

const client = new Client(
  { name: "pcti-smoke", version: "0.0.0" },
  { capabilities: {} },
);

await client.connect(transport);
const { tools } = await client.listTools();

console.log("tools:", tools.map((t) => t.name).sort());

async function callToolJson<T = unknown>(name: string, args: Record<string, unknown>) {
  const result = (await client.callTool({ name, arguments: args })) as any;
  const content = Array.isArray(result?.content) ? (result.content as any[]) : [];
  const text = content.find((c: any): c is { type: "text"; text: string } => c?.type === "text")?.text ?? "";
  const parsed = JSON.parse(text) as T;
  return parsed;
}

const search = await callToolJson<any>("search_trials", {
  filters: { indication: "diabetes" },
  page_size: 3,
});

console.log("search_trials.ok:", search?.ok);
if (!search?.ok) {
  console.error("search_trials.error:", JSON.stringify(search, null, 2));
  process.exitCode = 1;
  await client.close();
  process.exit();
}
const nctIds: string[] = search?.ok ? (search?.data?.trials ?? []).map((t: any) => t?.nct_id).filter(Boolean) : [];
console.log("search_trials.nct_ids:", nctIds);

if (nctIds[0]) {
  const trial = await callToolJson<any>("get_trial", { nct_id: nctIds[0] });
  console.log("get_trial.ok:", trial?.ok);
  if (!trial?.ok) {
    console.error("get_trial.error:", JSON.stringify(trial, null, 2));
    process.exitCode = 1;
  }

  const details = await callToolJson<any>("get_trial_details", { nct_id: nctIds[0] });
  console.log("get_trial_details.ok:", details?.ok, "has_outcomes:", Boolean(details?.data?.trial?.outcomes));
  if (!details?.ok) {
    console.error("get_trial_details.error:", JSON.stringify(details, null, 2));
    process.exitCode = 1;
  }

  const endpoints = await callToolJson<any>("get_trial_endpoints", { nct_id: nctIds[0] });
  console.log("get_trial_endpoints.ok:", endpoints?.ok, "outcomes:", (endpoints?.data?.outcomes ?? []).length);
  if (!endpoints?.ok) {
    console.error("get_trial_endpoints.error:", JSON.stringify(endpoints, null, 2));
    process.exitCode = 1;
  }

  const pubmed = await callToolJson<any>("search_pubmed", { nct_id: nctIds[0], retmax: 3, sort: "RELEVANCE" });
  console.log("search_pubmed.ok:", pubmed?.ok, "citations:", (pubmed?.data?.citations ?? []).length);
  if (!pubmed?.ok) {
    console.error("search_pubmed.error:", JSON.stringify(pubmed, null, 2));
    process.exitCode = 1;
  }
}

if (nctIds.length >= 2) {
  const compare = await callToolJson<any>("compare_trials", {
    nct_ids: [nctIds[0], nctIds[1]],
    attributes: ["PHASES", "OVERALL_STATUS", "COUNTRIES"],
  });
  console.log("compare_trials.ok:", compare?.ok);
  if (!compare?.ok) {
    console.error("compare_trials.error:", JSON.stringify(compare, null, 2));
    process.exitCode = 1;
  }

  const aggregate = await callToolJson<any>("aggregate_trials", {
    filters: { indication: "diabetes" },
    group_by: ["PHASE"],
    metrics: ["COUNT_TRIALS"],
    limit: 5,
    sort: { metric: "COUNT_TRIALS", direction: "DESC" },
  });
  console.log("aggregate_trials.ok:", aggregate?.ok, "groups:", (aggregate?.data?.groups ?? []).length);
  if (!aggregate?.ok) {
    console.error("aggregate_trials.error:", JSON.stringify(aggregate, null, 2));
    process.exitCode = 1;
  }
}

await client.close();
