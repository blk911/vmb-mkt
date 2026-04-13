import "dotenv/config";
import { harvestInstagramHashtag } from "../src/lib/social-targets/ig-hashtag-harvest/harvest";

async function run() {
  const hashtag = process.argv[2] || "denvernails";
  const limitArg = Number(process.argv[3] || "50");
  const limit = Number.isFinite(limitArg) ? limitArg : 50;
  console.log(`\n🚀 IG HARVEST START: #${hashtag}\n`);

  const results = await harvestInstagramHashtag(hashtag, limit);

  console.log(`✅ Posts pulled: ${results.length}\n`);
  results.slice(0, 10).forEach((r, i) => {
    console.log(`${i + 1}. @${r.username} | ${r.weeksAgo} wks | ❤️ ${r.likeCount}`);
  });

  console.log("\n📦 SAMPLE RECORD:\n");
  console.dir(results[0], { depth: null });
}

run().catch((err) => {
  console.error("❌ ERROR:", err);
});
