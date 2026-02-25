import fs from "fs";
import crypto from "crypto";

const IN_PATH = "data/co/dora/denver_metro/dora/derived/dora_roster_index.v1.json";

const OUT_ROLLUP =
  "data/co/dora/denver_metro/dora/derived/dora_address_rollup.v1.json";

const OUT_TOP200 =
  "data/co/dora/denver_metro/dora/derived/dora_address_top200.v1.json";

const TOP_N = Number(process.env.VMB_DORA_TOP_N || "200") || 200;

function sha256(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function ensureDirForFile(p: string) {
  const dir = p.replace(/[\\/][^\\/]+$/, "");
  if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr.filter(Boolean)));
}

function topCounts(items: string[], n = 8) {
  const m = new Map<string, number>();
  for (const x of items) {
    const k = (x || "").trim();
    if (!k) continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return Array.from(m.entries())
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}

function bucket(n: number) {
  if (n >= 25) return "25+";
  if (n >= 8) return "8-24";
  if (n >= 4) return "4-7";
  if (n >= 2) return "2-3";
  if (n === 1) return "1";
  return "0";
}

function main() {
  if (!fs.existsSync(IN_PATH)) {
    console.error({ ok: false, error: "missing_input", path: IN_PATH });
    process.exit(1);
  }

  const inText = fs.readFileSync(IN_PATH, "utf8");
  const roster = JSON.parse(inText);

  const byAddressKey: Record<string, any[]> = roster.byAddressKey || {};
  const keys = Object.keys(byAddressKey);

  // Roll up each addressKey into an anchor object
  const anchors = keys.map((addressKey) => {
    const rows = byAddressKey[addressKey] || [];

    const names = rows.map((r: any) => r.fullName).filter(Boolean);
    const types = rows.map((r: any) => r.licenseType).filter(Boolean);
    const statuses = rows.map((r: any) => r.licenseStatus).filter(Boolean);

    const total = rows.length;
    const active = rows.filter((r: any) =>
      String(r.licenseStatus || "").toUpperCase().includes("ACTIVE")
    ).length;

    // Use the normalized street/city/state/zip that you already wrote into each roster row
    const street = rows[0]?.street || "";
    const city = rows[0]?.city || "";
    const state = rows[0]?.state || "";
    const zip = rows[0]?.zip || "";

    return {
      addressKey,
      address: { street, city, state, zip },
      counts: {
        total,
        active,
        uniqueNames: uniq(names).length,
        uniqueTypes: uniq(types).length,
      },
      topNames: topCounts(names, 8),
      licenseTypes: uniq(types).slice(0, 12),
      // Status breakdown is often noisy, but useful for QA
      statusTop: topCounts(statuses, 6),
      bucket: bucket(total),
      updatedAt: new Date().toISOString(),
    };
  });

  // Deterministic ordering: primarily by total desc, then by addressKey asc
  const sorted = anchors.slice().sort((a, b) => {
    const dt = (b.counts.total || 0) - (a.counts.total || 0);
    if (dt !== 0) return dt;
    return a.addressKey < b.addressKey ? -1 : a.addressKey > b.addressKey ? 1 : 0;
  });

  // Distribution buckets
  const dist: Record<string, number> = { "0": 0, "1": 0, "2-3": 0, "4-7": 0, "8-24": 0, "25+": 0 };
  for (const a of anchors) dist[a.bucket] = (dist[a.bucket] || 0) + 1;

  const rollupObj = {
    ok: true,
    kind: "dora_address_rollup",
    version: "v1",
    source: {
      rel: IN_PATH,
      sha256: sha256(inText),
      records: roster.source?.records ?? null,
      uniqAddressKey: roster.counts?.uniqAddressKey ?? keys.length,
    },
    counts: {
      anchors: anchors.length,
      dist,
      topN: TOP_N,
    },
    anchors: sorted, // full ranked list
    updatedAt: new Date().toISOString(),
  };

  const topN = sorted.slice(0, TOP_N);

  const topObj = {
    ok: true,
    kind: "dora_address_top",
    version: "v1",
    source: {
      rel: OUT_ROLLUP,
      topN: TOP_N,
    },
    counts: {
      anchors: topN.length,
      minTotal: topN.length ? topN[topN.length - 1].counts.total : 0,
      maxTotal: topN.length ? topN[0].counts.total : 0,
    },
    anchors: topN,
    updatedAt: new Date().toISOString(),
  };

  ensureDirForFile(OUT_ROLLUP);
  const rollText = JSON.stringify(rollupObj, null, 2);
  fs.writeFileSync(OUT_ROLLUP, rollText, "utf8");

  ensureDirForFile(OUT_TOP200);
  const topText = JSON.stringify(topObj, null, 2);
  fs.writeFileSync(OUT_TOP200, topText, "utf8");

  console.log({
    ok: true,
    wrote: [OUT_ROLLUP, OUT_TOP200],
    counts: rollupObj.counts,
    top: topObj.counts,
    sha256: {
      rollup: sha256(rollText),
      topN: sha256(topText),
    },
  });
}

main();
