/**
 * Independent synthetic-only compact catalog / DORA regressions.
 * No real prospects, live requests, credentials, production writes or publishing.
 * Run with: node scripts/test_compact_dora_adversarial.cjs
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const clone = (value) => JSON.parse(JSON.stringify(value));
const forbidden = () => { throw new Error('Live network/database access is forbidden in this synthetic test.'); };
const compiled = new Map();

function loader(overrides = {}, globals = {}) {
  const cache = new Map();
  function load(relative) {
    const full = path.resolve(root, relative);
    assert(full.startsWith(root + path.sep), 'Hermetic loader must stay inside the repository.');
    if (cache.has(full)) return cache.get(full).exports;
    const module = { exports: {} };
    cache.set(full, module);
    let source = compiled.get(full);
    if (!source) {
      source = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
        fileName: full,
      }).outputText;
      compiled.set(full, source);
    }
    vm.runInNewContext(source, {
      module, exports: module.exports, URL, URLSearchParams, Date, Buffer, structuredClone,
      Request, Response, Headers, TextEncoder, TextDecoder, ReadableStream,
      setTimeout, clearTimeout, AbortController, AbortSignal, fetch: forbidden,
      console: { log() {}, warn() {}, error() {} }, process: { env: {} }, ...globals,
      require(id) {
        if (Object.hasOwn(overrides, id)) return overrides[id];
        if (id === 'server-only') return {};
        if (id === '@/lib/admin/firestoreAdmin') return { adminDb: forbidden };
        if (id === 'node:dns/promises') return { lookup: forbidden };
        if (id === 'node:https' || id === 'https' || id === 'node:http') return { request: forbidden, get: forbidden };
        if (['node:crypto', 'node:net', 'node:path'].includes(id)) return require(id);
        if (id === 'react' || id === 'react/jsx-runtime') return require(id);
        if (id.endsWith('.module.css')) return new Proxy({}, { get: (_, key) => String(key) });
        if (id.startsWith('@/') || id.startsWith('.')) {
          const stem = id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : path.resolve(path.dirname(full), id);
          const target = ['.ts', '.tsx', '.js'].map((extension) => stem + extension).find(fs.existsSync);
          if (!target) throw new Error(`Missing imported module: ${id}`);
          return load(path.relative(root, target));
        }
        throw new Error(`Unexpected import in hermetic test: ${id}`);
      },
    }, { filename: full });
    return module.exports;
  }
  return load;
}

const tests = [];
const test = (name, run) => tests.push({ name, run });
const context = { checkedAt: '2026-10-14T16:00:00.000Z', datasetUpdatedAt: '2026-10-12T04:00:00.000Z' };
const claim = (prefix = 'MAN', number = '999900001') => ({ prefix, number, sourceRef: 'synthetic-source:independent-license' });
const person = (extra = {}) => ({ scope: 'person', name: 'Avery Synthetic', firstName: 'Avery', lastName: 'Synthetic', city: 'Synthetic City', state: 'CO', postalCode: '00000', ...extra });
const official = (extra = {}) => ({
  licensetype: 'MAN', licensenumber: '999900001', firstname: 'Avery', middlename: '', lastname: 'Synthetic', suffix: '', entityname: '',
  city: 'Synthetic City', state: 'CO', mailzipcode: '00000', licensestatusdescription: 'Active', licenseexpirationdate: '2027-03-31T00:00:00.000',
  linktoverifylicense: { url: 'https://apps2.colorado.gov/dora/licensing/Lookup/LicenseLookup.aspx' }, ...extra,
});
const stronglyIdentified = (extra = {}) => person({ licenseClaims: [claim()], ...extra });
const notConfirmed = (check, reason) => assert(!['active', 'expired'].includes(check.status), reason || 'Unresolved identity must not become a confirmed license status.');
let model;

test('pure DORA model contract is available', () => {
  model = loader()('src/lib/dora/model.ts');
  assert.equal(typeof model.matchDoraRecords, 'function');
  assert.equal(typeof model.buildDoraQuery, 'function');
});
const match = (subject, rows, extraContext = {}) => model.matchDoraRecords(subject, rows, { ...context, ...extraContext });

test('name-only match never establishes an active or expired license', () => {
  notConfirmed(match(person({ city: '', state: '', postalCode: '' }), [official()]));
});
test('city-only input never establishes identity', () => {
  notConfirmed(match(person({ name: '', firstName: '', lastName: '' }), [official()]));
});
test('surname-only input never establishes identity', () => {
  notConfirmed(match(person({ name: 'Synthetic', firstName: '', lastName: 'Synthetic' }), [official()]));
});
test('full name plus mailing location remains a review candidate', () => {
  notConfirmed(match(person(), [official()]));
});
test('a license number without corroborating name never confirms identity', () => {
  notConfirmed(match(stronglyIdentified({ name: '', firstName: '', lastName: '' }), [official()]));
});
test('exact prefix and number with full-name corroboration can establish active', () => {
  const subject = stronglyIdentified(), rows = [official()], before = JSON.stringify({ subject, rows });
  const result = match(subject, rows);
  assert.equal(result.status, 'active');
  assert.equal(result.outcome, 'matched');
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].identity, 'corroborated');
  assert.equal(JSON.stringify({ subject, rows }), before, 'Matcher must not mutate any source input.');
});
test('exact number with a different full name is not a confirmed license', () => {
  notConfirmed(match(stronglyIdentified(), [official({ firstname: 'Blair' })]));
});
test('wrong prefix with same numeric license remains unconfirmed', () => {
  notConfirmed(match(stronglyIdentified({ licenseClaims: [claim('COS')] }), [official()]));
});
test('a person license never becomes a shop registration', () => {
  const shop = { scope: 'shop', name: 'Synthetic Studio', city: 'Synthetic City', state: 'CO', postalCode: '00000', licenseClaims: [claim()] };
  notConfirmed(match(shop, [official({ entityname: 'Synthetic Studio' })]));
});
test('a REG shop registration never becomes a person license', () => {
  notConfirmed(match(stronglyIdentified({ licenseClaims: [claim('REG')] }), [official({ licensetype: 'REG', entityname: 'Avery Synthetic' })]));
});
test('an exact REG number and business name can establish a separate shop registration', () => {
  const subject = { scope: 'shop', name: 'Synthetic Studio', city: 'Synthetic City', state: 'CO', postalCode: '00000', licenseClaims: [claim('REG')] };
  const result = match(subject, [official({ licensetype: 'REG', firstname: '', lastname: '', entityname: 'Synthetic Studio' })]);
  assert.equal(result.status, 'active');
  assert.equal(result.matches[0].licensePrefix, 'REG');
});
test('multiple strong license matches are ambiguous', () => {
  const result = match(stronglyIdentified({ licenseClaims: [claim(), claim('COS', '999900002')] }), [official(), official({ licensetype: 'COS', licensenumber: '999900002' })]);
  notConfirmed(result);
  assert.equal(result.outcome, 'ambiguous');
});
test('an exact duplicate official row is deduplicated without inventing ambiguity', () => {
  const result = match(stronglyIdentified(), [official(), official()]);
  assert.equal(result.status, 'active');
  assert.equal(result.matches.length, 1);
});
test('contradictory duplicate official statuses fail closed', () => {
  const result = match(stronglyIdentified(), [official(), official({ licensestatusdescription: 'Suspended' })]);
  notConfirmed(result);
  assert(result.conflicts.length || result.matches.some((row) => row.conflicts.length), 'Contradiction must remain visible.');
});
for (const status of ['', 'Unknown', 'Pending', 'Inactive', 'Probation', 'Conditional', 'Active - Restricted', 'Suspended', 'Surrendered', 'Revoked', 'Denied', 'Cancelled']) {
  test(`status ${JSON.stringify(status)} is never silently promoted to active/expired`, () => {
    const result = match(stronglyIdentified(), [official({ licensestatusdescription: status })]);
    notConfirmed(result);
  });
}
test('explicit expired official status is distinct from revoked or suspended', () => {
  const result = match(stronglyIdentified(), [official({ licensestatusdescription: 'Expired', licenseexpirationdate: '2026-03-31T00:00:00.000' })]);
  assert.equal(result.status, 'expired');
  assert.equal(result.matches[0].statusText, 'Expired');
});
test('active official status with a past expiration date requires review', () => {
  notConfirmed(match(stronglyIdentified(), [official({ licenseexpirationdate: '2025-03-31T00:00:00.000' })]));
});
test('expired official status with a future expiration date requires review', () => {
  notConfirmed(match(stronglyIdentified(), [official({ licensestatusdescription: 'Expired' })]));
});
test('invalid provided expiration date cannot support a confirmed status', () => {
  notConfirmed(match(stronglyIdentified(), [official({ licenseexpirationdate: 'not-a-date' })]));
});
test('a partial/truncated result cannot confirm a unique match', () => {
  notConfirmed(match(stronglyIdentified(), [official()], { truncated: true }));
});
test('no result means not found in this search, never unlicensed', () => {
  const result = match(stronglyIdentified(), []);
  assert.equal(result.status, 'unknown');
  assert.equal(result.outcome, 'no_match');
  assert(result.reasons.some((reason) => /does not mean unlicensed/i.test(reason)), 'Explicitly disclaim a licensing conclusion from absence.');
});

const client = loader()('src/lib/dora/client.ts');
const now = () => Date.parse(context.checkedAt);
const publicAddress = [{ address: '93.184.216.34', family: 4 }];
function requestFixture({ rows = [official()], statusCode = 200, headers = {}, body, resolve } = {}) {
  const calls = [];
  const deps = {
    now,
    resolve: resolve || (async (host) => { assert.equal(host, 'data.colorado.gov'); return publicAddress; }),
    request: async (request) => { calls.push(request); return { statusCode, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? JSON.stringify(rows) : body }; },
  };
  return { calls, deps };
}
test('official fetch is fixed-origin, bounded, anonymous, and preserves independent timestamps', async () => {
  const { calls, deps } = requestFixture({ headers: { 'X-SODA2-Truth-Last-Modified': context.datasetUpdatedAt } });
  const result = await client.fetchDoraCheck(stronglyIdentified(), deps);
  assert.equal(result.status, 'active');
  assert.equal(result.checkedAt, context.checkedAt);
  assert.equal(result.datasetUpdatedAt, context.datasetUpdatedAt);
  assert.equal(calls.length, 1);
  const request = calls[0];
  assert.equal(request.url.origin, 'https://data.colorado.gov');
  assert.equal(request.url.pathname, '/resource/7s5z-vewr.json');
  assert.equal(request.url.username + request.url.password, '');
  assert.equal(request.maxBytes, 256 * 1024);
  assert(request.timeoutMs > 0 && request.timeoutMs <= 8000);
  assert(Number(request.url.searchParams.get('$limit')) <= 21);
  assert.equal(request.headers, undefined, 'No cookie, auth token or app credential is supplied by this path.');
});
test('missing data-update time is not invented from lookup time', async () => {
  const { deps } = requestFixture();
  assert.equal((await client.fetchDoraCheck(stronglyIdentified(), deps)).datasetUpdatedAt, undefined);
});
for (const statusCode of [301, 302, 307, 308, 401, 403, 429]) test(`HTTP ${statusCode} stops without credentials, redirect or bypass`, async () => {
  const { calls, deps } = requestFixture({ statusCode, headers: { location: 'https://attacker.example/collect' } });
  const result = await client.fetchDoraCheck(stronglyIdentified(), deps);
  assert.equal(result.status, 'unknown');
  assert.equal(result.outcome, 'blocked');
  assert.equal(calls.length, 1);
  assert.equal(result.matches.length, 0);
});
for (const statusCode of [404, 500, 503]) test(`HTTP ${statusCode} cannot become a negative licensing conclusion`, async () => {
  const { deps } = requestFixture({ statusCode });
  const result = await client.fetchDoraCheck(stronglyIdentified(), deps);
  assert.equal(result.status, 'unknown');
  assert.notEqual(result.outcome, 'no_match');
});
for (const [name, body, headers] of [
  ['HTML login', '<html>Sign in to continue</html>', { 'content-type': 'text/html' }],
  ['invalid JSON', '[{', {}],
  ['error object', '{"error":"try again"}', {}],
  ['malformed record', '[null]', {}],
  ['changed field type', JSON.stringify([official({ licensenumber: 999900001 })]), {}],
  ['missing required identity fields', '[{}]', {}],
  ['oversize payload', ' '.repeat(256 * 1024 + 1), {}],
]) test(`${name} fails closed without a no-match result`, async () => {
  const { deps } = requestFixture({ body, headers });
  const result = await client.fetchDoraCheck(stronglyIdentified(), deps);
  assert.equal(result.status, 'unknown');
  assert.notEqual(result.outcome, 'no_match');
  assert.equal(result.matches.length, 0);
});
test('truncated official response remains ambiguous, never clean no-match', async () => {
  const { deps } = requestFixture({ rows: Array.from({ length: 21 }, (_, index) => official({ licensenumber: String(999900001 + index) })) });
  const result = await client.fetchDoraCheck(stronglyIdentified(), deps);
  assert.equal(result.status, 'review');
  assert.equal(result.outcome, 'ambiguous');
  assert.equal(result.truncated, true);
});
test('mixed private/public DNS fails before making a request', async () => {
  const { calls, deps } = requestFixture({ resolve: async () => [...publicAddress, { address: '127.0.0.1', family: 4 }] });
  const result = await client.fetchDoraCheck(stronglyIdentified(), deps);
  assert.equal(result.outcome, 'blocked');
  assert.equal(calls.length, 0);
});
test('DNS family mismatch fails before making a request', async () => {
  const { calls, deps } = requestFixture({ resolve: async () => [{ address: '93.184.216.34', family: 6 }] });
  const result = await client.fetchDoraCheck(stronglyIdentified(), deps);
  assert.equal(result.outcome, 'blocked');
  assert.equal(calls.length, 0);
});
test('transport failure never implies not found', async () => {
  const result = await client.fetchDoraCheck(stronglyIdentified(), { now, resolve: async () => publicAddress, request: async () => { throw new Error('private synthetic internals'); } });
  assert.equal(result.outcome, 'error');
  assert.equal(result.status, 'unknown');
  assert(!JSON.stringify(result).includes('private synthetic internals'));
});
test('expired global time budget makes no lookup', async () => {
  let calls = 0;
  const result = await client.fetchDoraCheck(stronglyIdentified(), { now, resolve: async () => { calls++; return publicAddress; }, request: forbidden }, now() - 1);
  assert.equal(result.outcome, 'unavailable');
  assert.equal(calls, 0);
});
test('a hanging request is bounded and aborted', async () => {
  let signal;
  const result = await client.fetchDoraCheck(stronglyIdentified(), { now, resolve: async () => publicAddress, request: async (request) => { signal = request.signal; return new Promise(() => {}); } }, now() + 10);
  assert.equal(result.outcome, 'unavailable');
  assert.equal(signal.aborted, true);
});
test('insufficient name input performs no broad city lookup', async () => {
  let calls = 0;
  const result = await client.fetchDoraCheck(person({ name: '', firstName: '', lastName: '' }), { now, resolve: async () => { calls++; return publicAddress; }, request: forbidden });
  assert.equal(result.outcome, 'insufficient_identity');
  assert.equal(calls, 0);
});
test('query escaping cannot change a name into executable SoQL clauses', () => {
  const injected = "Avery' OR 1=1 --";
  const url = model.buildDoraQuery(person({ name: `${injected} Synthetic`, firstName: injected, lastName: 'Synthetic' }));
  if (url === null) return;
  const query = new URL(url);
  assert.equal(query.origin, 'https://data.colorado.gov');
  const where = query.searchParams.get('$where');
  const outsideLiterals = where.replace(/'(?:[^']|'')*'/g, "''");
  assert(!outsideLiterals.includes('1=1'));
  assert(!outsideLiterals.includes('--'));
  assert.equal(Number(query.searchParams.get('$limit')), 21);
});
test('lookup time and official data-update time stay distinct', () => {
  const result = match(stronglyIdentified(), [official()]);
  assert.equal(result.checkedAt, context.checkedAt);
  assert.equal(result.datasetUpdatedAt, context.datasetUpdatedAt);
  assert.notEqual(result.checkedAt, result.datasetUpdatedAt);
});
test('untrusted official-row links cannot masquerade as official verification destinations', () => {
  for (const url of ['javascript:alert(1)', 'https://colorado.gov.attacker.example/license', 'https://attacker.example/license', 'https://user:password@dpo.colorado.gov/license']) {
    const result = match(stronglyIdentified(), [official({ linktoverifylicense: { url } })]);
    for (const entry of result.matches) {
      const destination = new URL(entry.sourceUrl);
      assert.equal(destination.protocol, 'https:');
      assert.equal(destination.username + destination.password, '');
      assert(['apps2.colorado.gov', 'dpo.colorado.gov', 'dora.colorado.gov', 'data.colorado.gov'].includes(destination.hostname));
    }
  }
});


for (const statusCode of [302, 403, 429, 503]) test(`HTTP ${statusCode} records an attempt, never a completed official check`, async () => {
  const { deps } = requestFixture({ statusCode });
  const result = await client.fetchDoraCheck(stronglyIdentified(), deps);
  assert.equal(result.checkedAt, undefined);
  assert.equal(result.attemptedAt, context.checkedAt);
});
test('insufficient input has no official checked timestamp', async () => {
  const result = await client.fetchDoraCheck(person({ name: '', firstName: '', lastName: '' }), { now, resolve: forbidden, request: forbidden });
  assert.equal(result.checkedAt, undefined);
});
for (const address of ['10.0.0.1', '169.254.169.254', '172.16.1.1', '192.168.1.1', '0.0.0.0', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1']) test(`private address ${address} never reaches transport`, async () => {
  const { deps, calls } = requestFixture({ resolve: async () => [{ address, family: require('node:net').isIP(address) }] });
  const result = await client.fetchDoraCheck(stronglyIdentified(), deps);
  assert.equal(result.outcome, 'blocked');
  assert.equal(calls.length, 0);
});

const projection = loader()('src/lib/dora/projection.ts');
const catalogId = 'provider:adminPipelineParsedCandidates:synthetic-document';
const catalogRow = (extra = {}) => ({ id: catalogId, entityType: 'provider', providerName: 'Avery Synthetic', businessName: 'Synthetic Studio', city: 'Synthetic City', state: 'CO', postalCode: '00000', sourceIdentifiers: { candidateId: 'synthetic-candidate', intakeId: 'synthetic-intake' }, reviewDecisions: [], doraLicenseClaims: { personLicense: [claim()], shopRegistration: [] }, ...extra });
function modernRecord(row = catalogRow(), extra = {}) {
  return { schemaVersion: 1, catalogId: row.id, fingerprint: projection.doraCatalogFingerprint(row), runId: 'synthetic-run', completedAt: new Date().toISOString(), nextAttemptAt: new Date(Date.now() + 86_400_000).toISOString(), dora: { schemaVersion: 1, personLicense: match(stronglyIdentified(), [official({ licenseexpirationdate: '2999-03-31T00:00:00.000' })], { checkedAt: new Date().toISOString() }), shopRegistration: model.emptyDoraCheck() }, ...extra };
}
test('modern exact-input evidence projects without source mutation', () => {
  const row = catalogRow(), record = modernRecord(row), before = JSON.stringify({ row, record });
  assert.equal(projection.projectDoraCrossReference(row, [record]).personLicense.status, 'active');
  assert.equal(JSON.stringify({ row, record }), before);
});
test('changed catalog identity invalidates a saved modern head', () => {
  const row = catalogRow(), record = modernRecord(row);
  assert.equal(projection.projectDoraCrossReference({ ...row, providerName: 'Blair Synthetic' }, [record]).personLicense.status, 'unknown');
});
test('another catalog ID cannot borrow a matching modern head', () => {
  const row = catalogRow(), record = modernRecord(row, { catalogId: 'provider:adminPipelineParsedCandidates:other' });
  assert.equal(projection.projectDoraCrossReference(row, [record]).personLicense.status, 'unknown');
});
test('manual rejection invalidates a prior active head without altering review', () => {
  const row = catalogRow(), record = modernRecord(row), reviewed = { ...row, reviewDecisions: [{ id: 'synthetic-review', lane: 'DORA', status: 'rejected', reviewedAt: new Date().toISOString() }] }, before = JSON.stringify(reviewed);
  notConfirmed(projection.projectDoraCrossReference(reviewed, [record]).personLicense);
  assert.equal(JSON.stringify(reviewed), before);
});
test('fresh head never overrides an existing manual rejection', () => {
  const row = catalogRow({ reviewDecisions: [{ id: 'synthetic-review', lane: 'DORA', status: 'rejected' }] }), record = modernRecord(row);
  const check = projection.projectDoraCrossReference(row, [record]).personLicense;
  notConfirmed(check); assert(check.conflicts.some((reason) => /manual review/i.test(reason)));
});
test('stale official check preserves evidence but demotes active badge', () => {
  const row = catalogRow(), record = modernRecord(row, { nextAttemptAt: new Date(Date.now() - 1).toISOString() });
  const check = projection.projectDoraCrossReference(row, [record]).personLicense;
  assert.equal(check.status, 'review'); assert.equal(check.matches.length, 1); assert.equal(check.matches[0].statusText, 'Active');
});
for (const nextAttemptAt of ['', 'not-a-date', undefined]) test(`invalid modern freshness ${JSON.stringify(nextAttemptAt)} cannot confirm status`, () => {
  const row = catalogRow(), record = modernRecord(row, { nextAttemptAt });
  notConfirmed(projection.projectDoraCrossReference(row, [record]).personLicense);
});
for (const mutate of [
  (check) => { check.matches = []; },
  (check) => { check.matches[0].identity = 'review'; },
  (check) => { check.matches[0].statusText = 'Suspended'; },
  (check) => { check.matches[0].conflicts.push('Conflicting full name'); },
  (check) => { check.checkedAt = undefined; },
]) test(`malformed saved active head fails closed: ${mutate.toString()}`, () => {
  const row = catalogRow(), record = modernRecord(row); mutate(record.dora.personLicense);
  notConfirmed(projection.projectDoraCrossReference(row, [record]).personLicense);
});
test('historical active_match is evidence for Review, never independent proof', () => {
  const data = { matchStatus: 'active_match', licenseStatus: 'Active', licenseStatusText: 'Active', matchedLicenseName: 'Avery Synthetic', matchedLicenseNumber: 'MAN.999900001', licenseType: 'MAN', finalStatus: 'approved' }, before = JSON.stringify(data);
  const check = projection.legacyDoraCrossReference([{ data }]).personLicense;
  assert.equal(check.status, 'review'); assert.equal(check.matches[0].statusText, 'Active'); assert.equal(check.checkedAt, undefined); assert.equal(JSON.stringify(data), before);
});
test('independent explicit license claim is scoped and retains its provenance', () => {
  const result = projection.independentDoraClaims({ displayName: 'Avery Synthetic', sourceUrl: 'https://synthetic.example.org/about', licenseNumber: 'MAN.999900001' }, 'synthetic-candidate', 'person');
  assert.equal(result.length, 1); assert.equal(result[0].prefix, 'MAN'); assert(result[0].sourceRef.includes('synthetic.example.org'));
});
for (const [sourceUrl, sourceType] of [
  ['https://data.colorado.gov/resource/7s5z-vewr.json', ''], ['https://dpo.colorado.gov/license', ''], ['https://apps.state.co.us/license', ''], ['https://synthetic.example.org', 'DORA imported'], ['https://user:password@synthetic.example.org', ''],
]) test(`prior DORA or credentialed source cannot self-corroborate: ${sourceUrl} ${sourceType}`, () => {
  assert.equal(projection.independentDoraClaims({ displayName: 'Avery Synthetic', sourceUrl, sourceType, licenseNumber: 'MAN.999900001' }, 'synthetic-source', 'person').length, 0);
});
test('another person in raw source cannot supply an independent license claim', () => {
  assert.equal(projection.independentDoraClaims({ displayName: 'Avery Synthetic', sourceUrl: 'https://synthetic.example.org', rawBlock: JSON.stringify({ name: 'Blair Synthetic', licenseNumber: 'MAN.999900001' }) }, 'synthetic-source', 'person').length, 0);
});
test('independent person and shop claims cannot cross scopes', () => {
  assert.equal(projection.independentDoraClaims({ sourceUrl: 'https://synthetic.example.org', licenseNumber: 'REG.999900001' }, 'synthetic-source', 'person').length, 0);
  assert.equal(projection.independentDoraClaims({ sourceUrl: 'https://synthetic.example.org', registrationNumber: 'MAN.999900001' }, 'synthetic-source', 'shop').length, 0);
});

function routeFixture({ user = { role: 'admin' }, allowed = true, refresh } = {}) {
  const calls = [];
  const route = loader({
    'next/server': { NextResponse: { json: (body, init) => new Response(JSON.stringify(body), { ...init, headers: { 'content-type': 'application/json', ...init?.headers } }) } },
    '@/lib/auth/access': { getSessionUserFromCookieHeader: async () => user, canAccessAdmin: () => allowed },
    '@/lib/dora/runner': { refreshCatalogDora: async (ids) => { calls.push(clone(ids)); return refresh ? refresh(ids) : ids.map((id) => ({ catalogId: id, status: 'completed' })); } },
  })('src/app/api/catalog/dora/refresh/route.ts');
  const request = (options = {}) => {
    const { body = JSON.stringify({ catalogIds: [catalogId] }), origin = 'https://synthetic.example.org', contentType = 'application/json', host, url = 'https://synthetic.example.org/api/catalog/dora/refresh' } = options;
    const headers = {}; if (origin !== null) headers.origin = origin; if (contentType !== null) headers['content-type'] = contentType; if (host) headers.host = host;
    return new Request(url, { method: 'POST', headers, body });
  };
  return { route, request, calls };
}
for (const [name, user, allowed, expected] of [['anonymous', null, false, 401], ['non-admin', { role: 'user' }, false, 403]]) test(`refresh route rejects ${name} before work`, async () => {
  const { route, request, calls } = routeFixture({ user, allowed });
  const response = await route.POST(request()); assert.equal(response.status, expected); assert.equal(calls.length, 0); assert.match(response.headers.get('cache-control'), /no-store/);
});
for (const origin of [null, 'https://evil.example.org', 'null', 'http://synthetic.example.org']) test(`refresh route rejects origin ${origin}`, async () => {
  const { route, request, calls } = routeFixture(); assert.equal((await route.POST(request({ origin }))).status, 403); assert.equal(calls.length, 0);
});
test('refresh route accepts proxy-internal URL only with the actual same browser Host origin', async () => {
  const { route, request, calls } = routeFixture();
  assert.equal((await route.POST(request({ url: 'https://internal.invalid/api/catalog/dora/refresh', host: 'synthetic.example.org' }))).status, 200); assert.equal(calls.length, 1);
});
for (const contentType of [null, 'text/plain', 'application/x-www-form-urlencoded']) test(`refresh route rejects content type ${contentType}`, async () => {
  const { route, request, calls } = routeFixture(); assert.equal((await route.POST(request({ contentType }))).status, 415); assert.equal(calls.length, 0);
});
for (const body of ['null', '[]', '{', '{}', '{"catalogIds":[]}', JSON.stringify({ catalogIds: [catalogId], url: 'https://evil.example.org' }), JSON.stringify({ catalogIds: ['wrong:source:id'] }), JSON.stringify({ catalogIds: [catalogId + '\u0001'] }), JSON.stringify({ catalogIds: [catalogId + 'x'.repeat(512)] }), JSON.stringify({ catalogIds: Array(11).fill(catalogId) })]) test(`refresh route rejects malformed payload ${body.slice(0, 65)}`, async () => {
  const { route, request, calls } = routeFixture(); assert.equal((await route.POST(request({ body }))).status, 400); assert.equal(calls.length, 0);
});
test('refresh route enforces actual streamed bytes without trusting Content-Length', async () => {
  const { route, request, calls } = routeFixture(); assert.equal((await route.POST(request({ body: JSON.stringify({ catalogIds: [catalogId] }) + ' '.repeat(8192) }))).status, 413); assert.equal(calls.length, 0);
});
test('refresh route returns bounded results without leaking internal exceptions', async () => {
  const { route, request } = routeFixture({ refresh: () => { throw new Error('synthetic-secret-internal'); } });
  const response = await route.POST(request()); assert.equal(response.status, 503); assert(!(await response.text()).includes('synthetic-secret-internal'));
});

function storeFixture(initial = {}) {
  const data = new Map(Object.entries(clone(initial))), committed = [];
  const reference = (collection, id) => ({ key: `${collection}/${id}`, async get() { return { data: () => data.get(this.key) }; } });
  const db = { collection: (collection) => ({ doc: (id) => reference(collection, id) }), runTransaction: async (work) => {
    const pending = [], tx = { get: async (ref) => ({ data: () => clone(data.get(ref.key) || null) }), set: (ref, value) => pending.push(['set', ref.key, clone(value)]), create: (ref, value) => { if (data.has(ref.key)) throw new Error('immutable run already exists'); pending.push(['create', ref.key, clone(value)]); } };
    const result = await work(tx); for (const [kind, key, value] of pending) { data.set(key, value); committed.push({ kind, key, value }); } return result;
  } };
  const store = loader({ '@/lib/admin/firestoreAdmin': { adminDb: () => db } })('src/lib/dora/store.ts');
  return { data, committed, store };
}
const controlKey = 'adminPipelineDoraRefreshControl/official-dataset';
test('store lease blocks concurrent refresh and preserves a post-release cooldown', async () => {
  const { store, data } = storeFixture(); const token = await store.claimDoraRefresh(); assert.equal(typeof token, 'string'); assert.equal(await store.claimDoraRefresh(), null);
  const held = clone(data.get(controlKey)); await store.releaseDoraRefresh('wrong-token'); assert.deepEqual(data.get(controlKey), held);
  await store.releaseDoraRefresh(token); assert.equal(await store.claimDoraRefresh(), null);
});
test('immutable run and current head are the only data saved by DORA', async () => {
  const { store, committed } = storeFixture(); const token = await store.claimDoraRefresh(), record = modernRecord(), before = JSON.stringify(record); await store.saveDoraCrossReference(record, token);
  const writes = committed.filter((entry) => entry.key !== controlKey);
  assert.equal(writes.length, 2); assert(writes.some((entry) => entry.kind === 'create' && entry.key === `adminPipelineDoraCrossReferenceRuns/${record.runId}`));
  assert(writes.some((entry) => entry.key.startsWith('adminPipelineDoraCrossReferences/'))); assert.equal(JSON.stringify(record), before);
  assert.deepEqual(clone(await store.readDoraCrossReference(record.catalogId)), clone(record));
  const count = committed.length; await assert.rejects(store.saveDoraCrossReference(record, token)); assert.equal(committed.length, count);
});
for (const [name, expiresAt, token] of [['expired', new Date(Date.now() - 1).toISOString(), 'synthetic-token'], ['changed token', new Date(Date.now() + 90_000).toISOString(), 'other-token'], ['invalid expiry', 'not-a-date', 'synthetic-token']]) test(`store rejects ${name} lease before any result write`, async () => {
  const { store, committed } = storeFixture({ [controlKey]: { token, expiresAt } });
  await assert.rejects(store.saveDoraCrossReference(modernRecord(), 'synthetic-token')); assert.equal(committed.length, 0);
});

function runnerFixture({ rows = [catalogRow()], prior = null, token = 'synthetic-token', fetchResult, failSave = false } = {}) {
  const calls = { fetch: [], save: [], release: [], read: [] };
  const runner = loader({
    '@/lib/catalog/store': { loadSharedCatalog: async () => ({ rows }) },
    './client': { fetchDoraCheck: async (subject) => { calls.fetch.push(clone(subject)); return fetchResult ? fetchResult(subject, calls.fetch.length) : subject.scope === 'person' ? match(stronglyIdentified(), [official()]) : model.emptyDoraCheck(); } },
    './store': { claimDoraRefresh: async () => token, readDoraCrossReference: async (id) => { calls.read.push(id); return prior; }, saveDoraCrossReference: async (record, owner) => { if (failSave) throw new Error('synthetic-store-failure'); calls.save.push({ record: clone(record), owner }); }, releaseDoraRefresh: async (owner) => { calls.release.push(owner); } },
  })('src/lib/dora/runner.ts');
  return { calls, runner };
}
test('runner cannot work when global lease is busy', async () => {
  const { runner, calls } = runnerFixture({ token: null }); const result = await runner.refreshCatalogDora([catalogId]); assert.equal(result[0].status, 'busy'); assert.equal(calls.fetch.length + calls.save.length + calls.release.length, 0);
});
test('runner deduplicates catalog IDs, preserves source identity, and releases lease', async () => {
  const row = catalogRow(), before = JSON.stringify(row), { runner, calls } = runnerFixture({ rows: [row] }); const result = await runner.refreshCatalogDora([catalogId, catalogId]);
  assert.equal(result.length, 1); assert.equal(result[0].status, 'completed'); assert.equal(calls.save.length, 1); assert.equal(calls.save[0].owner, 'synthetic-token'); assert.equal(calls.save[0].record.catalogId, row.id); assert.equal(calls.save[0].record.candidateKey, JSON.stringify(['synthetic-intake', 'synthetic-candidate'])); assert.deepEqual(calls.release, ['synthetic-token']); assert.equal(JSON.stringify(row), before);
});
test('runner reuses only exact-fingerprint unexpired cache', async () => {
  const { runner, calls } = runnerFixture({ prior: modernRecord() }); const result = await runner.refreshCatalogDora([catalogId]); assert.equal(result[0].status, 'cached'); assert.equal(calls.fetch.length + calls.save.length, 0);
});
test('runner ignores stale-fingerprint cache and never reuses a different identity', async () => {
  const { runner, calls } = runnerFixture({ prior: modernRecord(catalogRow({ providerName: 'Blair Synthetic' })) }); const result = await runner.refreshCatalogDora([catalogId]); assert.equal(result[0].status, 'completed'); assert.equal(calls.save.length, 1);
});
test('runner stops remaining source requests after first access block', async () => {
  const other = catalogRow({ id: catalogId + '-other' }), { runner, calls } = runnerFixture({ rows: [catalogRow(), other], fetchResult: () => ({ ...model.emptyDoraCheck(), outcome: 'blocked', attemptedAt: context.checkedAt }) });
  const result = await runner.refreshCatalogDora([catalogId, other.id]); assert.equal(calls.fetch.length, 1); assert.equal(result[1].status, 'skipped'); assert.equal(calls.save.length, 1); assert(calls.save[0].record.dora.personLicense.outcome === 'blocked');
});
test('runner save failure is not reported as successful and always releases lease', async () => {
  const { runner, calls } = runnerFixture({ failSave: true }); const result = await runner.refreshCatalogDora([catalogId]); assert.equal(result[0].status, 'error'); assert.equal(calls.save.length, 0); assert.deepEqual(calls.release, ['synthetic-token']); assert(!JSON.stringify(result).includes('synthetic-store-failure'));
});
test('runner skips deleted catalog rows without an official lookup', async () => {
  const { runner, calls } = runnerFixture({ rows: [] }); const result = await runner.refreshCatalogDora([catalogId]); assert.equal(result[0].status, 'skipped'); assert.equal(calls.fetch.length + calls.save.length, 0);
});


const catalogProjection = loader()('src/lib/catalog/projection.ts');
const membership = loader()('src/app/admin/_lib/targets/catalogMembership.ts');
function catalogSources() {
  const sources = Object.fromEntries(catalogProjection.CATALOG_COLLECTIONS.map((collection) => [collection, []]));
  sources.adminPipelineParsedCandidates = [{ id: 'synthetic-document', data: { id: 'synthetic-candidate', intakeId: 'synthetic-intake', displayName: 'Avery Synthetic', businessName: 'Synthetic Studio', city: 'Synthetic City', state: 'CO', postalCode: '00000', sourceUrl: 'https://synthetic.example.org/about', licenseNumber: 'MAN.999900001', rawBlock: '', parseConfidence: 'high' } }];
  sources.adminPipelineSourceIntakes = [{ id: 'synthetic-intake', data: { id: 'synthetic-intake', sourceLabel: 'Synthetic source' } }];
  sources.adminPipelineDoraQueue = [{ id: 'synthetic-queue', data: { id: 'synthetic-queue', candidateId: 'synthetic-candidate', intakeId: 'synthetic-intake', status: 'approved' } }];
  sources.adminPipelineDoraResults = [{ id: 'synthetic-result', data: { id: 'synthetic-result', queueItemId: 'synthetic-queue', candidateId: 'synthetic-candidate', intakeId: 'synthetic-intake', status: 'active_match', matchedLicenseName: 'Avery Synthetic', matchedLicenseNumber: 'MAN.999900001', licenseType: 'MAN', licenseStatusText: 'Active', finalStatus: 'approved', reviewedBy: 'synthetic-reviewer', reviewedAt: '2026-10-01T00:00:00Z' } }];
  return sources;
}
test('catalog DORA overlay preserves stable IDs, manual review, membership and all source documents', () => {
  const sources = catalogSources(), project = () => catalogProjection.projectCatalog(sources, JSON.stringify).rows, before = project(), row = before.find((entry) => entry.id === catalogId), list = { id: 'synthetic-list', membershipMode: 'fixed', catalogIds: [catalogId], items: [] };
  assert.equal(row.dora.personLicense.status, 'review'); assert.equal(row.dora.personLicense.matches[0].statusText, 'Active');
  sources.adminPipelineDoraCrossReferences.push({ id: 'synthetic-head', data: { record: modernRecord(row) } });
  const sourceBytes = JSON.stringify(sources), after = project(), updated = after.find((entry) => entry.id === catalogId);
  assert.equal(updated.dora.personLicense.status, 'active'); assert.equal(updated.id, row.id); assert.deepEqual(clone(updated.reviewDecisions), clone(row.reviewDecisions)); assert.equal(updated.reviewStatus, row.reviewStatus);
  assert.deepEqual(clone(membership.resolveTargetListMembership(list, after).catalogIds), clone(membership.resolveTargetListMembership(list, before).catalogIds)); assert.equal(JSON.stringify(sources), sourceBytes);
  sources.adminPipelineParsedCandidates[0].data.displayName = 'Blair Synthetic';
  notConfirmed(project().find((entry) => entry.id === catalogId).dora.personLicense, 'Updated identity cannot retain old active head.');
});
test('catalog does not attach DORA evidence to a second same-name provider', () => {
  const sources = catalogSources(), row = catalogProjection.projectCatalog(sources, JSON.stringify).rows[0]; sources.adminPipelineDoraCrossReferences.push({ id: 'synthetic-head', data: { record: modernRecord(row) } });
  sources.adminPipelineParsedCandidates.push({ id: 'other-document', data: { ...sources.adminPipelineParsedCandidates[0].data, id: 'other-candidate' } });
  const rows = catalogProjection.projectCatalog(sources, JSON.stringify).rows;
  assert.equal(rows.find((entry) => entry.id === catalogId).dora.personLicense.status, 'active');
  assert.equal(rows.find((entry) => entry.id.endsWith(':other-document')).dora.personLicense.status, 'unknown');
});

function resolverFixture({ existing = null, rows = [catalogRow()], refreshed, queueStatus = 'queued', externalBlocked = false } = {}) {
  const calls = { catalog: [], refresh: [], saved: [], queue: [] }, candidate = { id: 'synthetic-candidate', intakeId: 'synthetic-intake', displayName: 'Avery Synthetic' };
  const queue = { id: 'synthetic-queue', intakeId: candidate.intakeId, candidateId: candidate.id, displayName: candidate.displayName, status: queueStatus, attempts: 2, lastAttemptAt: '2026-10-01T00:00:00Z' };
  const resolver = loader({
    '@/lib/catalog/store': { loadSharedCatalog: async () => { calls.catalog.push('load'); if (externalBlocked) forbidden(); return { rows }; } },
    '@/lib/dora/runner': { refreshCatalogDora: async (ids) => { calls.refresh.push(clone(ids)); if (externalBlocked) forbidden(); return [refreshed || { catalogId, status: 'completed', dora: modernRecord().dora }]; } },
    './phase2-store': { getDoraQueueItemById: async () => queue, findDoraResultByQueueItemId: async () => existing, saveDoraResult: async (value) => { calls.saved.push(clone(value)); }, upsertDoraQueueItem: async (value) => { calls.queue.push(clone(value)); } },
    './store': { createSourceIntakeId: () => 'synthetic-new-result', listParsedCandidates: async () => [candidate] },
  })('src/lib/source-intake/dora-resolver.ts');
  return { resolver, calls, queue, candidate };
}
const legacyResult = (extra = {}) => ({ id: 'synthetic-existing-result', queueItemId: 'synthetic-queue', intakeId: 'synthetic-intake', candidateId: 'synthetic-candidate', status: 'active_match', finalStatus: 'approved', reviewedBy: 'synthetic-reviewer', reviewedAt: '2026-10-01T00:00:00Z', resolvedAt: '2026-10-01T00:00:00Z', score: 100, reasons: ['Legacy name match'], evidenceIds: ['synthetic-evidence'], targetOperatorId: 'synthetic-existing-target', ...extra });
test('resolver reads existing result safely and preserves manual review without refresh or any writes', async () => {
  const existing = legacyResult(), before = JSON.stringify(existing), { resolver, calls, queue } = resolverFixture({ existing, queueStatus: 'approved', externalBlocked: true }), beforeQueue = JSON.stringify(queue);
  const result = await resolver.resolveDoraQueueItem('synthetic-queue');
  assert.equal(result.id, existing.id); assert.equal(result.finalStatus, existing.finalStatus); assert.equal(result.reviewedBy, existing.reviewedBy); assert.equal(result.reviewedAt, existing.reviewedAt); assert.deepEqual(clone(result.evidenceIds), existing.evidenceIds); assert.equal(result.targetOperatorId, existing.targetOperatorId);
  assert.equal(result.status, 'possible_match', 'Legacy unsupported active status is safely demoted in the returned view.');
  assert.deepEqual(clone(result), { ...existing, status: 'possible_match' });
  assert.equal(calls.catalog.length + calls.refresh.length + calls.saved.length + calls.queue.length, 0); assert.equal(JSON.stringify(existing), before); assert.equal(JSON.stringify(queue), beforeQueue);
});
test('explicit manual review demotes old unsupported active status without refreshing or changing IDs', async () => {
  const existing = legacyResult(), { resolver, calls } = resolverFixture({ existing }); const result = await resolver.resolveDoraQueueItem('synthetic-queue', { action: 'rejected', resolvedBy: 'synthetic-new-reviewer' });
  assert.equal(result.id, existing.id); assert.equal(result.finalStatus, 'rejected'); assert.equal(result.reviewedBy, 'synthetic-new-reviewer'); assert.equal(result.status, 'possible_match'); assert.equal(result.legacyStatus, 'active_match'); assert.equal(calls.refresh.length, 0); assert.equal(calls.queue[0].attempts, 2); assert.equal(calls.queue[0].lastAttemptAt, '2026-10-01T00:00:00Z');
});
for (const rows of [[], [catalogRow(), catalogRow({ id: catalogId + '-duplicate' })]]) test(`resolver requires exactly one catalog identity, found ${rows.length}`, async () => {
  const { resolver, calls } = resolverFixture({ rows }); await assert.rejects(resolver.resolveDoraQueueItem('synthetic-queue'), /dora_exact_catalog_identity_required/); assert.equal(calls.refresh.length + calls.saved.length + calls.queue.length, 0);
});
for (const status of ['busy', 'error', 'skipped']) test(`resolver first ${status} refresh leaves results and queues untouched`, async () => {
  const { resolver, calls, queue } = resolverFixture({ refreshed: { catalogId, status } }), beforeQueue = JSON.stringify(queue);
  await assert.rejects(resolver.resolveDoraQueueItem('synthetic-queue'), /dora_refresh_unavailable/);
  assert.deepEqual(calls.catalog, ['load']); assert.deepEqual(calls.refresh, [[catalogId]]);
  assert.equal(calls.saved.length + calls.queue.length, 0); assert.equal(JSON.stringify(queue), beforeQueue);
});
for (const action of ['approved', 'rejected']) test(`first manual ${action} persists not-checked evidence without catalog access or network`, async () => {
  const { resolver, calls, queue, candidate } = resolverFixture({ externalBlocked: true }), before = JSON.stringify({ queue, candidate });
  const result = await resolver.resolveDoraQueueItem('synthetic-queue', { action, resolvedBy: 'synthetic-new-reviewer' });
  assert.equal(calls.catalog.length + calls.refresh.length, 0, 'Manual review must not depend on a fresh source lookup.');
  assert.equal(result.id, 'synthetic-new-result'); assert.equal(result.queueItemId, queue.id); assert.equal(result.intakeId, queue.intakeId); assert.equal(result.candidateId, candidate.id);
  assert.equal(result.finalStatus, action); assert.equal(result.reviewedBy, 'synthetic-new-reviewer'); assert(Number.isFinite(Date.parse(result.reviewedAt)));
  assert.equal(result.status, 'not_checked'); assert.equal(result.score, 0); assert.deepEqual(clone(result.evidenceIds), []);
  assert.deepEqual(clone(result.dora), clone(model.emptyDoraCrossReference())); assert(result.reasons.some((reason) => /without making a licensing claim/i.test(reason)));
  assert.equal(result.matchedLicenseNumber, undefined); assert.equal(result.targetOperatorId, undefined);
  assert.equal(calls.saved.length, 1); assert.deepEqual(calls.saved[0], clone(result));
  assert.equal(calls.queue.length, 1); assert.equal(calls.queue[0].id, queue.id); assert.equal(calls.queue[0].candidateId, queue.candidateId); assert.equal(calls.queue[0].intakeId, queue.intakeId); assert.equal(calls.queue[0].status, action);
  assert.equal(JSON.stringify({ queue, candidate }), before, 'Manual review must not mutate source inputs.');
});
test('resolver preserves Review candidates and their raw official status', async () => {
  const dora = modernRecord().dora; dora.personLicense = match(person(), [official()]);
  const { resolver } = resolverFixture({ refreshed: { catalogId, status: 'completed', dora } }); const result = await resolver.resolveDoraQueueItem('synthetic-queue');
  assert.equal(result.status, 'possible_match'); assert.equal(result.matchedLicenseNumber, 'MAN.999900001'); assert.equal(result.licenseStatusText, 'Active'); assert.equal(result.score, 0); assert.equal(result.dora.personLicense.matches[0].identity, 'review');
});
test('resolver no-match remains not-found evidence rather than unlicensed', async () => {
  const dora = modernRecord().dora; dora.personLicense = match(person(), []);
  const { resolver } = resolverFixture({ refreshed: { catalogId, status: 'completed', dora } }); const result = await resolver.resolveDoraQueueItem('synthetic-queue'); assert.equal(result.status, 'not_found'); assert.equal(result.dora.personLicense.status, 'unknown'); assert(result.reasons.some((reason) => /does not mean unlicensed/i.test(reason)));
});

async function main() {
  let failures = 0;
  for (const { name, run } of tests) {
    try { await run(); console.log(`PASS ${name}`); }
    catch (error) { failures++; console.error(`FAIL ${name}\n${error.stack || error}`); }
  }
  console.log(`Compact DORA adversarial: ${tests.length - failures}/${tests.length} synthetic checks passed.`);
  if (failures) process.exitCode = 1;
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
