import fs from "fs";

const TECH_IN = "data/co/dora/denver_metro/places/derived/tech_index.v2_2.json";
const ROSTER_IN = "data/co/dora/denver_metro/dora/derived/dora_roster_index.v1.json";

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
  const byAddressKey = JSON.parse(fs.readFileSync(ROSTER_IN, "utf8")).byAddressKey || {};

  let joined = 0;
  let totalLicensesJoined = 0;

  const density: Array<{ addressKey: string; displayName: string; doraLicenses: number }> = [];

  for (const t of tech) {
    const k = (t.addressKey || "").trim();
    const matches = k ? (byAddressKey[k] || []) : [];
    const n = matches.length || 0;

    if (n > 0) {
      joined++;
      totalLicensesJoined += n;
      density.push({ addressKey: k, displayName: t.displayName, doraLicenses: n });
    }
  }

  density.sort((a, b) => b.doraLicenses - a.doraLicenses);

  console.log({
    ok: true,
    tech: tech.length,
    joined,
    missing: tech.length - joined,
    joinRate: tech.length ? +(joined / tech.length).toFixed(4) : 0,
    totalLicensesJoined,
    top10: density.slice(0, 10),
  });
}

main();
