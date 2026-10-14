/** Isolated route tests. All stores/resolvers are mocked; no Firestore or network calls. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function loadSource(relativePath, imports) {
  const filename = path.resolve(__dirname, "..", relativePath);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  });
  const module = { exports: {} };
  vm.runInNewContext(compiled.outputText, {
    exports: module.exports, module, Buffer, URL, Request, Response,
    require(id) {
      if (!Object.prototype.hasOwnProperty.call(imports, id)) throw new Error(`Unexpected import: ${id}`);
      return imports[id];
    },
  }, { filename });
  return module.exports;
}

async function main() {
  const access = loadSource("src/lib/auth/access.ts", {
    "@/lib/auth/config": { getAdminUser: () => "admin", getConfiguredAuthUser: () => null, getSessionSecret: () => "test-only" },
    "@/lib/auth/session": { SESSION_COOKIE: "test", verifySessionToken: async () => null },
  });
  for (const route of ["/api/source-intake", "/api/source-intake/intake-1", "/api/source-intake/dora-queue/q1/resolve", "/api/source-intake/social-queue/q2/resolve"]) {
    assert.equal(access.isAdminRoute(route), true, `${route} must be admin-only`);
    assert.equal(access.canAccessRoute(route, null), false);
    assert.equal(access.canAccessRoute(route, { username: "member", role: "member" }), false);
    assert.equal(access.canAccessRoute(route, { username: "external", role: "external" }), false);
    assert.equal(access.canAccessRoute(route, { username: "reviewer", role: "admin" }), true);
  }
  assert.equal(access.canAccessRoute("/api/targets/lists", { username: "member", role: "member" }), true);
  assert.equal(access.canAccessRoute("/marketing-decks", null), true);

  for (const lane of ["dora", "social"]) {
    const name = lane === "dora" ? "Dora" : "Social";
    let user = null;
    let reads = 0;
    let writes = 0;
    let options;
    let existing = null;
    let fail = false;
    const route = loadSource(`src/app/api/source-intake/${lane}-queue/[queueItemId]/resolve/route.ts`, {
      "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
      "@/lib/auth/access": { canAccessAdmin: (value) => value?.role === "admin", getSessionUserFromCookieHeader: async () => user },
      "@/lib/source-intake/phase2-store": { [`find${name}ResultByQueueItemId`]: async () => { reads++; return existing; } },
      [`@/lib/source-intake/${lane}-resolver`]: { [`resolve${name}QueueItem`]: async (id, input) => {
        writes++; options = input; if (fail) throw new Error("private datastore details");
        return { id, finalStatus: input.action };
      } },
    });
    async function invoke({ body = '{"action":"approved"}', origin = "https://catalog.example", contentType = "application/json", host, url = "https://catalog.example/api/source-intake/test/resolve" } = {}) {
      const headers = {};
      if (origin !== null) headers.origin = origin;
      if (contentType !== null) headers["content-type"] = contentType;
      if (host !== undefined) headers.host = host;
      const response = await route.POST(new Request(url, { method: "POST", headers, ...(body !== null ? { body } : {}) }), { params: Promise.resolve({ queueItemId: "q1" }) });
      return { status: response.status, body: await response.json(), headers: response.headers };
    }
    for (const [session, expected] of [[null, 401], [{ username: "member", role: "member" }, 403], [{ username: "external", role: "external" }, 403]]) {
      user = session;
      const result = await invoke();
      assert.equal(result.status, expected);
      assert.equal(reads + writes, 0, "unauthorized request must not read or write stores");
    }
    user = { username: "reviewer", role: "admin" };
    for (const request of [{ origin: null }, { origin: "https://attacker.example" }, { host: "bad/host" }]) {
      assert.equal((await invoke(request)).status, 403);
    }
    assert.equal((await invoke({ contentType: "text/plain" })).status, 415);
    assert.equal((await invoke({ body: '"' + "a".repeat(8193) + '"' })).status, 413);
    for (const body of ["{", "null", "[]", '{"unknown":true}', '{"action":"invalid"}', '{"action":"merged"}', '{"action":"merged","mergeTargetId":7}', '{"action":"approved","mergeTargetId":"other-person"}']) {
      assert.equal((await invoke({ body })).status, 400, body);
    }
    assert.equal(reads + writes, 0, "invalid request must not read or write stores");
    const approved = await invoke();
    assert.equal(approved.status, 200);
    assert.equal(options.resolvedBy, "reviewer", "review actor must come from the authenticated session");
    assert.equal(approved.headers.get("cache-control"), "private, no-store");
    assert.equal(approved.headers.get("vary"), "Cookie");
    assert.equal(writes, 1);
    assert.equal((await invoke({ body: '{"action":"merged","mergeTargetId":"target-1"}' })).status, 200);
    assert.equal(options.mergeTargetId, "target-1");
    assert.equal((await invoke({ url: "https://internal.example/api/source-intake/test/resolve", host: "catalog.example" })).status, 200);
    existing = { id: "existing-result" };
    const before = writes;
    assert.equal((await invoke({ body: "{}" })).body.result.id, existing.id);
    assert.equal(writes, before, "read-existing action must not re-resolve");
    fail = true;
    const failed = await invoke();
    assert.equal(failed.status, 503);
    assert.equal(failed.body.error, "resolution_unavailable", "response must not expose datastore internals");
  }
  console.log("Source-intake admin boundaries, origin, input limits, actor attribution, and isolated resolver guards passed.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
