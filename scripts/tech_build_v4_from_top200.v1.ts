import fs from "fs";
import crypto from "crypto";

const TECH_V3 = "data/co/dora/denver_metro/places/derived/tech_index.v3.json";
const TOP200 = "data/co/dora/denver_metro/dora/derived/dora_address_top200.v1.json";
const PLACES_TOP200 = "data/co/dora/denver_metro/places/derived/places_top200_enriched.v1.json";

const OUT_V4 = "data/co/dora/denver_metro/places/derived/tech_index.v4.json";

function sha256(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function ensureDirForFile(p: string) {
  const dir = p.replace(/[\\/][^\\/]+$/, "");
  if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function slugify(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function parseAddressKey(addressKey: string) {
  const parts = (addressKey || "").split("|").map((x) => x.trim());
  return {
    street: parts[0] || "",
    city: parts[1] || "",
    state: parts[2] || "",
    zip: parts[3] || "",
  };
}

type Segment = "corp_suite" | "seat_aggreg" | "indie_tech" | "unknown";
type CenterInfo = {
  inCenter: boolean;
  centerName: string | null;
  centerPlaceId: string | null;
  centerSource: "containingPlaces" | "addressDescriptor" | "none";
};

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function inferSegmentFromSignals(doraLicenses: number, placeTypes: string[] | null) {
  const signals: string[] = [];
  const types = (placeTypes || []).map((t) => String(t || "")).filter(Boolean);

  if (!doraLicenses || doraLicenses <= 0) {
    if (types.length) signals.push(`Places types present (${types.slice(0, 5).join(", ")}) but DORA licenses = 0`);
    signals.push("DORA licenses = 0 -> density unavailable");
    // keep unknown but slightly higher confidence if Places suggests salon premise
    const salonish = types.some((t) =>
      /hair|beauty|nail|barber|spa|salon/i.test(t)
    );
    return {
      segment: "unknown" as Segment,
      confidence: salonish ? 0.30 : 0.15,
      signals,
    };
  }

  if (doraLicenses >= 25) {
    signals.push(`DORA licenses >= 25 (${doraLicenses}) -> corp_suite density`);
    const conf = clamp01(0.75 + Math.min(0.25, (doraLicenses - 25) / 75));
    return { segment: "corp_suite" as Segment, confidence: conf, signals };
  }

  if (doraLicenses >= 8) {
    signals.push(`DORA licenses 8-24 (${doraLicenses}) -> seat_aggreg density`);
    const distFromEdge = Math.min(doraLicenses - 8, 24 - doraLicenses); // 0..8
    const conf = clamp01(0.55 + (distFromEdge / 8) * 0.25);
    return { segment: "seat_aggreg" as Segment, confidence: conf, signals };
  }

  signals.push(`DORA licenses 1-7 (${doraLicenses}) -> indie_tech density`);
  const conf = clamp01(0.55 + Math.min(0.25, ((doraLicenses - 1) / 6) * 0.25));
  return { segment: "indie_tech" as Segment, confidence: conf, signals };
}

function safeReadJson(path: string): any | null {
  if (!fs.existsSync(path)) return null;
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

// Places derived schema is user-defined; handle defensively
function loadPlacesMap(): Record<string, any> {
  const j = safeReadJson(PLACES_TOP200);
  if (!j) return {};
  const rows = j.rows || j.anchors || j.items || [];
  const map: Record<string, any> = {};
  for (const r of rows) {
    const k = String(r.addressKey || r.address_key || "").trim();
    if (!k) continue;
    map[k] = r;
  }
  return map;
}

function main() {
  const techV3 = safeReadJson(TECH_V3);
  const top200 = safeReadJson(TOP200);
  const placesMap = loadPlacesMap();

  if (!top200?.anchors?.length) {
    console.error({ ok: false, error: "missing_or_empty_top200", path: TOP200 });
    process.exit(1);
  }

  const existingTech: any[] = techV3?.tech || [];
  const byAddressKeyExisting: Record<string, any> = {};
  for (const t of existingTech) {
    const k = String(t.addressKey || "").trim();
    if (k) byAddressKeyExisting[k] = t;
  }

  const byAddressKeyAnchor: Record<string, any> = {};
  for (const a of top200.anchors) {
    const k = String(a.addressKey || "").trim();
    if (k) byAddressKeyAnchor[k] = a;
  }

  // union of:
  // - existing tech (maybe 30)
  // - top200 anchors (200)
  const allKeys = Array.from(
    new Set([...Object.keys(byAddressKeyExisting), ...Object.keys(byAddressKeyAnchor)])
  ).sort((a, b) => (a < b ? -1 : 1));

  const outTech: any[] = [];
  const segCounts: Record<string, number> = { corp_suite: 0, seat_aggreg: 0, indie_tech: 0, unknown: 0 };

  let withPlaces = 0;
  let withPhone = 0;
  let withWebsite = 0;
  let withTypes = 0;

  for (const addressKey of allKeys) {
    const base = byAddressKeyExisting[addressKey];
    const anchor = byAddressKeyAnchor[addressKey];
    const placeRow = placesMap[addressKey];

    const addr = parseAddressKey(addressKey);
    const id = base?.id || slugify(`${addr.street}-${addr.city}-${addr.state}-${addr.zip}`) || slugify(addressKey);

    // DORA density signals (prefer anchor counts; else whatever base has)
    const doraLicenses =
      Number(base?.techSignals?.techCountLicenses ?? base?.techSignals?.doraLicenses ?? 0) ||
      Number(anchor?.counts?.total ?? 0) ||
      0;
    const techCountUnique =
      Number(base?.techSignals?.techCountUnique ?? base?.rosterSummary?.uniqueNames ?? 0) ||
      Number(anchor?.counts?.uniqueNames ?? 0) ||
      0;

    // Place enrichment (schema-agnostic)
    const pName = placeRow?.candidate?.placeName ?? placeRow?.name ?? placeRow?.displayName ?? placeRow?.best?.name ?? null;
    const pPlaceId = placeRow?.topPlaceId ?? placeRow?.chosenPlaceId ?? placeRow?.placeId ?? placeRow?.place_id ?? placeRow?.best?.placeId ?? placeRow?.best?.place_id ?? null;
    const pTypes = placeRow?.candidate?.types ?? placeRow?.types ?? placeRow?.best?.types ?? null;
    const pPhone = placeRow?.candidate?.phone ?? placeRow?.phone ?? placeRow?.nationalPhoneNumber ?? placeRow?.best?.phone ?? null;
    const pWebsite = placeRow?.candidate?.website ?? placeRow?.website ?? placeRow?.websiteUri ?? placeRow?.best?.website ?? placeRow?.best?.websiteUri ?? null;
    const pLocation = placeRow?.location ?? placeRow?.best?.location ?? null;
    const pScore = Number(placeRow?.candidate?.matchScore ?? placeRow?.score ?? placeRow?.best?.score ?? 0) || 0;
    const center: CenterInfo = placeRow?.center ?? {
      inCenter: false,
      centerName: null,
      centerPlaceId: null,
      centerSource: "none",
    };

    const hasTypes = Array.isArray(pTypes) && pTypes.length > 0;
    const hasPhone = !!(pPhone && String(pPhone).trim());
    const hasWebsite = !!(pWebsite && String(pWebsite).trim());
    const hasPlaces = !!(pPlaceId || pName || hasTypes || hasPhone || hasWebsite || pLocation);

    if (hasPlaces) withPlaces++;
    if (hasPhone) withPhone++;
    if (hasWebsite) withWebsite++;
    if (hasTypes) withTypes++;

    // Safer displayName policy:
    // - keep existing if present and not an address placeholder
    // - else if single-license address: use topNames[0]
    // - else: use Places name if available
    // - else: use street
    const existingName = String(base?.displayName || "").trim();
    const looksLikeAddress = /\d{1,6}\s+\w+/i.test(existingName) && existingName.includes(" ");
    let displayName = existingName && !looksLikeAddress ? existingName : "";

    const topName = anchor?.topNames?.[0]?.name || base?.rosterNames?.topNames?.[0]?.name || "";
    const anchorTotal = Number(anchor?.counts?.total ?? 0) || 0;

    if (!displayName) {
      if (anchorTotal === 1 && topName) displayName = topName;
      else if (pName) displayName = String(pName);
      else displayName = addr.street || addressKey;
    }

    const seg = inferSegmentFromSignals(doraLicenses, hasTypes ? pTypes : null);

    segCounts[seg.segment] = (segCounts[seg.segment] || 0) + 1;

    const merged = {
      // preserve base fields if present
      ...(base || {}),
      id,
      addressKey,
      address: base?.address || addr,
      displayName,

      // Ensure these exist / stay current
      techSignals: {
        ...(base?.techSignals || {}),
        techCountLicenses: doraLicenses,
        techCountUnique,
        doraLicenses,
        // keep current knobs (your earlier pipeline uses these)
        corpSuiteSignal: Number(base?.techSignals?.corpSuiteSignal ?? 0) || 0,
        seatAggregSignal: Number(base?.techSignals?.seatAggregSignal ?? 0) || 0,
        indieTechSignal: Number(base?.techSignals?.indieTechSignal ?? 0) || 0,
      },

      // Ensure roster summaries exist for seeded anchors
      rosterSummary: base?.rosterSummary || (anchor ? {
        total: Number(anchor?.counts?.total ?? doraLicenses) || doraLicenses,
        active: Number(anchor?.counts?.active ?? 0) || 0,
        uniqueNames: Number(anchor?.counts?.uniqueNames ?? 0) || 0,
        uniqueTypes: Number(anchor?.counts?.uniqueTypes ?? 0) || 0,
      } : (base?.rosterSummary || { total: doraLicenses, active: 0, uniqueNames: 0, uniqueTypes: 0 })),

      rosterNames: base?.rosterNames || (anchor ? { topNames: anchor.topNames || [], sample: (anchor.topNames || []).slice(0, 5).map((x: any) => x.name) } : base?.rosterNames),
      rosterLicenseTypes: base?.rosterLicenseTypes || (anchor ? (anchor.licenseTypes || []) : base?.rosterLicenseTypes),

      // Attach Places enrichment (best candidate summary)
      premise: {
        ...(base?.premise || {}),
        // If you want to keep candidates separate, keep this minimal and fast:
        types: hasTypes ? pTypes : (base?.premise?.types || []),
        phone: hasPhone ? pPhone : (base?.premise?.phone ?? null),
        website: hasWebsite ? pWebsite : (base?.premise?.website ?? null),
        matchScore: pScore || (base?.premise?.matchScore ?? 0),
        center,
      },

      places: hasPlaces ? {
        best: {
          placeId: pPlaceId,
          name: pName,
          types: hasTypes ? pTypes : [],
          phone: pPhone,
          website: pWebsite,
          location: pLocation,
          score: pScore,
        },
      } : (base?.places || null),

      // Segment upgrade
      segment: seg.segment,
      segmentConfidence: seg.confidence,
      segmentSignals: seg.signals,

      updatedAt: new Date().toISOString(),
    };

    outTech.push(merged);
  }

  // Deterministic sort: by doraLicenses desc, then place score desc, then addressKey asc
  outTech.sort((a, b) => {
    const da = Number(a?.techSignals?.doraLicenses ?? 0) || 0;
    const db = Number(b?.techSignals?.doraLicenses ?? 0) || 0;
    if (db !== da) return db - da;

    const sa = Number(a?.places?.best?.score ?? 0) || 0;
    const sb = Number(b?.places?.best?.score ?? 0) || 0;
    if (sb !== sa) return sb - sa;

    const ka = String(a.addressKey || "");
    const kb = String(b.addressKey || "");
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  const srcTexts: Record<string, string> = {};
  if (fs.existsSync(TECH_V3)) srcTexts.tech_v3 = fs.readFileSync(TECH_V3, "utf8");
  srcTexts.top200 = fs.readFileSync(TOP200, "utf8");
  if (fs.existsSync(PLACES_TOP200)) srcTexts.places_top200 = fs.readFileSync(PLACES_TOP200, "utf8");

  const outObj = {
    ok: true,
    kind: "tech_index",
    version: "v4",
    source: {
      tech_v3: fs.existsSync(TECH_V3) ? { rel: TECH_V3, sha256: sha256(srcTexts.tech_v3) } : null,
      dora_top200: { rel: TOP200, sha256: sha256(srcTexts.top200) },
      places_top200: fs.existsSync(PLACES_TOP200) ? { rel: PLACES_TOP200, sha256: sha256(srcTexts.places_top200) } : null,
    },
    counts: {
      tech: outTech.length,
      segments: segCounts,
      places: {
        withPlaces,
        withPhone,
        withWebsite,
        withTypes,
      },
    },
    tech: outTech,
    updatedAt: new Date().toISOString(),
  };

  ensureDirForFile(OUT_V4);
  const outText = JSON.stringify(outObj, null, 2);
  fs.writeFileSync(OUT_V4, outText, "utf8");

  console.log({
    ok: true,
    wrote: OUT_V4,
    counts: outObj.counts,
    sha256: { derived: sha256(outText) },
  });
}

main();
