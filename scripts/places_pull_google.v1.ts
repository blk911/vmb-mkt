// scripts/places_pull_google.v1.ts
import fs from "node:fs";
import path from "node:path";

type AnyObj = Record<string, any>;

function repoAbs(rel: string) {
  return path.resolve(process.cwd(), rel);
}
function ensureDirForFile(rel: string) {
  const abs = repoAbs(rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
}
function s(v: any) {
  return String(v ?? "").trim();
}

function loadJson(rel: string): AnyObj {
  const abs = repoAbs(rel);
  if (!fs.existsSync(abs)) return {};
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function loadSeen(rawJsonlRel: string) {
  const abs = repoAbs(rawJsonlRel);
  const seen = new Set<string>();
  if (!fs.existsSync(abs)) return seen;

  const lines = fs.readFileSync(abs, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    try {
      const j = JSON.parse(t);
      const ak = s(j.addressKey);
      if (ak) seen.add(ak);
    } catch {
      // ignore
    }
  }
  return seen;
}

/**
 * TEMP stub: no external calls.
 * It still appends v1.1-shaped events so your downstream parse works.
 */
async function fetchGoogleCandidate(_query: string): Promise<AnyObj> {
  return {
    detailsStatus: "NO_FETCH_WIRED",
    candidate: {
      placeName: "",
      formattedAddress: "",
      website: "",
      phone: "",
      url: "",
      types: [],
      matchScore: 0,
      source: "google_textsearch+details_v1.1",
    },
  };
}

async function main() {
  const queueRel = "data/co/dora/denver_metro/places/queue/places_queue.v1.json";
  const rawRel = "data/co/dora/denver_metro/places/raw/places_raw.v2.jsonl";

  ensureDirForFile(queueRel);
  ensureDirForFile(rawRel);

  const q = loadJson(queueRel);
  const rows: AnyObj[] = Array.isArray(q?.rows) ? q.rows : [];
  const seen = loadSeen(rawRel);

  let pulled = 0;
  let skippedSeen = 0;

  const out = fs.createWriteStream(repoAbs(rawRel), { flags: "a" });

  for (const r of rows) {
    const addressKey = s(r.addressKey);
    const query = s(r.query);

    if (!addressKey || !query) continue;

    if (seen.has(addressKey)) {
      skippedSeen++;
      continue;
    }

    const result = await fetchGoogleCandidate(query);

    const event = {
      ts: new Date().toISOString(),
      addressKey,
      query,
      topPlaceId: s(r.topPlaceId || ""),
      chosenPlaceId: s(r.chosenPlaceId || ""),
      chosenMode: s(r.chosenMode || ""),
      chosenReason: s(r.chosenReason || ""),
      ...result,
    };

    out.write(JSON.stringify(event) + "\n");
    pulled++;
    seen.add(addressKey);
  }

  out.end();

  console.log({
    ok: true,
    counts: { pulled, skippedSeen, inQueue: rows.length },
    cfg: { queueRel, rawRel },
  });
  console.log("APPENDED", rawRel);
}

main().catch((e) => {
  console.error("places:pull failed:", e?.message || e);
  process.exit(1);
});
