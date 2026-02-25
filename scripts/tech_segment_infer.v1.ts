import fs from "fs";
import crypto from "crypto";

const IN_PATH =
  "data/co/dora/denver_metro/places/derived/tech_index.v2_2.json";

const OUT_PATH =
  "data/co/dora/denver_metro/places/derived/tech_index.v3.json";

function sha256(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function ensureDirForFile(p: string) {
  const dir = p.replace(/[\\/][^\\/]+$/, "");
  if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

type Segment = "corp_suite" | "seat_aggreg" | "indie_tech" | "unknown";

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function inferSegment(t: any): {
  segment: Segment;
  confidence: number;
  signals: string[];
} {
  const signals: string[] = [];

  const doraLicenses = Number(t?.techSignals?.doraLicenses ?? 0) || 0;
  const active = Number(t?.rosterSummary?.active ?? 0) || 0;
  const total = Number(t?.rosterSummary?.total ?? doraLicenses) || 0;

  if (doraLicenses <= 0) {
    signals.push("DORA licenses = 0 -> insufficient density signal");
    return { segment: "unknown", confidence: 0.15, signals };
  }

  // Density-based rules (v1)
  if (doraLicenses >= 25) {
    signals.push(`DORA licenses >= 25 (${doraLicenses}) -> corp_suite density`);
    // confidence grows with density above 25 (cap)
    const conf = clamp01(0.75 + Math.min(0.25, (doraLicenses - 25) / 75));
    if (active > 0) signals.push(`Active licenses: ${active}/${total}`);
    return { segment: "corp_suite", confidence: conf, signals };
  }

  if (doraLicenses >= 8) {
    signals.push(`DORA licenses 8-24 (${doraLicenses}) -> seat_aggreg density`);
    // confidence highest around midrange, lower near boundaries (8,24)
    const distFromEdge = Math.min(doraLicenses - 8, 24 - doraLicenses); // 0..8
    const conf = clamp01(0.55 + (distFromEdge / 8) * 0.25); // ~0.55..0.80
    if (active > 0) signals.push(`Active licenses: ${active}/${total}`);
    return { segment: "seat_aggreg", confidence: conf, signals };
  }

  // 1-7
  signals.push(`DORA licenses 1-7 (${doraLicenses}) -> indie_tech density`);
  const conf = clamp01(0.55 + Math.min(0.25, ((doraLicenses - 1) / 6) * 0.25));
  if (active > 0) signals.push(`Active licenses: ${active}/${total}`);
  return { segment: "indie_tech", confidence: conf, signals };
}

function main() {
  if (!fs.existsSync(IN_PATH)) {
    console.error({ ok: false, error: "missing_input", path: IN_PATH });
    process.exit(1);
  }

  const inText = fs.readFileSync(IN_PATH, "utf8");
  const inJson = JSON.parse(inText);
  const tech = (inJson.tech || []) as any[];

  const counts: Record<string, number> = {
    corp_suite: 0,
    seat_aggreg: 0,
    indie_tech: 0,
    unknown: 0,
  };

  for (const t of tech) {
    const out = inferSegment(t);
    t.segment = out.segment;
    t.segmentConfidence = out.confidence;
    t.segmentSignals = out.signals;
    counts[out.segment] = (counts[out.segment] || 0) + 1;
  }

  const outObj = {
    ok: true,
    kind: "tech_index",
    version: "v3",
    source: {
      tech_in: {
        rel: IN_PATH,
        sha256: sha256(inText),
        version: inJson.version,
      },
    },
    counts: {
      tech: tech.length,
      segments: counts,
    },
    tech,
    updatedAt: new Date().toISOString(),
  };

  ensureDirForFile(OUT_PATH);
  const outText = JSON.stringify(outObj, null, 2);
  fs.writeFileSync(OUT_PATH, outText, "utf8");

  console.log({
    ok: true,
    wrote: OUT_PATH,
    counts: outObj.counts,
    sha256: { derived: sha256(outText) },
  });
}

main();
