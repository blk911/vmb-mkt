const path = require("node:path");
const Module = require("node:module");
const fs = require("node:fs");
require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local") });

const origResolve = Module._resolveFilename;
Module._resolveFilename = function patchedResolve(request: string, parent: unknown, isMain: boolean, options: unknown) {
  if (request.startsWith("@/")) {
    const raw = request.slice(2);
    const rootMapped = path.join(process.cwd(), raw);
    const srcMapped = path.join(process.cwd(), "src", raw);
    const pick = (candidate: string): boolean =>
      fs.existsSync(candidate) ||
      fs.existsSync(`${candidate}.ts`) ||
      fs.existsSync(`${candidate}.tsx`) ||
      fs.existsSync(`${candidate}.js`) ||
      fs.existsSync(`${candidate}.json`);
    const mapped = pick(rootMapped) ? rootMapped : srcMapped;
    return origResolve.call(this, mapped, parent, isMain, options);
  }
  return origResolve.call(this, request, parent, isMain, options);
};

const { buildOperatorHarvestQueryPack } = require("../src/lib/social-targets/operator-harvest/query-generator");
const { runOperatorHarvest } = require("../src/lib/social-targets/operator-harvest/run-operator-harvest");

const FIXTURE_OPERATORS = [
  ["Mila Nail Studio", "milanailstudio", "greenwood village", "glossgenius"],
  ["By Ana Nails", "byana.nails", "denver", "booksy"],
  ["Cherry Creek Gel Lab", "cherrycreekgellab", "cherry creek", "fresha"],
  ["Nail Architect Lex", "nailarchitectlex", "centennial", "styleseat"],
  ["DTC Builder Gel Co", "dtcbuildergelco", "dtc", "vagaro"],
  ["Nails by Kira", "nailsbykira.denver", "denver", "glossgenius"],
  ["Lone Tree Nail Loft", "lonetreenailloft", "lone tree", "booksy"],
  ["Englewood Russian Mani", "englewoodrussianmani", "englewood", "fresha"],
  ["Greenwood Nail Artist Maya", "nailartistmaya", "greenwood village", "styleseat"],
  ["DTC Acrylic Atelier", "dtcacrylicatelier", "dtc", "vagaro"],
  ["Nail Haus Denver", "nailhausdenver", "denver", "glossgenius"],
  ["Studio Polished by Rae", "studiopolishedbyrae", "centennial", "booksy"],
  ["Cherry Set Nails", "cherrysetnails", "cherry creek", "styleseat"],
  ["Glossed by Lina", "glossedbylina", "denver", "fresha"],
  ["Gel Method Studio", "gelmethodstudio", "greenwood village", "vagaro"],
  ["Nail Theory DTC", "nailtheorydtc", "dtc", "glossgenius"],
  ["Moxy Nails & Co", "moxynailsco", "denver", "booksy"],
  ["Luxe Mani Room", "luxemaniroom", "centennial", "styleseat"],
  ["Nail Muse by Jo", "nailmusebyjo", "lone tree", "fresha"],
  ["Park Meadows Nail Artist", "parkmeadowsnailartist", "lone tree", "vagaro"],
  ["Nails by Rina GV", "nailsbyrinagv", "greenwood village", "glossgenius"],
  ["Bright Set Studio", "brightsetstudio", "denver", "styleseat"],
  ["The Cuticle Lab", "thecuticlelab", "denver", "booksy"],
  ["Nail Rituals Co", "nailritualsco", "centennial", "fresha"],
  ["DTC Nail Lounge", "dtcnaillounge", "dtc", "vagaro"],
];

function bookingUrl(platform: string, handle: string): string {
  if (platform === "glossgenius") return `https://book.glossgenius.com/${handle}`;
  if (platform === "vagaro") return `https://www.vagaro.com/${handle}`;
  if (platform === "styleseat") return `https://www.styleseat.com/m/${handle}`;
  if (platform === "booksy") return `https://booksy.com/en-us/${handle}`;
  if (platform === "fresha") return `https://www.fresha.com/a/${handle}`;
  return `https://square.site/book/${handle}`;
}

function buildFixtureResultsByQuery(
  queries: Array<{ query: string; targetPlatform: string; geoLabel: string; serviceHint: string }>
): Record<string, Array<{ title: string; url: string; snippet?: string }>> {
  const out: Record<string, Array<{ title: string; url: string; snippet?: string }>> = {};
  for (const query of queries) {
    const geo = query.geoLabel.toLowerCase();
    const items = FIXTURE_OPERATORS.filter((row) => row[2] === geo).slice(0, 6);
    const rows: Array<{ title: string; url: string; snippet?: string }> = [];
    for (const [name, handle, operatorGeo, bookingPlatform] of items) {
      if (query.targetPlatform === "instagram") {
        rows.push({
          title: `${name} (@${handle}) Instagram`,
          url: `https://www.instagram.com/${handle}/`,
          snippet: `${name} ${query.serviceHint} ${operatorGeo}`,
        });
      } else if (["glossgenius", "vagaro", "styleseat", "booksy", "fresha", "square"].includes(query.targetPlatform)) {
        if (query.targetPlatform !== bookingPlatform) continue;
        rows.push({
          title: `${name} | ${bookingPlatform}`,
          url: bookingUrl(bookingPlatform, handle),
          snippet: `${name} booking page ${operatorGeo} ${query.serviceHint}`,
        });
      } else if (query.targetPlatform === "yelp") {
        rows.push({
          title: `${name} - Yelp`,
          url: `https://www.yelp.com/biz/${handle}-${operatorGeo.replace(/\s+/g, "-")}`,
          snippet: `${name} yelp listing ${operatorGeo}`,
        });
      } else {
        rows.push({
          title: `${name} at Sola Salons`,
          url: `https://www.solasalonstudios.com/professionals/${handle}`,
          snippet: `${name} suite operator ${operatorGeo}`,
        });
      }
    }
    out[query.query] = rows;
  }
  return out;
}

function parseArg(name: string, fallback: string): string {
  const exact = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!exact) return fallback;
  const value = exact.split("=").slice(1).join("=").trim();
  if (!value) return fallback;
  return value;
}

async function main() {
  const useFixtures = process.argv.includes("--fixtures");
  const category = "nails";
  const geoLabels = ["DTC", "Greenwood Village", "Denver", "Centennial", "Cherry Creek", "Lone Tree", "Englewood"];
  const maxQueries = Number(parseArg("maxQueries", "30"));
  const resultsPerQuery = Number(parseArg("resultsPerQuery", "5"));
  const requestDelayMs = Number(parseArg("requestDelayMs", "350"));
  const runPromotion = process.argv.includes("--runPromotion");
  const promotionBatchLimit = Number(parseArg("promotionBatchLimit", "50"));

  const pack = buildOperatorHarvestQueryPack({ category, geoLabels, maxQueries });
  const input = {
    category,
    geoLabels,
    maxQueries,
    resultsPerQuery,
    requestDelayMs,
    ...(runPromotion ? { runPromotion: true, promotionBatchLimit } : {}),
    ...(useFixtures ? { queryResultsByQuery: buildFixtureResultsByQuery(pack.queries), useLiveIntake: false } : { useLiveIntake: true }),
  };
  const output = await runOperatorHarvest(input);

  console.log("");
  console.log("OPERATOR HARVEST v1");
  console.log(`Mode: ${useFixtures ? "fixtures" : "live intake"}`);
  console.log(`Queries: ${output.queryPack.queries.length}`);
  console.log(`Total unique prospects: ${output.summary.totalUniqueProspects}`);
  console.log(`With Instagram: ${output.summary.withInstagram}`);
  console.log(`With booking: ${output.summary.withBooking}`);
  console.log(`DM-ready: ${output.summary.dmReadyCount}`);
  console.log("Top prospects:");
  for (const prospect of output.prospects.slice(0, 15)) {
    const ig = prospect.instagramUrl ? "IG" : "-";
    const booking = prospect.bookingUrl ? "BOOKING" : "-";
    console.log(`- ${prospect.name} [${ig}/${booking}] (${prospect.primaryPlatform})`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Operator harvest failed: ${message}`);
  process.exit(1);
});
