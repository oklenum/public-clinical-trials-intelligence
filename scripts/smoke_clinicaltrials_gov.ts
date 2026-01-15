import { getTrial, searchTrials } from "../src/adapters/clinicaltrialsGovAdapter.js";

const search = await searchTrials({
  filters: {
    indication: "diabetes",
  },
  page_size: 2,
  sort: { field: "LAST_UPDATE_POSTED", direction: "DESC" },
});

console.log("searchTrials:", JSON.stringify(search, null, 2));

if (search.ok && search.data.trials[0]?.nct_id) {
  const nctId = search.data.trials[0].nct_id;
  const full = await getTrial({ nct_id: nctId });
  console.log("getTrial:", JSON.stringify(full, null, 2));
}

