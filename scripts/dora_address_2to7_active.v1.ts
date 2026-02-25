import fs from "fs";
import path from "path";
import crypto from "crypto";

type Anchor = {
  addressKey: string;
  address?: { street?: string; city?: string; state?: string; zip?: string };
  counts?: { total?: number; active?: number; uniqueNames?: number };
  topNames?: { name: string; count: number }[];
  licenseTypes?: string[];
  statusTop?: { name: string; count: number }[];
  bucket?: string;
};

function sha256(buf: Buffer | string) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function readJson(p: string) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p: string, obj: any) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const txt = JSON.stringify(obj, null, 2);
  fs.writeFileSync(p, txt, "utf8");
  return { bytes: Buffer.byteLength(txt), sha256: sha256(txt) };
}

function num(x: any) {
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
}

function activeRatio(a: Anchor) {
  const t = num(a?.counts?.total);
  const ac = num(a?.counts?.active);
  return t > 0 ? ac / t : 0;
}

function pickTopName(a: Anchor) {
  const t = a.topNames?.[0]?.name || "";
  return t;
}

function computeTier(total: number) {
  if (total >= 25) return "25+";
  if (total >= 13) return "13-24";
  if (total >= 8) return "8-12";
  if (total === 7) return "7";
  if (total >= 4) return "4-6";
  if (total >= 2) return "2-3";
  if (total === 1) return "1";
  return "0";
}

// DEFAULT CONDITIONS (override with env)
const MIN_ACTIVE = num(process.env.VMB_ACTIVE_MIN ?? 2); // hard gate
const SOFT_MIN_RATIO = Number(process.env.VMB_ACTIVE_RATIO_MIN ?? 0); // optional, default off
const MAX_OUT = num(process.env.VMB_2TO7_ACTIVE_MAX ?? 800); // keep UI sane

function passesGate(a: Anchor) {
  const total = num(a?.counts?.total);
  const active = num(a?.counts?.active);
  const unique = num(a?.counts?.uniqueNames);
  const ratio = activeRatio(a);

  // Only 2-7 in this dataset
  if (total < 2 || total > 7) return false;

  // A) Hard: active >= MIN_ACTIVE
  if (active >= MIN_ACTIVE) return ratio >= SOFT_MIN_RATIO;

  // B) Tiny totals exception:
  // If total <= 3, allow active >= 1 and unique >= 2
  if (total <= 3 && active >= 1 && unique >= 2) return ratio >= SOFT_MIN_RATIO;

  return false;
}

function score(a: Anchor) {
  const total = num(a?.counts?.total);
  const active = num(a?.counts?.active);
  const unique = num(a?.counts?.uniqueNames);
  const ratio = activeRatio(a);

  // simple interpretable score (active-first)
  return active * 1000 + ratio * 100 + unique * 10 + total;
}

async function main() {
  const inPath = "data/co/dora/denver_metro/dora/derived/dora_address_rollup.v1.json";
  if (!fs.existsSync(inPath)) {
    console.error(JSON.stringify({ ok: false, error: "missing_input", path: inPath }, null, 2));
    process.exit(1);
  }

  const roll = readJson(inPath);
  const anchors: Anchor[] = roll.anchors || [];

  const all2to7 = anchors
    .filter((a) => {
      const t = num(a?.counts?.total);
      return t >= 2 && t <= 7;
    })
    .map((a) => {
      const total = num(a?.counts?.total);
      const active = num(a?.counts?.active);
      const unique = num(a?.counts?.uniqueNames);
      const ratio = activeRatio(a);

      return {
        addressKey: a.addressKey,
        address: a.address,
        counts: { total, active, uniqueNames: unique },
        activeRatio: Number(ratio.toFixed(4)),
        tier: computeTier(total),
        topName: pickTopName(a),
        topNames: (a.topNames || []).slice(0, 5),
        statusTop: (a.statusTop || []).slice(0, 5),
        licenseTypes: a.licenseTypes || [],
        score: Number(score(a).toFixed(4)),
      };
    });

  const activeFirst = all2to7
    .filter(passesGate)
    .sort(
      (a: any, b: any) =>
        b.counts.active - a.counts.active ||
        b.activeRatio - a.activeRatio ||
        b.counts.uniqueNames - a.counts.uniqueNames ||
        b.counts.total - a.counts.total ||
        b.score - a.score
    );

  const outAll = "data/co/dora/denver_metro/dora/derived/dora_2to7_all.v1.json";
  const outActive = "data/co/dora/denver_metro/dora/derived/dora_2to7_active.v1.json";

  const sourceSha = sha256(fs.readFileSync(inPath));

  const wroteAll = writeJson(outAll, {
    ok: true,
    kind: "dora_2to7_all",
    version: "v1",
    source: { rel: inPath, sha256: sourceSha },
    counts: { rows: all2to7.length },
    rows: all2to7,
    updatedAt: new Date().toISOString(),
  });

  const limited = activeFirst.slice(0, MAX_OUT);
  const wroteActive = writeJson(outActive, {
    ok: true,
    kind: "dora_2to7_active",
    version: "v1",
    knobs: { MIN_ACTIVE, SOFT_MIN_RATIO, MAX_OUT },
    source: { rel: inPath, sha256: sourceSha },
    counts: { in2to7: all2to7.length, pass: activeFirst.length, out: limited.length },
    rows: limited,
    updatedAt: new Date().toISOString(),
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        inPath,
        all2to7: { outAll, ...wroteAll },
        activeFirst: { outActive, ...wroteActive },
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: String(err?.message || err) }, null, 2));
  process.exit(1);
});
