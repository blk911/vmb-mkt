import fs from "fs";

const TECH_IN = "data/co/dora/denver_metro/places/derived/tech_index.v2_2.json";
const ROSTER_IN = "data/co/dora/denver_metro/dora/derived/dora_roster_index.v1.json";

function normKey(k: string) {
  return (k || "")
    .toUpperCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function main() {
  if (!fs.existsSync(TECH_IN)) {
    console.error({ ok: false, error: "missing_tech", path: TECH_IN });
    process.exit(1);
  }
  if (!fs.existsSync(ROSTER_IN)) {
    console.error({ ok: false, error: "missing_roster", path: ROSTER_IN });
    process.exit(1);
  }

  const tech = JSON.parse(fs.readFileSync(TECH_IN, "utf8")).tech || [];
  const roster = JSON.parse(fs.readFileSync(ROSTER_IN, "utf8"));
  const byAddressKey = roster.byAddressKey || {};
  const byAddressKeyBase = roster.byAddressKeyBase || {};

  // Build normalized roster map from exact keys
  const rosterNormMap: Record<string, any[]> = {};
  for (const k of Object.keys(byAddressKey)) {
    const kn = normKey(k);
    rosterNormMap[kn] ||= [];
    rosterNormMap[kn].push(...byAddressKey[k]);
  }

  const misses = tech.filter((t: any) => ((t.rosterJoin?.mode) || "none") === "none");

  const checks = misses.map((t: any) => {
    const exact = !!(t.addressKey && byAddressKey[t.addressKey]?.length);
    const base = !!(t.addressKeyBase && byAddressKeyBase[t.addressKeyBase]?.length);
    const norm = !!(t.addressKeyNorm && rosterNormMap[normKey(t.addressKeyNorm)]?.length);
    return {
      addressKey: t.addressKey,
      addressKeyNorm: t.addressKeyNorm,
      addressKeyBase: t.addressKeyBase,
      exact,
      norm,
      base,
    };
  });

  const summary = {
    ok: true,
    tech: tech.length,
    misses: misses.length,
    missChecks: {
      exactHits: checks.filter((x: any) => x.exact).length,
      normHits: checks.filter((x: any) => x.norm).length,
      baseHits: checks.filter((x: any) => x.base).length,
    },
  };

  console.log(summary);
  console.log(checks);
}

main();
