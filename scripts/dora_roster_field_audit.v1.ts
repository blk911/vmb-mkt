import fs from "fs";

const ROSTER_IN = "data/co/dora/denver_metro/dora/derived/dora_roster_index.v1.json";

function main() {
  if (!fs.existsSync(ROSTER_IN)) {
    console.error({ ok: false, error: "missing_roster_index", path: ROSTER_IN });
    process.exit(1);
  }

  const j = JSON.parse(fs.readFileSync(ROSTER_IN, "utf8"));
  const byAddressKey = j.byAddressKey || {};
  const keys = Object.keys(byAddressKey);

  // sample first N addressKeys, first row per key
  const N = 500;
  const fieldCounts: Record<string, number> = {};

  let sampled = 0;
  for (const k of keys) {
    const rows = byAddressKey[k];
    if (!rows?.length) continue;
    const raw = rows[0].raw || {};
    for (const fk of Object.keys(raw)) {
      const v = raw[fk];
      if (v != null && String(v).trim() !== "") {
        fieldCounts[fk] = (fieldCounts[fk] || 0) + 1;
      }
    }
    sampled++;
    if (sampled >= N) break;
  }

  const top = Object.entries(fieldCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([field, count]) => ({ field, count }));

  console.log({ ok: true, sampled, distinctFields: Object.keys(fieldCounts).length });
  console.log(top);
}

main();
