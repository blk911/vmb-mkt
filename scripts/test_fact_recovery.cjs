/** Synthetic-only fact reconciliation checks. No network or real-person fixtures. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const cache = new Map();
function load(file) {
  const full = path.resolve(__dirname, '..', file);
  if (cache.has(full)) return cache.get(full);
  const module = { exports: {} }; cache.set(full, module.exports);
  const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, structuredClone, URL, Date, Buffer, AbortController, setTimeout, clearTimeout, require(id) {
    if (id.startsWith('@/')) return load(`src/${id.slice(2)}.ts`);
    if (id.startsWith('.')) return load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(full), id + '.ts')));
    if (id.startsWith('node:')) return require(id);
    throw new Error(`Unexpected import ${id}`);
  } }, { filename: full });
  return module.exports;
}
const { recoverCandidateProfile, reconcileProfile, reconcileCandidateProfile, normalizeProfileUrl, classifyProfileUrl } = load('src/lib/admin/pipeline/profile-model.ts');
const { refineCandidateProfile } = load('src/lib/admin/pipeline/profile-refinement.ts');
const candidate = (overrides = {}) => ({ id: 'synthetic-candidate', intakeId: 'synthetic-intake', displayName: 'Example Provider', rawBlock: '', ordinal: 0, parseConfidence: 'high', ...overrides });
(async () => {
  assert.equal(classifyProfileUrl('https://www.styleseat.com/m/v/example-alpha').businessId, 'example-alpha');
  assert.equal(classifyProfileUrl('https://www.styleseat.com/m/v/example-beta').businessId, 'example-beta');
  const nestedBusiness = recoverCandidateProfile(candidate({ rawBlock: JSON.stringify({ name: 'Example Provider', links: [{ url: 'https://www.instagram.com/example_salon/', attribution: 'business' }] }) }));
  assert.equal(nestedBusiness.socialLinks[0].attribution, 'business');
  const wrapped = recoverCandidateProfile(candidate({ rawBlock: JSON.stringify({ name: 'Example Provider', raw: { name: 'Example Provider', externalUrl: 'https://example.glossgenius.com/' } }) }));
  assert.equal(wrapped.platform, 'glossgenius');
  const foreignOwner = recoverCandidateProfile(candidate({ instagramHandle: 'example_provider', rawBlock: JSON.stringify({ profile: { username: 'another_provider', bio: 'https://foreign.glossgenius.com/' } }) }));
  assert.equal(foreignOwner.bookingLinks.length, 0);
  const arrayPayload = recoverCandidateProfile(candidate({ signalType: 'provider', rawBlock: JSON.stringify([{ name: 'Another Person', bookingUrl: 'https://foreign.glossgenius.com/' }]) }));
  assert.equal(arrayPayload.bookingLinks.length, 0);
  const unknownBooking = recoverCandidateProfile(candidate({ bookingUrl: 'https://example-salon.com/book' }));
  assert.equal(unknownBooking.bookingLinks.length, 1);
  assert.equal(unknownBooking.platform, 'unknown');
  const tupleA = recoverCandidateProfile(candidate({ intakeId: 'a::b', id: 'c' }));
  const tupleB = recoverCandidateProfile(candidate({ intakeId: 'a', id: 'b::c' }));
  assert.notEqual(tupleA.candidateRef, tupleB.candidateRef);
  assert.equal(normalizeProfileUrl('https://profile.office.lan/'), undefined);
  assert.equal(normalizeProfileUrl('https://example.glossgenius.com/#access%5Ftoken=synthetic'), undefined);
  const row = candidate({ bookingUrl: 'https://www.vagaro.com/example', rawBlock: JSON.stringify({ bookingUrl: 'example.glossgenius.com', profile: { external_urls: [{ name: 'Book an appointment', url: 'https://booksy.com/en-us/123_example' }] } }) });
  const profile = recoverCandidateProfile(row);
  assert.deepEqual(Array.from(profile.knownPlatforms), ['booksy', 'glossgenius', 'vagaro']);
  assert.equal(profile.platformSummary, 'multiple');
  assert.equal(profile.bookingLinks.length, 3, 'explicit URL must not shadow raw aliases');
  assert(profile.bookingLinks.every(link => link.sourceRef && link.sourceField));
  assert.equal(JSON.stringify(reconcileProfile(profile)), JSON.stringify(profile), 'normalization is idempotent');
  const hinted = recoverCandidateProfile(candidate({ rawBlock: JSON.stringify({ bookingPlatform: 'Fresha', profile: { bio: 'Book with GlossGenius' }, bookingUrl: 'https://www.vagaro.com/example' }) }));
  assert.equal(hinted.platform, 'vagaro', 'domain outranks hints');
  assert.deepEqual(Array.from(hinted.knownPlatforms), ['vagaro']);
  assert.equal(hinted.platformLabel, 'Vagaro');
  assert(hinted.reasons.includes('platform_hint_conflict'));
  assert(hinted.platformEvidence.some(claim => claim.platform === 'fresha' && claim.evidence === 'source_reported'));
  assert.equal(normalizeProfileUrl('https://l.instagram.com/?u=https%3A%2F%2Fexample.glossgenius.com%2F'), 'https://example.glossgenius.com/');
  assert.equal(normalizeProfileUrl('https://example.glossgenius.com/?access_token=synthetic'), undefined);
  assert.equal(normalizeProfileUrl('https://example.glossgenius.com/#access_token=synthetic'), undefined);
  const client = recoverCandidateProfile(candidate({ signalType: 'client_tagged', captionSnippet: 'My provider uses https://example.glossgenius.com/', bookingUrl: 'https://www.vagaro.com/example' }));
  assert(client.bookingLinks.every(link => link.attribution === 'unresolved'));
  const foreign = reconcileCandidateProfile(profile, recoverCandidateProfile(candidate({ id: 'other', displayName: 'Different Person', bookingUrl: 'https://www.styleseat.com/m/example' })));
  assert.equal(foreign.knownPlatforms.includes('styleseat'), false);
  const base = recoverCandidateProfile(candidate({ businessName: 'Example Salon', websiteUrl: 'https://example-salon.com/provider' }));
  let requests = 0;
  const result = await refineCandidateProfile(base, {
    resolve: async () => [{ address: '93.184.216.34', family: 4 }],
    request: async () => { requests++; return { statusCode: 200, headers: { 'content-type': 'text/html' }, body: `<script type="application/ld+json">{"@graph":[{"@type":"Person","name":"Example Provider","worksFor":{"@type":"Organization","name":"Example Salon"}},{"@type":"Organization","name":"Example Salon","sameAs":"https://example.glossgenius.com/"}]}</script>` }; },
  });
  assert.equal(result.platform, 'glossgenius', 'summary must include business-attributed discovered links');
  assert(result.bookingLinks.some(link => link.platform === 'glossgenius' && link.attribution === 'business'));
  assert.equal(requests, 1, 'business-attributed link is retained without inventing a personal trail');
  assert.equal(JSON.stringify(recoverCandidateProfile(row)), JSON.stringify(profile), 'recovery does not mutate source');
  console.log('Fact recovery tests passed: alias retention, provenance, idempotence, hints, safe wrappers, ownership separation, identity guards and final discovered-domain summary.');
})().catch(error => { console.error(error); process.exitCode = 1; });
