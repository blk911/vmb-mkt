#!/usr/bin/env node
/**
 * Consolidate Hair market dig observations from identity corpus + live fetches.
 * Does not modify production datasets.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join("data", "research", "hair");
const sample = JSON.parse(fs.readFileSync(path.join(ROOT, "hair_operator_sample.json"), "utf8"));
const counts = JSON.parse(fs.readFileSync(path.join(ROOT, "hair_corpus_counts.json"), "utf8"));
const perlino = JSON.parse(fs.readFileSync(path.join(ROOT, "browser_perlino.json"), "utf8"));
const tulipRaw = JSON.parse(fs.readFileSync(path.join(ROOT, "hair_live_service_raw.json"), "utf8"));

const tulipServices = [];
const seen = new Set();
for (const o of tulipRaw.observations || []) {
  if (o.rawServiceName === "Regular") continue;
  const key = `${o.rawServiceName}|${o.priceUsd}`;
  if (seen.has(key)) continue;
  seen.add(key);
  tulipServices.push({
    operatorName: o.operatorName,
    sourceUrl: o.sourceUrl,
    rawServiceName: o.rawServiceName,
    pricingText: o.pricingText,
    pricingModeHint: o.pricingModeHint,
    priceUsd: o.priceUsd,
    retrievalDate: o.retrievalDate,
    evidenceStrength: "high",
  });
}

const thePlace = {
  operatorName: "The Place Salon",
  sourceUrl:
    "https://booksy.com/en-us/690375_denver-s-best-hairstylist-the-place-salon-michael-eatmon_hair-salon_134761_denver",
  retrievalDate: "2026-07-24",
  services: [
    { rawServiceName: "Female Haircut", pricingText: "SHORT $85 / MEDIUM $95 / LONG $105", pricingModeHint: "tiered", tiers: ["SHORT", "MEDIUM", "LONG"], durationText: "1h" },
    { rawServiceName: "Mens Haircut", pricingText: "$65.00", pricingModeHint: "fixed", durationText: "30min" },
    { rawServiceName: "Partial HighLight Haircut", pricingText: "SHORT $195 / MEDIUM $215 / LONG $235", pricingModeHint: "tiered", tiers: ["SHORT", "MEDIUM", "LONG"] },
    { rawServiceName: "Highlights and Root Color + Cut", pricingText: "SHORT $225 / MEDIUM $240 / LONG $265", pricingModeHint: "tiered" },
    { rawServiceName: "Full head Highlight/Haircut", pricingText: "SHORT $225 / MEDIUM $250 / LONG $275", pricingModeHint: "tiered" },
    { rawServiceName: "All Over Color and Haircut", pricingText: "SHORT $165 / MEDIUM $180 / LONG $200", pricingModeHint: "tiered" },
    { rawServiceName: "All Over Color and Highlight", pricingText: "SHORT $205 / MEDIUM $245 / LONG $275", pricingModeHint: "tiered" },
    { rawServiceName: "Full Head Highlight", pricingText: "SHORT $195 / MEDIUM $215 / LONG $255", pricingModeHint: "tiered" },
    { rawServiceName: "All Over Color/ Blow Dry Style", pricingText: "SHORT $135 / MEDIUM $165 / LONG $195", pricingModeHint: "tiered" },
    { rawServiceName: "Partial HighLight", pricingText: "SHORT $165 / MEDIUM $185 / LONG $225", pricingModeHint: "tiered" },
    { rawServiceName: "Mens Haircut and Color", pricingText: "$115.00", pricingModeHint: "fixed" },
    { rawServiceName: "Shampoo, Conditioner, Blow Dry", pricingText: "$65.00", pricingModeHint: "fixed" },
    { rawServiceName: "Bang Trim", pricingText: "Free (existing clients)", pricingModeHint: "fixed" },
    { rawServiceName: "Base Color and Highlights/Lowlights", pricingText: "Short $195 / Medium $210 / Long $225", pricingModeHint: "tiered" },
    { rawServiceName: "Balyage Highlights", pricingText: "$250.00+", pricingModeHint: "starting_at" },
    { rawServiceName: "Consultation", pricingText: "listed", pricingModeHint: "consultation_required" },
  ],
};

const serviceObservations = [];
const pricingObservations = [];

function addService(op, svc) {
  serviceObservations.push({
    operatorName: op.operatorName,
    sourceUrl: op.sourceUrl,
    rawServiceName: svc.rawServiceName,
    pricingText: svc.pricingText || null,
    pricingModeHint: svc.pricingModeHint || null,
    tier: svc.tier || null,
    unit: svc.unit || null,
    notes: svc.notes || null,
    retrievalDate: op.retrievalDate,
    evidenceStrength: "high",
    evidenceClass: "live_menu_capture",
  });
  if (svc.pricingText) {
    pricingObservations.push({
      operatorName: op.operatorName,
      sourceUrl: op.sourceUrl,
      service: svc.rawServiceName,
      marketLanguage: svc.pricingText,
      pricingMode: svc.pricingModeHint,
      tiers: svc.tiers || null,
      unit: svc.unit || null,
      retrievalDate: op.retrievalDate,
      evidenceStrength: "high",
    });
  }
}

for (const svc of perlino.services) addService(perlino, svc);
for (const svc of thePlace.services) addService(thePlace, svc);
for (const svc of tulipServices) {
  serviceObservations.push({ ...svc, evidenceClass: "live_menu_capture" });
  pricingObservations.push({
    operatorName: svc.operatorName,
    sourceUrl: svc.sourceUrl,
    service: svc.rawServiceName,
    marketLanguage: svc.pricingText,
    pricingMode: svc.pricingModeHint,
    priceUsd: svc.priceUsd,
    retrievalDate: svc.retrievalDate,
    evidenceStrength: "high",
  });
}

// Name-signal operators (identity only — not service menus)
const nameSignals = [];
for (const op of sample.operators) {
  const n = (op.operatorName || "").toLowerCase();
  const tags = [];
  if (/color|blond|balayage|crush/.test(n)) tags.push("color_specialist_name");
  if (/extension|aura/.test(n)) tags.push("extension_specialist_name");
  if (/braid|loc|natural|curly|press|black moon|texture/.test(n)) tags.push("textured_natural_name");
  if (/barber|cut & style|clipper/.test(n)) tags.push("cut_barber_name");
  if (/suite|studio/.test(n) || op.subtype === "suite") tags.push("suite_operator");
  if (tags.length) nameSignals.push({ operatorId: op.operatorId, operatorName: op.operatorName, city: op.city, tags, confidence: "low", note: "Name/subtype signal only; no menu text in corpus" });
}

const taxonomyClusters = [
  {
    clusterId: "cuts_styling",
    label: "Cuts & Styling",
    evidenceOperators: ["Perlino - Cherry Creek", "The Place Salon", "Tulip’s Salon"],
    includedRawNames: ["Medium to Long Haircut", "Pixie Haircut", "Men's Haircut", "Female Haircut", "Blow-Dry", "Bang Trim", "Updo", "Shampoo, Conditioner, Blow Dry", "Long Hair/ Womans Haircut", "Buzz/Clipper Haircut"],
    excludedRawNames: ["braids", "locs", "silk press", "wig install"],
    exclusionReason: "Not observed in live menus of sampled booking URLs; present only as operator-name signals",
  },
  {
    clusterId: "color_lightening",
    label: "Color & Lightening",
    evidenceOperators: ["Perlino - Cherry Creek", "The Place Salon", "Tulip’s Salon"],
    includedRawNames: ["Full Custom Color", "Partial Custom Color", "Mini Custom Color", "Full Highlight", "Partial Highlight", "Root Touch-Up", "Roots to Ends Color", "Glaze", "All Over Color", "Balayage/Ombre", "Balyage Highlights", "Color Retouch"],
    excludedRawNames: ["corrective color packages as separate SKU"],
    exclusionReason: "Corrective/color adjustment seen as $0 or consultation language, not as priced public SKU with modifiers",
  },
  {
    clusterId: "treatments_extensions",
    label: "Treatments & Extensions",
    evidenceOperators: ["Perlino - Cherry Creek", "Tulip’s Salon"],
    includedRawNames: ["Keratin Extension Install", "Weft Install", "Hand Tied Extension Maintenance", "KCMAX Keratin Treatment", "Brazilian/Keratin Blowout", "Deep Conditioning Treatment", "Add-on Scalp Treatment"],
    excludedRawNames: ["sew-in", "wig install", "loc maintenance", "braid styles"],
    exclusionReason: "Not in live captured menus; defer to specialist pack pending more evidence",
  },
];

fs.writeFileSync(
  path.join(ROOT, "hair_service_observations.json"),
  JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      usableMenuOperators: 3,
      observationCount: serviceObservations.length,
      caveat: "Committed VMB marketing evidence lake had empty extracted menus for Hair. Observations below are from live capture of corpus-attached booking URLs only.",
      observations: serviceObservations,
      nameSignals,
      taxonomyClusters,
    },
    null,
    2,
  ),
);

fs.writeFileSync(
  path.join(ROOT, "hair_pricing_observations.json"),
  JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      observationCount: pricingObservations.length,
      modesObserved: {
        fixed: pricingObservations.filter((p) => p.pricingMode === "fixed").length,
        starting_at: pricingObservations.filter((p) => p.pricingMode === "starting_at").length,
        tiered: pricingObservations.filter((p) => p.pricingMode === "tiered").length,
        consultation_required: pricingObservations.filter((p) => p.pricingMode === "consultation_required").length,
        per_unit: pricingObservations.filter((p) => p.pricingMode === "per_unit").length,
      },
      dimensionsObserved: [
        { dimension: "LENGTH_TIER", examples: ["SHORT/MEDIUM/LONG"], operators: ["The Place Salon"], clientSelectable: true, evidenceCount: 1 },
        { dimension: "COVERAGE_TIER", examples: ["mini/partial/full", "partial/full/extra full"], operators: ["Perlino - Cherry Creek"], clientSelectable: true, evidenceCount: 1 },
        { dimension: "FINISH_PACKAGE", examples: ["+ Haircut vs + Blowdry"], operators: ["Perlino - Cherry Creek"], clientSelectable: true, evidenceCount: 1 },
        { dimension: "PRODUCT_BRAND_TIER", examples: ["Davines/K18/Kerastase/Olaplex"], operators: ["Perlino - Cherry Creek"], clientSelectable: true, evidenceCount: 1 },
        { dimension: "EXTENSION_ROW", examples: ["1 row / 2 row maintenance"], operators: ["Perlino - Cherry Creek"], clientSelectable: "mixed", evidenceCount: 1 },
        { dimension: "CONSULTATION_GATE", examples: ["extensions", "keratin", "color change"], operators: ["Perlino - Cherry Creek", "The Place Salon"], clientSelectable: false, evidenceCount: 2 },
        { dimension: "ADD_ON", examples: ["Add-on curls", "Add-on Scalp Treatment", "Beard Trim"], operators: ["Tulip’s Salon"], clientSelectable: true, evidenceCount: 1 },
        { dimension: "OUNCE_BOWL", examples: [], operators: [], clientSelectable: null, evidenceCount: 0, status: "NOT_OBSERVED_IN_LIVE_SAMPLE" },
      ],
      observations: pricingObservations,
    },
    null,
    2,
  ),
);

console.log({
  sample: sample.actualSize,
  services: serviceObservations.length,
  pricing: pricingObservations.length,
  corpus: counts.counts,
});
