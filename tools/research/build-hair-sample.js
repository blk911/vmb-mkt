const fs = require("fs");
const path = require("path");

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function isJunkUrl(u) {
  if (!u || typeof u !== "string") return true;
  const s = u.toLowerCase();
  return (
    s.includes("vagaro.com/pro") ||
    s.includes("vagaro.com/signup") ||
    s.includes("glossgenius.com/growth") ||
    s.includes("glossgenius.elevio") ||
    s.includes("localdev.com") ||
    s.includes("apps.apple.com") ||
    s.includes("itunes.apple") ||
    /booksy\.com\/en-us\/?$/.test(s) ||
    /\/gift\//.test(s)
  );
}

function isJunkIg(u) {
  if (!u) return true;
  return /instagram\.com\/(vagaropro|booksybiz|glossgenius)\/?$/i.test(u);
}

function pickUrl(...candidates) {
  for (const c of candidates) {
    if (c && !isJunkUrl(c)) return c;
  }
  return null;
}

function pickIg(...candidates) {
  for (const c of candidates) {
    if (c && !isJunkIg(c)) return c;
  }
  return null;
}

const zonePath = "data/markets/beauty_zone_members_enriched_full.json";
const masterPath = "runtime-data/operator_master.v1.json";
const lakePath = "runtime-data/evidence_lake.v1.json";

const zoneRaw = loadJson(zonePath);
const zone = Array.isArray(zoneRaw) ? zoneRaw : zoneRaw.members || zoneRaw.operators || [];
const masterRaw = loadJson(masterPath);
const master = Array.isArray(masterRaw) ? masterRaw : masterRaw.operators || masterRaw.records || [];
let lake = null;
try {
  lake = loadJson(lakePath);
} catch (e) {
  lake = null;
}

const hairZone = zone.filter((r) => r.category === "hair" || r.category === "barber");
const hairMaster = master.filter((r) => {
  const cat = (r.category || r.vertical || r.type || "").toLowerCase();
  return cat === "hair" || cat === "barber" || /hair|stylist|colorist|barber|braid|loc|extension/i.test(JSON.stringify(r).slice(0, 500));
});

// Deduplicate zone by name+city
const seen = new Map();
const deduped = [];
for (const r of hairZone) {
  const key = `${(r.name || "").toLowerCase().trim()}|${(r.city || "").toLowerCase().trim()}`;
  if (seen.has(key)) {
    seen.get(key).dupes += 1;
    continue;
  }
  const booking = pickUrl(r.path_enrichment_booking_url, r.anchor_directory_booking_url, r.booking_url);
  const website = pickUrl(r.path_enrichment_website_url, r.anchor_directory_website_url, r.website_url);
  const ig = pickIg(r.path_enrichment_instagram_url, r.instagram_url, r.anchor_directory_instagram_url);
  const rec = {
    id: r.id || r.operator_id || r.place_id || `zone:${key}`,
    name: r.name,
    city: r.city || null,
    state: r.state || r.region || null,
    zone: r.zone_name || r.zone || null,
    category: r.category,
    subtype: r.subtype || r.operator_subtype || null,
    operatorType: r.subtype || (r.category === "barber" ? "barber" : "hair"),
    booking,
    website,
    ig,
    sourceFile: zonePath,
    confidence: booking || website ? "medium" : ig ? "low-medium" : "low",
    hasUsableSurface: Boolean(booking || website || ig),
    dupes: 0,
  };
  seen.set(key, rec);
  deduped.push(rec);
}

const withWebsite = deduped.filter((r) => r.website);
const withBooking = deduped.filter((r) => r.booking);
const withIg = deduped.filter((r) => r.ig);
const withAnySurface = deduped.filter((r) => r.hasUsableSurface);

// Sample selection: prefer surface diversity
function score(r) {
  let s = 0;
  if (r.booking) s += 5;
  if (r.website) s += 4;
  if (r.ig) s += 2;
  if (r.category === "barber") s += 1;
  if (/suite|booth|chair/i.test(r.subtype || "")) s += 1;
  if (/color|blond|balayage|extension|braid|loc|natural|curly|press/i.test(r.name || "")) s += 2;
  return s;
}

const ranked = [...deduped].sort((a, b) => score(b) - score(a) || (a.name || "").localeCompare(b.name || ""));
const sampleSize = Math.min(100, Math.max(75, Math.min(ranked.length, 90)));
const sample = ranked.slice(0, sampleSize).map((r, i) => ({
  sampleIndex: i + 1,
  operatorId: r.id,
  operatorName: r.name,
  city: r.city,
  state: r.state,
  zone: r.zone,
  operatorType: r.operatorType,
  category: r.category,
  subtype: r.subtype,
  sourceUrl: r.booking || r.website || r.ig,
  bookingUrl: r.booking,
  websiteUrl: r.website,
  instagramUrl: r.ig,
  evidenceType: r.booking ? "booking_profile" : r.website ? "website" : r.ig ? "instagram" : "directory_identity_only",
  serviceText: null,
  pricingText: null,
  confidence: r.confidence,
  retrievalDate: null,
  notes: "Identity/surface from beauty_zone_members_enriched_full; service/pricing text not captured in lake.",
}));

const byCity = {};
for (const r of deduped) {
  const c = r.city || "unknown";
  byCity[c] = (byCity[c] || 0) + 1;
}

const inventory = {
  generatedAt: new Date().toISOString(),
  repo: "C:\\\\dev\\\\_vmb-mkt",
  branch: "research/hair-market-dig",
  datasets: [zonePath, masterPath, lakePath],
  counts: {
    zoneHairOrBarber: hairZone.length,
    zoneDeduped: deduped.length,
    zoneDuplicatesSkipped: hairZone.length - deduped.length,
    masterHairish: hairMaster.length,
    withWebsite: withWebsite.length,
    withBooking: withBooking.length,
    withInstagram: withIg.length,
    withAnyCleanSurface: withAnySurface.length,
    identityOnly: deduped.length - withAnySurface.length,
  },
  geo: byCity,
  sampleSize: sample.length,
};

fs.mkdirSync("data/research/hair", { recursive: true });
fs.writeFileSync("data/research/hair/hair_corpus_counts.json", JSON.stringify(inventory, null, 2));
fs.writeFileSync("data/research/hair/hair_operator_sample.json", JSON.stringify({
  schemaVersion: 1,
  purpose: "Reproducible high-signal Hair operator sample for market dig",
  generatedAt: inventory.generatedAt,
  selectionMethod: "Score by clean booking/website/IG + specialty name signals; take top N from deduped zone hair+barber",
  minTarget: 50,
  preferredTarget: "75-100",
  actualSize: sample.length,
  operators: sample,
}, null, 2));

console.log(JSON.stringify(inventory.counts, null, 2));
console.log("sample", sample.length);
console.log("top cities", Object.entries(byCity).sort((a,b)=>b[1]-a[1]).slice(0,10));
console.log("sample with booking", sample.filter(s=>s.bookingUrl).length);
console.log("sample with website", sample.filter(s=>s.websiteUrl).length);
