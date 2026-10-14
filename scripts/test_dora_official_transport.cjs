/** One anonymous, read-only official-source smoke test. No real prospects or store writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
const permittedSources = new Set(['src/lib/dora/client.ts', 'src/lib/dora/model.ts', 'src/lib/admin/pipeline/profile-fetch.ts']);
const permittedBuiltins = new Set(['node:dns/promises', 'node:net', 'node:https']);

function load(relative) {
  assert(permittedSources.has(relative), 'Unexpected source dependency in read-only smoke test');
  if (cache.has(relative)) return cache.get(relative).exports;
  const filename = path.join(root, relative), module = { exports: {} };
  cache.set(relative, module);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports, Buffer, URL, Date, AbortController, setTimeout, clearTimeout,
    require(id) {
      if (id === 'server-only') return {};
      if (permittedBuiltins.has(id)) return require(id);
      const stem = id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : path.resolve(path.dirname(filename), id);
      return load(path.relative(root, stem + '.ts'));
    },
  }, { filename });
  return module.exports;
}

async function main() {
  const { fetchDoraCheck } = load('src/lib/dora/client.ts');
  const result = await fetchDoraCheck({ scope: 'person', name: 'Mktdeckszzsyntheticfixture Neverareallicensefixture' });
  // Existing fixed-origin, pinned-DNS, TLS, no-redirect, byte and time limits remain in force.
  // Fail instead of retrying or changing access methods when the official source is unavailable.
  assert.equal(result.outcome, 'no_match', `Official transport did not complete: ${result.outcome}`);
  assert.equal(result.status, 'unknown');
  assert.equal(result.matches.length, 0);
  assert(result.checkedAt, 'A successful source check must carry its check date');
  console.log('Official DORA transport passed: bounded anonymous synthetic-name lookup, no matches, no store writes.');
}
main().catch((error) => { console.error(error instanceof Error ? error.message : 'Official transport smoke failed'); process.exitCode = 1; });
