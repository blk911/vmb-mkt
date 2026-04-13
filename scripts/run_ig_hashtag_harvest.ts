import "dotenv/config";
import path from "node:path";
import Module from "node:module";

function registerSrcAlias(): void {
  const moduleAny = Module as typeof Module & {
    _resolveFilename: (
      request: string,
      parent: NodeModule | undefined,
      isMain: boolean,
      options?: unknown
    ) => string;
  };
  const originalResolveFilename = moduleAny._resolveFilename;

  moduleAny._resolveFilename = function patchedResolveFilename(
    request: string,
    parent: NodeModule | undefined,
    isMain: boolean,
    options?: unknown
  ): string {
    if (request.startsWith("@/")) {
      const mapped = path.join(process.cwd(), "src", request.slice(2));
      return originalResolveFilename.call(this, mapped, parent, isMain, options);
    }
    return originalResolveFilename.call(this, request, parent, isMain, options);
  };
}

async function main() {
  registerSrcAlias();
  const { runIGHashtagHarvest } = await import("../src/lib/social-targets/ig-hashtag-harvest/run-ig-hashtag-harvest");
  const hashtag = process.argv[2] || "denvernails";
  const limitArg = Number(process.argv[3] || "50");
  const limit = Number.isFinite(limitArg) ? limitArg : 50;

  const result = await runIGHashtagHarvest(hashtag, limit);

  console.log("\nIG HASHTAG HARVEST COMPLETE\n");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("\nIG HASHTAG HARVEST FAILED\n");
  console.error(err);
  process.exit(1);
});
