import fs from "fs";
import crypto from "crypto";

const TECH_IN =
  "data/co/dora/denver_metro/places/derived/tech_index.v1_1.json";

const ROSTER_IN =
  "data/co/dora/denver_metro/dora/derived/dora_roster_index.v1.json";

const TECH_OUT =
  "data/co/dora/denver_metro/places/derived/tech_index.v2_2.json";

function sha256(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function ensureDirForFile(p: string) {
  const dir = p.replace(/[\\/][^\\/]+$/, "");
  if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function topCounts(items: string[], n = 5) {
  const m = new Map<string, number>();
  for (const x of items) {
    const k = (x || "").trim();
    if (!k) continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}

function uniq(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function main() {
  if (!fs.existsSync(TECH_IN)) {
    console.error({ ok: false, error: "missing_tech_in", path: TECH_IN });
    process.exit(1);
  }
  if (!fs.existsSync(ROSTER_IN)) {
    console.error({ ok: false, error: "missing_roster_in", path: ROSTER_IN });
    process.exit(1);
  }

  const techText = fs.readFileSync(TECH_IN, "utf8");
  const techJson = JSON.parse(techText);

  const rosterText = fs.readFileSync(ROSTER_IN, "utf8");
  const rosterJson = JSON.parse(rosterText);

  const tech = techJson.tech || [];
  const byAddressKey = rosterJson.byAddressKey || {};
  const byAddressKeyBase = rosterJson.byAddressKeyBase || {};
  const byAddressSummary = rosterJson.byAddressSummary || {};
  // Build a normalized map of roster keys -> rows (in-memory)
  // so we can join on formatting drift without re-materializing the roster index.
  function normKey(k: string) {
    return (k || "").toUpperCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  }

  const rosterNormMap: Record<string, any[]> = {};
  for (const k of Object.keys(byAddressKey)) {
    const kn = normKey(k);
    rosterNormMap[kn] ||= [];
    rosterNormMap[kn].push(...byAddressKey[k]);
  }

  let joined = 0;

  for (const t of tech) {
    const addressKey = (t.addressKey || "").trim();
    const addressKeyNorm = (t.addressKeyNorm || "").trim();
    const addressKeyBase = (t.addressKeyBase || "").trim();

    let matches: any[] = [];
    let joinMode: "exact" | "norm" | "base" | "none" = "none";

    // 1) exact
    if (addressKey && byAddressKey[addressKey]) {
      matches = byAddressKey[addressKey];
      joinMode = "exact";
    }

    // 2) norm (places normalized key vs roster normalized keys)
    if (!matches.length && addressKeyNorm) {
      const kn = normKey(addressKeyNorm);
      if (kn && rosterNormMap[kn]) {
        matches = rosterNormMap[kn];
        joinMode = "norm";
      }
    }

    // 3) base (unit/suite stripped)
    if (!matches.length && addressKeyBase && byAddressKeyBase[addressKeyBase]) {
      matches = byAddressKeyBase[addressKeyBase];
      joinMode = "base";
    }

    t.rosterJoin = { mode: joinMode };

    if (!matches.length) {
      // ensure fields exist, but don't invent data
      t.techSignals ||= {};
      t.techSignals.techCountLicenses = 0;
      t.techSignals.techCountUnique = 0;
      t.techSignals.doraLicenses = 0;
      t.rosterNames = { topNames: [], sample: [] };
      t.rosterLicenseTypes = [];
      t.rosterSummary = { total: 0, active: 0, uniqueNames: 0, uniqueTypes: 0 };
      continue;
    }

    joined++;

    const names = matches.map((m: any) => m.fullName).filter(Boolean);
    const types = matches.map((m: any) => m.licenseType).filter(Boolean);
    const active = matches.filter((m: any) => (m.licenseStatus || "").includes("ACTIVE"));
    const summaryForKey = byAddressSummary[addressKey] || {};
    const uniqueNames = Number(summaryForKey?.uniqueNames ?? uniq(names).length) || 0;

    t.techSignals ||= {};
    t.techSignals.techCountLicenses = matches.length;
    t.techSignals.techCountUnique = uniqueNames;
    t.techSignals.doraLicenses = matches.length;

    // If we have real names, upgrade displayName from "street placeholder"
    const rankedNames = topCounts(names, 5);
    t.rosterNames = {
      topNames: rankedNames,
      sample: uniq(names).slice(0, 10),
    };

    t.rosterLicenseTypes = uniq(types).slice(0, 10);
    t.rosterSummary = {
      total: matches.length,
      active: active.length,
      uniqueNames,
      uniqueTypes: uniq(types).length,
    };
    // Naming policy:
    // - If only 1 licensee at this address, we can safely use the name as displayName.
    // - If multiple licensees, keep the existing displayName (often a place/address placeholder),
    //   and expose the rosterNames.topNames + count in UI.
    if (rankedNames.length === 1 && matches.length === 1) {
      const best = rankedNames[0].name;
      if (best && typeof best === "string") t.displayName = best;
    } else {
      // keep displayName as-is; but ensure it doesn't look like a street-only placeholder if we can improve it lightly
      // (no destructive overwrite)
    }
  }

  const outObj = {
    ok: true,
    kind: "tech_index",
    version: "v2.2",
    source: {
      tech_in: { rel: TECH_IN, sha256: sha256(techText) },
      roster_in: { rel: ROSTER_IN, sha256: sha256(rosterText) },
    },
    counts: {
      tech: tech.length,
      joined,
      missing: tech.length - joined,
    },
    tech,
    updatedAt: new Date().toISOString(),
  };

  ensureDirForFile(TECH_OUT);
  const outText = JSON.stringify(outObj, null, 2);
  fs.writeFileSync(TECH_OUT, outText, "utf8");

  console.log({
    ok: true,
    wrote: TECH_OUT,
    counts: outObj.counts,
    sha256: { derived: sha256(outText) },
  });
}

main();
