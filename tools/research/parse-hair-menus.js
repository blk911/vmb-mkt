const fs = require("fs");
const path = require("path");

const DIR = path.join("data", "research", "hair", "raw_fetches");

function decodeEntities(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function extractBooksy(html, operatorName, sourceUrl) {
  const observations = [];
  const re =
    /"@type"\s*:\s*"Service"[^}]*?"name"\s*:\s*"([^"]+)"[^}]*?"priceCurrency"\s*:\s*"USD"[^}]*?"price"\s*:\s*(\d+(?:\.\d+)?)/g;
  let m;
  while ((m = re.exec(html))) {
    observations.push({
      operatorName,
      sourceUrl,
      source: "booksy_jsonld",
      rawServiceName: m[1],
      priceUsd: Number(m[2]),
      pricingText: `$${m[2]}`,
      pricingModeHint: "fixed",
    });
  }
  // alternate ordering
  const re2 =
    /"name"\s*:\s*"([^"]+)"[^}]*?"@type"\s*:\s*"Offer"[^}]*?"price"\s*:\s*"?(\d+(?:\.\d+)?)"?/g;
  while ((m = re2.exec(html))) {
    if (!observations.find((o) => o.rawServiceName === m[1] && o.priceUsd === Number(m[2]))) {
      observations.push({
        operatorName,
        sourceUrl,
        source: "booksy_offer",
        rawServiceName: m[1],
        priceUsd: Number(m[2]),
        pricingText: `$${m[2]}`,
        pricingModeHint: "fixed",
      });
    }
  }
  return observations;
}

function extractSquareEmbedded(html, operatorName, sourceUrl) {
  const observations = [];
  // HTML-entity encoded JSON blob
  const idx = html.indexOf("&quot;services&quot;:[{");
  if (idx < 0) return observations;
  // take a large chunk and decode
  const chunk = decodeEntities(html.slice(idx, idx + 200000));
  const nameRe = /"name"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g;
  const priceRe = /"price_cents"\s*:\s*(\d+)/g;
  const durationRe = /"duration_minutes"\s*:\s*(\d+)/g;
  const priceTypeRe = /"price_type"\s*:\s*"([^"]+)"/g;
  // Better: find each service object roughly
  const svcBlocks = chunk.split(/\{"id":"/).slice(1);
  for (const block of svcBlocks) {
    const nameM = block.match(/"name"\s*:\s*"([^"]+)"/);
    const priceM = block.match(/"price_cents"\s*:\s*(\d+)/);
    const durM = block.match(/"duration_minutes"\s*:\s*(\d+)/);
    const typeM = block.match(/"price_type"\s*:\s*"([^"]+)"/);
    const descM = block.match(/"description"\s*:\s*"([^"]*)"/);
    if (!nameM || !priceM) continue;
    const name = nameM[1];
    if (/^(Book|Gift|Add on|Addon)$/i.test(name)) continue;
    observations.push({
      operatorName,
      sourceUrl,
      source: "square_embedded",
      rawServiceName: name,
      priceUsd: Number(priceM[1]) / 100,
      durationMinutes: durM ? Number(durM[1]) : null,
      pricingText: `$${(Number(priceM[1]) / 100).toFixed(2)}${typeM ? ` (${typeM[1]})` : ""}`,
      pricingModeHint: typeM ? typeM[1] : "fixed",
      description: descM ? descM[1] : null,
    });
  }
  return observations;
}

function extractVagaroEscaped(html, operatorName, sourceUrl) {
  const observations = [];
  // Look for ServiceName patterns in escaped JSON
  const re = /\\"ServiceName\\":\\"([^\\]+)\\"[^\\]*\\"Price\\":([0-9.]+)/g;
  let m;
  while ((m = re.exec(html))) {
    observations.push({
      operatorName,
      sourceUrl,
      source: "vagaro_escaped",
      rawServiceName: m[1],
      priceUsd: Number(m[2]),
      pricingText: `$${m[2]}`,
      pricingModeHint: "fixed_or_starting",
    });
  }
  const re2 = /\\"ServiceName\\":\\"([^\\]+)\\"/g;
  const names = new Set();
  while ((m = re2.exec(html))) names.add(m[1]);
  if (observations.length === 0 && names.size) {
    for (const n of names) {
      observations.push({
        operatorName,
        sourceUrl,
        source: "vagaro_name_only",
        rawServiceName: n,
        priceUsd: null,
        pricingText: null,
        pricingModeHint: "unknown",
      });
    }
  }
  return observations;
}

function extractKlmSquareSite(html, operatorName, sourceUrl) {
  // Square sites often load services via API; look for item names in JSON
  const observations = [];
  const re = /"name"\s*:\s*"([^"]+)"[^}]{0,400}?"priceMoney"[^}]{0,80}?"amount"\s*:\s*"?(\d+)"?/g;
  let m;
  while ((m = re.exec(html))) {
    observations.push({
      operatorName,
      sourceUrl,
      source: "square_site",
      rawServiceName: m[1],
      priceUsd: Number(m[2]) / 100,
      pricingText: `$${(Number(m[2]) / 100).toFixed(2)}`,
      pricingModeHint: "fixed",
    });
  }
  return observations;
}

const files = [
  {
    file: "the-place-booksy.html",
    operatorName: "The Place Salon",
    sourceUrl:
      "https://booksy.com/en-us/690375_denver-s-best-hairstylist-the-place-salon-michael-eatmon_hair-salon_134761_denver",
    extract: extractBooksy,
  },
  {
    file: "tulip-square.html",
    operatorName: "Tulip’s Salon",
    sourceUrl: "https://squareup.com/appointments/book/3o58drn4pdwabf/RPECVBBEZVZTA/start",
    extract: extractSquareEmbedded,
  },
  {
    file: "hair-moore-vagaro.html",
    operatorName: "Hair & Moore",
    sourceUrl: "https://www.vagaro.com/creatingperfectbeauty/services",
    extract: extractVagaroEscaped,
  },
  {
    file: "onyx-vagaro.html",
    operatorName: "Onyx and Co Salon",
    sourceUrl: "https://www.vagaro.com/onyxandcosalon",
    extract: extractVagaroEscaped,
  },
  {
    file: "perlino-vagaro.html",
    operatorName: "Perlino - Cherry Creek",
    sourceUrl: "https://www.vagaro.com/perlino",
    extract: extractVagaroEscaped,
  },
  {
    file: "onpoint-schedulicity.html",
    operatorName: "On Point Beauty Bar/Vicious Tresses",
    sourceUrl: "https://www.schedulicity.com/scheduling/VTJ97E/services",
    extract: extractVagaroEscaped, // redirected to vagaro
  },
  {
    file: "salongoldyn-schedulicity.html",
    operatorName: "Salon Goldyn",
    sourceUrl: "https://www.schedulicity.com/scheduling/SGKDFZ/services",
    extract: extractVagaroEscaped,
  },
  {
    file: "klm-hair.html",
    operatorName: "KLM Hair Denver",
    sourceUrl: "https://klm-hair.square.site/",
    extract: extractKlmSquareSite,
  },
];

const all = [];
for (const f of files) {
  const html = fs.readFileSync(path.join(DIR, f.file), "utf8");
  const obs = f.extract(html, f.operatorName, f.sourceUrl);
  console.log(f.operatorName, obs.length);
  all.push(...obs.map((o) => ({ ...o, retrievalDate: new Date().toISOString().slice(0, 10) })));
}

fs.writeFileSync(
  path.join("data", "research", "hair", "hair_live_service_raw.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), count: all.length, observations: all }, null, 2),
);
console.log("total", all.length);
