/**
 * Independent, synthetic-only fact recovery regressions.
 * No live fixtures, network requests, credentials, source writes or publication.
 * Run with: node scripts/test_fact_recovery_adversarial.cjs
 */
const startedAt = Date.now();
console.log('Synthetic adversarial fact recovery: loading hermetic fixtures.');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const copy = (value) => JSON.parse(JSON.stringify(value));
const prohibitedNetwork = () => { throw new Error('Live network is forbidden in this synthetic test.'); };
// Reuse compiler output while each isolated loader still owns independent mocked module state.
const compiledSources = new Map();

function loader(overrides = {}, globals = {}) {
  const cache = new Map();
  function load(relative) {
    const full = path.resolve(root, relative);
    assert(full.startsWith(root + path.sep), 'Test loader must stay inside the repository.');
    if (cache.has(full)) return cache.get(full).exports;
    const module = { exports: {} };
    cache.set(full, module);
    let source = compiledSources.get(full);
    if (!source) {
      source = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
        fileName: full,
      }).outputText;
      compiledSources.set(full, source);
    }
    vm.runInNewContext(source, {
      module, exports: module.exports, URL, Date, Buffer, structuredClone, setTimeout, clearTimeout, AbortController,
      console: { log() {}, error() {}, warn() {} }, process: { env: {} }, ...globals,
      require(id) {
        if (Object.prototype.hasOwnProperty.call(overrides, id)) return overrides[id];
        if (id === 'server-only') return {};
        if (id === 'node:dns/promises') return { lookup: prohibitedNetwork };
        if (id === 'node:https') return { request: prohibitedNetwork };
        if (['node:crypto', 'node:net', 'node:path'].includes(id)) return require(id);
        if (id.startsWith('@/')) return load(`src/${id.slice(2)}.ts`);
        if (id.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(full), id + '.ts')));
        throw new Error(`Unexpected import in hermetic test: ${id}`);
      },
    }, { filename: full });
    return module.exports;
  }
  return load;
}

const load = loader();
const model = load('src/lib/admin/pipeline/profile-model.ts');
const { recoverCandidateProfile: recover, classifyProfileUrl: classify } = model;
const { fetchPublicProfile, publicProfileUrl, isPublicProfileAddress } = load('src/lib/admin/pipeline/profile-fetch.ts');
const { inspectProfilePage } = load('src/lib/admin/pipeline/profile-evidence.ts');
const { refineCandidateProfile } = load('src/lib/admin/pipeline/profile-refinement.ts');
const { projectCatalog, CATALOG_COLLECTIONS } = load('src/lib/catalog/projection.ts');
const { filterCatalogRecords } = load('src/lib/catalog/query.ts');
const { targetListCatalogCsv, resolveTargetListMembership } = load('src/app/admin/_lib/targets/catalogMembership.ts');
const tests = [];
const test = (name, work) => tests.push({ name, work });
const candidate = (extra = {}) => ({
  id: 'synthetic-candidate', intakeId: 'synthetic-intake', ordinal: 1, displayName: 'Avery Example',
  instagramHandle: 'synthetic_nails', sourceUrl: 'https://www.instagram.com/synthetic_nails/',
  rawBlock: '', parseConfidence: 'high', ...extra,
});
const urls = {
  glossgenius: 'https://syntheticstudio.glossgenius.com',
  vagaro: 'https://www.vagaro.com/us01/syntheticstudio',
  booksy: 'https://booksy.com/en-us/987654_synthetic-studio_nails',
  fresha: 'https://www.fresha.com/a/synthetic-studio-xyz',
  square: 'https://squareup.com/appointments/book/SYNTHETIC',
  styleseat: 'https://www.styleseat.com/m/v/synthetic-stylist',
};
const attributedPlatforms = (profile) => new Set(profile.bookingLinks.filter((link) => link.attribution !== 'unresolved').map((link) => link.platform));
const doc = (id, data) => ({ id, data, updatedAt: '2026-01-01T00:00:00.000Z' });
const fingerprint = (value) => JSON.stringify(value);
function fixture(extra = {}) {
  const sources = Object.fromEntries(CATALOG_COLLECTIONS.map((key) => [key, []]));
  sources.adminPipelineParsedCandidates = [doc('synthetic-document', candidate(extra))];
  sources.adminPipelineSourceIntakes = [doc('intake-document', {
    id: 'synthetic-intake', sourceLabel: 'Synthetic test only', city: 'Unrelated Batch City',
    rawText: 'Other Example https://unrelated.glossgenius.com', submittedAt: '2026-01-01T00:00:00.000Z',
  })];
  return sources;
}
const row = (sources) => projectCatalog(sources, fingerprint).rows.find((value) => value.entityType === 'provider');

for (const [platform, url] of Object.entries(urls)) {
  for (const [field, extra] of [
    ['bookingUrl', { bookingUrl: url }],
    ['websiteUrl', { websiteUrl: url }],
    ['raw bookingLink', { rawBlock: JSON.stringify({ name: 'Avery Example', bookingLink: url }) }],
    ['raw bio_links', { rawBlock: JSON.stringify({ name: 'Avery Example', bio_links: [{ url }] }) }],
    ['raw externalUrl', { rawBlock: JSON.stringify({ name: 'Avery Example', externalUrl: url }) }],
    ['raw sourceUrl alongside Instagram', { rawBlock: JSON.stringify({ name: 'Avery Example', sourceUrl: url }) }],
    ['raw url alongside Instagram', { rawBlock: JSON.stringify({ name: 'Avery Example', url }) }],
    ['raw biography', { rawBlock: JSON.stringify({ name: 'Avery Example', biography: `Nail artist. Book ${url}` }) }],
    ['raw nested profile', { rawBlock: JSON.stringify({ name: 'Avery Example', profile: { externalUrl: url } }) }],
    ['owned raw text', { signalType: 'provider', rawBlock: `@synthetic_nails\nAvery Example\nNail tech. Book now\n${url}` }],
    ['bare direct booking URL', { bookingUrl: url.replace('https://', '') }],
  ]) test(`${platform}: ${field}`, () => {
    const input = candidate(extra), before = JSON.stringify(input), profile = recover(input);
    assert.equal(profile.platform, platform);
    assert(attributedPlatforms(profile).has(platform));
    assert.notEqual(profile.status, 'provider_matched', 'Source claims do not prove identity.');
    assert.equal(JSON.stringify(input), before, 'Recovery must not mutate source documents.');
  });
}

test('allowlisted redirect wrapper recovers observed target and provenance', () => {
  const wrapped = `https://l.instagram.com/?u=${encodeURIComponent(urls.glossgenius)}`;
  const profile = recover(candidate({ websiteUrl: wrapped }));
  assert.equal(profile.platform, 'glossgenius');
  const link = profile.bookingLinks.find((entry) => entry.platform === 'glossgenius');
  assert.equal(new URL(link.url).hostname, 'syntheticstudio.glossgenius.com');
  assert(link.observedUrl === wrapped || link.sourceUrl === wrapped, 'Preserve the observed wrapper as provenance.');
});

test('unknown redirect wrapper is not trusted to attribute its query target', () => {
  const profile = recover(candidate({ websiteUrl: `https://redirect.example.org/?u=${encodeURIComponent(urls.glossgenius)}` }));
  assert.equal(profile.platform, 'unknown');
});

for (const url of [
  'https://glossgenius.com.attacker.example.org/studio',
  'https://notvagaro.com/studio', 'https://booksy.com.evil.example.org/987654_studio',
  'https://fresha.com.evil.example.org/a/studio', 'https://squareup.com.evil.example.org/appointments/book/ABC',
  'https://styleseat.com.evil.example.org/m/v/studio',
]) test(`host lookalike never becomes platform: ${url}`, () => assert.equal(classify(url)?.platform, 'unknown'));

for (const url of [
  'javascript:alert(1)', 'data:text/html,unsafe', 'file:///tmp/synthetic',
  'https://user:password@syntheticstudio.glossgenius.com',
  'https://syntheticstudio.glossgenius.com@127.0.0.1',
  'https://127.0.0.1', 'https://0x7f000001', 'https://2130706433', 'https://[::1]',
  'https://localhost', 'https://service.internal', 'https://service.local',
  'https://service.intranet', 'https://service.lan', 'https://service.home',
  'https://syntheticstudio.glossgenius.com:8443', 'https://syntheticstudio.glossgenius.com\\@example.org',
  'https://syntheticstudio.glossgenius.com?access_token=synthetic',
  'https://syntheticstudio.glossgenius.com?api_key=synthetic',
  'https://syntheticstudio.glossgenius.com?sessionid=synthetic',
  'https://syntheticstudio.glossgenius.com?password=synthetic',
  'https://syntheticstudio.glossgenius.com#access%5Ftoken=synthetic',
]) test(`unsafe/credential URL omitted: ${url}`, () => {
  assert.equal(classify(url), null);
  assert.equal(recover(candidate({ bookingUrl: url })).bookingLinks.length, 0);
});

test('multiple observed platforms are explicit conflict, never first-link wins', () => {
  const profile = recover(candidate({ bookingUrl: urls.glossgenius, websiteUrl: urls.booksy }));
  assert.equal(profile.platform, 'unknown');
  assert.equal(profile.status, 'ambiguous');
  assert.equal(profile.platformSummary, 'multiple');
  assert.deepEqual(Array.from(profile.knownPlatforms).sort(), ['booksy', 'glossgenius']);
  assert(profile.reasons.includes('multiple_booking_platforms'));
});

for (const [name, raw] of [
  ['foreign root person', { name: 'Blair Other', bookingUrl: urls.glossgenius }],
  ['foreign nested person', { name: 'Avery Example', profile: { name: 'Blair Other', bookingUrl: urls.glossgenius } }],
  ['review author', { name: 'Avery Example', reviews: [{ author: { name: 'Blair Other', bookingUrl: urls.glossgenius } }] }],
  ['tagged account', { name: 'Avery Example', taggedUsers: [{ name: 'Blair Other', externalUrl: urls.glossgenius }] }],
  ['unrelated people array', { name: 'Avery Example', people: [{ name: 'Blair Other', url: urls.glossgenius }] }],
]) test(`unrelated identity cannot supply candidate platform: ${name}`, () => {
  const profile = recover(candidate({ rawBlock: JSON.stringify(raw) }));
  assert(!attributedPlatforms(profile).has('glossgenius'));
  assert.equal(profile.providerName, 'Avery Example');
});

test('client caption mentioning another provider is not identity proof', () => {
  const profile = recover(candidate({ signalType: 'client_tagged', captionSnippet: `Love my nails by @other_synthetic. Book ${urls.glossgenius}`, rawBlock: `@client_synthetic\nLove my nails by @other_synthetic. Book ${urls.glossgenius}` }));
  assert(!attributedPlatforms(profile).has('glossgenius'));
});

test('mixed raw evidence cannot promote a client post because candidate has another provider post', () => {
  const profile = recover(candidate({ signalType: 'provider', rawBlock: `@synthetic_nails\nAvery Example\nNail tech. Appointments open\n\n@client_synthetic\nLove these nails by @other_synthetic. Book ${urls.glossgenius}` }));
  assert(!attributedPlatforms(profile).has('glossgenius'));
});

test('reconciliation is idempotent and cannot merge a different candidate identity', () => {
  const base = recover(candidate({ bookingUrl: urls.glossgenius }));
  assert.deepEqual(copy(model.reconcileProfile(model.reconcileProfile(base))), copy(model.reconcileProfile(base)));
  const wrong = recover(candidate({ id: 'other-candidate', displayName: 'Blair Other', bookingUrl: urls.booksy }));
  const combined = model.reconcileCandidateProfile(base, wrong);
  assert.equal(combined.providerName, 'Avery Example');
  assert(!attributedPlatforms(combined).has('booksy'));
  assert(combined.reasons.includes('conflicting_additional_profile_identity'));
});

test('structured review author cannot establish page identity', () => {
  const base = recover(candidate({ businessName: 'Synthetic Studio' }));
  const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'BeautySalon', name: 'Synthetic Studio', review: { '@type': 'Review', author: { '@type': 'Person', name: 'Avery Example', worksFor: { name: 'Synthetic Studio' }, sameAs: 'https://www.instagram.com/synthetic_other/' } } })}</script>`;
  const evidence = inspectProfilePage(html, base, 'https://studio.example.org', '2026-01-01T00:00:00Z');
  assert.equal(evidence.match, 'unmatched');
  assert.equal(evidence.links.length, 0);
});

test('microdata review authors cannot establish page identity', () => {
  const base = recover(candidate({ businessName: 'Synthetic Studio' }));
  const html = '<main><p>Synthetic Studio</p><article class="testimonial"><h1>Avery Example</h1><div itemscope itemtype="https://schema.org/Person"><span itemprop="name">Avery Example</span><span itemprop="worksFor">Synthetic Studio</span><a itemprop="sameAs" href="https://www.instagram.com/synthetic_other/">Instagram</a></div></article></main>';
  assert.equal(inspectProfilePage(html, base, 'https://studio.example.org', '2026-01-01T00:00:00Z').match, 'unmatched');
});

test('matched own website recovers a shared booking fact without personal promotion', async () => {
  const base = recover(candidate({ businessName: 'Synthetic Studio', websiteUrl: 'https://studio.example.org/about' }));
  let requests = 0;
  const profile = await refineCandidateProfile(base, {
    resolve: async () => [{ address: '93.184.216.34', family: 4 }],
    request: async () => { requests++; return { statusCode: 200, headers: { 'content-type': 'text/html' }, body: `<main><h1>Avery Example</h1><p>Synthetic Studio</p><a href="${urls.glossgenius}">Book an appointment</a></main>` }; },
  });
  assert.equal(profile.platform, 'glossgenius');
  assert(profile.bookingLinks.some((link) => link.platform === 'glossgenius' && link.attribution === 'business'));
  assert.equal(requests, 1, 'Shared business discovery must not be crawled as a personal profile.');
});

test('Instagram-only refinement performs no social fetch', async () => {
  let requests = 0, resolutions = 0;
  await refineCandidateProfile(recover(candidate()), { resolve: async () => { resolutions++; return []; }, request: async () => { requests++; prohibitedNetwork(); } });
  assert.equal(requests + resolutions, 0);
});

for (const address of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.0.1', '169.254.169.254', '100.64.0.1', '192.0.2.1', '198.51.100.1', '203.0.113.1', '224.0.0.1', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '2001:db8::1', '2002:7f00:1::']) {
  test(`public fetch rejects special/private address ${address}`, () => assert.equal(isPublicProfileAddress(address), false));
}

test('mixed public/private DNS fails before HTTP request', async () => {
  let requests = 0;
  const result = await fetchPublicProfile('https://studio.example.org', {
    resolve: async () => [{ address: '93.184.216.34', family: 4 }, { address: '127.0.0.1', family: 4 }],
    request: async () => { requests++; prohibitedNetwork(); },
  });
  assert.equal(result.outcome, 'unsafe'); assert.equal(requests, 0);
});

test('DNS family mismatch fails before HTTP request', async () => {
  let requests = 0;
  const result = await fetchPublicProfile('https://studio.example.org', { resolve: async () => [{ address: '93.184.216.34', family: 6 }], request: async () => { requests++; prohibitedNetwork(); } });
  assert.equal(result.outcome, 'unsafe'); assert.equal(requests, 0);
});

for (const [destination, expected] of [
  ['https://127.0.0.1/internal', 'unsafe'], ['http://studio.example.org', 'unsafe'],
  ['https://user:password@studio.example.org', 'unsafe'], ['https://studio.example.org/login', 'blocked'],
  ['https://www.instagram.com/synthetic_nails/', 'unsupported'],
]) test(`redirect revalidates destination: ${destination}`, async () => {
  let requests = 0;
  const result = await fetchPublicProfile('https://studio.example.org', {
    resolve: async () => [{ address: '93.184.216.34', family: 4 }],
    request: async () => { requests++; return { statusCode: 302, headers: { location: destination }, body: '' }; },
  });
  assert.equal(result.outcome, expected); assert.equal(requests, 1);
});

test('redirect hostname gets a fresh public DNS check', async () => {
  let requests = 0;
  const result = await fetchPublicProfile('https://studio.example.org', {
    resolve: async (host) => [{ address: host === 'studio.example.org' ? '93.184.216.34' : '10.0.0.1', family: 4 }],
    request: async ({ pinnedAddress }) => { requests++; assert.equal(pinnedAddress.address, '93.184.216.34'); return { statusCode: 302, headers: { location: 'https://second.example.org' }, body: '' }; },
  });
  assert.equal(result.outcome, 'unsafe'); assert.equal(requests, 1);
});

test('protected response ends refinement without alternate-route bypass', async () => {
  let requests = 0;
  const profile = await refineCandidateProfile(recover(candidate({ bookingUrl: urls.glossgenius, websiteUrl: 'https://studio.example.org' })), {
    resolve: async () => [{ address: '93.184.216.34', family: 4 }],
    request: async () => { requests++; return { statusCode: 403, headers: {}, body: '' }; },
  });
  assert.equal(profile.status, 'blocked'); assert.equal(requests, 1);
});

test('catalog candidate facts never leak from unrelated intake or duplicate candidate IDs in other batches', () => {
  const sources = fixture();
  sources.adminPipelineSocialResults = [doc('foreign-result', { intakeId: 'other-intake', candidateId: 'synthetic-candidate', discoveredSurfaces: [{ type: 'booking', value: urls.glossgenius, confidence: 'high', reasons: ['candidate_source_reported_link_not_fetched_or_identity_verified'] }] })];
  const projected = row(sources);
  assert.equal(projected.profile.platform, 'unknown');
  assert.equal(projected.city, '');
  assert.equal(projected.providerName, 'Avery Example');
});

test('platform recovery preserves explicit approval and source documents', () => {
  const sources = fixture({ rawBlock: JSON.stringify({ name: 'Avery Example', bio_links: [{ url: urls.glossgenius }] }) });
  sources.adminPipelineSocialQueue = [doc('social-queue', { id: 'social-queue', intakeId: 'synthetic-intake', candidateId: 'synthetic-candidate', status: 'approved' })];
  sources.adminPipelineSocialResults = [doc('social-result', { queueItemId: 'social-queue', intakeId: 'synthetic-intake', candidateId: 'synthetic-candidate', finalStatus: 'approved', reviewedBy: 'Synthetic Reviewer', reviewedAt: '2026-01-02T00:00:00Z' })];
  const before = JSON.stringify(sources), projected = row(sources);
  assert.equal(projected.profile.platform, 'glossgenius');
  assert.equal(projected.reviewStatus, 'approved');
  assert.equal(projected.reviewDecisions[0].reviewedBy, 'Synthetic Reviewer');
  assert.equal(JSON.stringify(sources), before);
});

test('same-fingerprint old cached unknown profile gets newly recoverable facts', () => {
  const sources = fixture({ rawBlock: JSON.stringify({ name: 'Avery Example', externalUrl: urls.glossgenius }) });
  const old = recover(candidate());
  old.nextAttemptAt = '2099-01-01T00:00:00.000Z';
  sources.adminPipelineProfileRefinements = [doc('old-head', { record: { schemaVersion: 1, reviewKey: 'synthetic-intake::synthetic-candidate', fingerprint: fingerprint(sources.adminPipelineParsedCandidates[0].data), profile: old, completedAt: '2026-01-01T00:00:00.000Z', runId: 'synthetic-old-run' } })];
  assert.equal(row(sources).profile.platform, 'glossgenius');
});

test('changed-source cache cannot resurrect prior identity or link', () => {
  const sources = fixture();
  sources.adminPipelineProfileRefinements = [doc('stale-head', { record: { schemaVersion: 1, reviewKey: 'synthetic-intake::synthetic-candidate', fingerprint: 'obsolete', profile: recover(candidate({ bookingUrl: urls.glossgenius, displayName: 'Blair Other' })), completedAt: '2026-01-01T00:00:00.000Z' } })];
  const projected = row(sources);
  assert.equal(projected.providerName, 'Avery Example'); assert.equal(projected.profile.platform, 'unknown');
});

test('candidate join delimiters do not bind another batch result', () => {
  const sources = fixture({ intakeId: 'synthetic::batch', id: 'candidate' });
  sources.adminPipelineSocialResults = [doc('collision-result', {
    intakeId: 'synthetic', candidateId: 'batch::candidate',
    discoveredSurfaces: [{ type: 'booking', value: urls.glossgenius, confidence: 'high', reasons: ['candidate_source_reported_link_not_fetched_or_identity_verified'] }],
  })];
  assert.equal(row(sources).profile.platform, 'unknown');
});

test('lane result without candidateId cannot bind using its own document ID', () => {
  const sources = fixture();
  sources.adminPipelineSocialResults = [doc('synthetic-candidate', {
    id: 'synthetic-candidate', intakeId: 'synthetic-intake',
    discoveredSurfaces: [{ type: 'booking', value: urls.glossgenius, confidence: 'high', reasons: ['candidate_source_reported_link_not_fetched_or_identity_verified'] }],
  })];
  assert.equal(row(sources).profile.platform, 'unknown');
});

test('Social high confidence search discovery remains unresolved', () => {
  const sources = fixture();
  sources.adminPipelineSocialResults = [doc('social-result', { intakeId: 'synthetic-intake', candidateId: 'synthetic-candidate', discoveredSurfaces: [{ type: 'booking', value: urls.glossgenius, confidence: 'high', reasons: ['query="Avery Example" nails', 'strong name alignment in search title', 'search_discovery_only_not_fetched_or_identity_verified'] }] })];
  const projected = row(sources);
  assert.equal(projected.profile.platform, 'unknown');
  assert(!attributedPlatforms(projected.profile).has('glossgenius'));
  assert(projected.factClaims.some((claim) => claim.value === urls.glossgenius && claim.raw?.value === urls.glossgenius && claim.attribution === 'unresolved'));
});

test('Social direct-source booking observation contributes a business fact', () => {
  const sources = fixture();
  sources.adminPipelineSocialResults = [doc('social-result', { intakeId: 'synthetic-intake', candidateId: 'synthetic-candidate', discoveredSurfaces: [{ type: 'booking', value: urls.glossgenius, confidence: 'medium', reasons: ['candidate_source_reported_link_not_fetched_or_identity_verified', 'source_basis=submitted', 'shared_business_link_not_provider_identity'] }] })];
  const projected = row(sources);
  assert.equal(projected.profile.platform, 'glossgenius');
  assert(projected.profile.bookingLinks.some((link) => new URL(link.url).href === new URL(urls.glossgenius).href && link.attribution === 'business'));
  assert.notEqual(projected.profile.status, 'provider_matched');
});

test('legacy tech records remain businesses after platform recovery', () => {
  const sources = fixture();
  sources.tech_index = [doc('synthetic-tech', { id: 'stored-tech-alias', displayName: 'Synthetic Studio', premise: { website: urls.glossgenius }, address: { city: 'Synthetic City', zip: '00000' } })];
  const business = projectCatalog(sources, fingerprint).rows.find((entry) => entry.entityType === 'business');
  assert.equal(business.id, 'business:tech_index:synthetic-tech');
  assert.equal(business.providerName, ''); assert.equal(business.profile.providerName, '');
  assert.equal(business.profile.platform, 'glossgenius');
  assert([...business.profile.bookingLinks, ...business.profile.socialLinks, ...business.profile.websiteLinks].every((link) => link.attribution === 'business'));
});

for (const [platform, url] of Object.entries(urls)) test(`legacy platform-keyed ${platform} link remains a business fact`, () => {
  const sources = fixture();
  sources.tech_index = [doc('synthetic-tech', { displayName: 'Synthetic Studio', booking: { [platform]: url } })];
  const business = projectCatalog(sources, fingerprint).rows.find((entry) => entry.entityType === 'business');
  assert.equal(business.profile.platform, platform);
  assert(business.profile.bookingLinks.every((link) => link.attribution === 'business'));
  assert.equal(business.providerName, '');
});

test('DORA license facts remain evidence and never replace provider identity or candidate location', () => {
  const sources = fixture();
  sources.adminPipelineDoraResults = [doc('dora-result', {
    intakeId: 'synthetic-intake', candidateId: 'synthetic-candidate', status: 'possible_match',
    matchedLicenseName: 'Blair Other', matchedLicenseNumber: 'SYNTHETIC-LICENSE-000',
    licenseType: 'Synthetic Nail Technician', licenseStatusText: 'ACTIVE',
    city: 'Different License City', state: 'ZZ', score: 0.91, reasons: ['Synthetic name overlap'],
  })];
  const projected = row(sources);
  assert.equal(projected.providerName, 'Avery Example');
  assert.equal(projected.city, ''); assert.equal(projected.state, '');
  for (const value of ['Blair Other', 'SYNTHETIC-LICENSE-000', 'Synthetic Nail Technician', 'ACTIVE', 'Different License City']) {
    assert(projected.factClaims.some((claim) => claim.value === value), `Retain DORA source fact ${value}.`);
  }
  assert.notEqual(projected.profile.status, 'provider_matched');
});

test('unrelated staged evidence cannot leak between batches', () => {
  const sources = fixture();
  sources.adminPipelineOperatorEvidence = [doc('foreign-staged', {
    intakeId: 'other-intake', candidateId: 'synthetic-candidate', candidateName: 'Avery Example',
    factType: 'booking_url', factValue: urls.glossgenius, confidence: 'high', sourceType: 'instagram_bio',
  })];
  assert.equal(row(sources).profile.platform, 'unknown');
});

test('both attributable platforms can be filtered and exported without changing membership', () => {
  const sources = fixture({ bookingUrl: urls.glossgenius, websiteUrl: urls.booksy });
  const projected = projectCatalog(sources, fingerprint).rows;
  for (const platform of ['glossgenius', 'booksy']) assert.equal(filterCatalogRecords(projected, { platform }).length, 1);
  const list = { id: 'synthetic-multiple', name: 'Synthetic multiple', membershipMode: 'fixed', catalogIds: [projected[0].id], items: [], workflow: {} };
  const csv = targetListCatalogCsv(list, projected, '2026-01-01').csv;
  assert(csv.includes('Booksy') && csv.includes('GlossGenius'));
});

test('display, platform filter, export and fixed membership use the same recovered facts', () => {
  const sources = fixture({ rawBlock: JSON.stringify({ name: 'Avery Example', externalUrl: urls.glossgenius }) });
  const projected = projectCatalog(sources, fingerprint).rows;
  const id = projected[0].id;
  const list = { id: 'synthetic-list', name: 'Synthetic fixed list', membershipMode: 'fixed', catalogIds: [id], items: [{ kind: 'tech', refId: id, catalogId: id, label: 'Original selection' }], savedQuery: { platform: 'booksy' }, workflow: {} };
  assert.equal(projected[0].platformLabel, 'GlossGenius');
  assert.equal(filterCatalogRecords(projected, { platform: 'glossgenius' }).length, 1);
  assert(targetListCatalogCsv(list, projected, '2026-01-01').csv.includes('GlossGenius'));
  assert(targetListCatalogCsv(list, projected, '2026-01-01').csv.includes(urls.glossgenius));
  sources.adminPipelineParsedCandidates[0].data.rawBlock = JSON.stringify({ name: 'Avery Example', externalUrl: urls.booksy });
  const refreshed = projectCatalog(sources, fingerprint).rows;
  assert.equal(refreshed[0].id, id);
  assert.deepEqual(Array.from(resolveTargetListMembership(list, refreshed).catalogIds), [id]);
  assert.equal(resolveTargetListMembership(list, refreshed).rows[0].profile.platform, 'booksy');
});

test('production canonical store fails closed without durable credentials', () => {
  for (const env of [{ NODE_ENV: 'production' }, { NODE_ENV: 'production', VMB_CANONICAL_PIPELINE_STORE: 'file' }]) {
    const config = loader({}, { process: { env } })('src/lib/admin/pipeline/canonical-store-config.ts');
    assert.throws(() => config.getCanonicalPipelineStoreMode(), /canonical_store/);
  }
});

test('durable catalog failure cannot return a successful empty/local snapshot', async () => {
  const isolated = loader({
    '@/lib/admin/firestoreAdmin': { adminDb: () => { throw new Error('synthetic durable failure'); } },
    '@/lib/admin/pipeline/profile-store': { fingerprintCandidate: fingerprint },
  });
  await assert.rejects(isolated('src/lib/catalog/store.ts').loadSharedCatalog(), /catalog_store_unavailable/);
});

test('explicit business link attribution survives nested source objects', () => {
  const profile = recover(candidate({ rawBlock: JSON.stringify({ name: 'Avery Example', links: [{ url: 'https://www.instagram.com/synthetic_salon/', attribution: 'business' }] }) }));
  assert(profile.socialLinks.some((link) => link.url.includes('/synthetic_salon/') && link.attribution === 'business'));
  assert(!profile.reasons.includes('conflicting_instagram_identity'));
});

test('candidate-scoped raw/sourceRecord wrappers are recovered', () => {
  for (const wrapper of ['raw', 'sourceRecord']) {
    const profile = recover(candidate({ rawBlock: JSON.stringify({ name: 'Avery Example', [wrapper]: { name: 'Avery Example', externalUrl: urls.glossgenius } }) }));
    assert.equal(profile.platform, 'glossgenius', wrapper);
  }
});

test('foreign structured handle blocks nested booking links', () => {
  const profile = recover(candidate({ rawBlock: JSON.stringify({ name: 'Avery Example', profile: { username: 'other_synthetic', externalUrl: urls.glossgenius } }) }));
  assert(!attributedPlatforms(profile).has('glossgenius'));
});

test('link labels are not treated as foreign provider names', () => {
  const profile = recover(candidate({ rawBlock: JSON.stringify({ name: 'Avery Example', bio_links: [{ name: 'Book an appointment', url: urls.glossgenius }] }) }));
  assert.equal(profile.platform, 'glossgenius');
});

test('lookalike domain text cannot fabricate a source-reported platform hint', () => {
  const profile = recover(candidate({ rawBlock: JSON.stringify({ name: 'Avery Example', biography: 'Book https://glossgenius.com.attacker.example.org/studio' }) }));
  assert.equal(profile.platform, 'unknown');
});

test('StyleSeat route prefix is never a fabricated shared business identifier', () => {
  const first = classify('https://www.styleseat.com/m/v/synthetic-first');
  const second = classify('https://www.styleseat.com/m/v/synthetic-second');
  assert.notEqual(first.businessId, 'v'); assert.notEqual(second.businessId, 'v');
  if (first.businessId && second.businessId) assert.notEqual(first.businessId, second.businessId);
});

test('explicit unresolved source evidence remains observed evidence without becoming a platform fact', () => {
  const profile = recover(candidate({ sourceEvidenceLinks: [{ url: urls.glossgenius, sourcePostId: 'synthetic-client-post', attribution: 'unknown', evidenceType: 'client_post' }] }));
  assert.equal(profile.platform, 'unknown');
  assert(profile.bookingLinks.some((link) => link.platform === 'glossgenius' && link.attribution === 'unresolved'));
  assert((profile.observedPlatforms || []).includes('glossgenius'));
  assert(!(profile.knownPlatforms || []).includes('glossgenius'));
});

test('URL-domain platform outranks a conflicting source-text hint consistently in label and filters', () => {
  const sources = fixture({ bookingUrl: urls.glossgenius, rawBlock: JSON.stringify({ name: 'Avery Example', platform: 'Vagaro' }) });
  const projected = projectCatalog(sources, fingerprint).rows;
  const profile = projected[0].profile;
  assert.equal(profile.platform, 'glossgenius');
  assert.equal(profile.platformLabel, 'GlossGenius');
  assert.equal(projected[0].platformLabel, 'GlossGenius');
  assert.deepEqual(Array.from(profile.knownPlatforms), ['glossgenius']);
  assert.equal(filterCatalogRecords(projected, { platform: 'glossgenius' }).length, 1);
  assert.equal(filterCatalogRecords(projected, { platform: 'vagaro' }).length, 0);
  assert(profile.platformEvidence.some((claim) => claim.platform === 'vagaro' && claim.evidence === 'source_reported'), 'Retain the weaker source hint as evidence.');
});

test('approved-only operator contacts exclude unresolved and shared-business Instagram evidence', async () => {
  const profile = recover(candidate());
  const social = (url, attribution) => ({ ...classify(url), url, attribution, sourceUrl: url, basis: 'submitted' });
  const unresolved = social('https://www.instagram.com/synthetic_discovered/', 'unresolved');
  const business = social('https://www.instagram.com/synthetic_salon/', 'business');
  const post = social('https://www.instagram.com/p/SYNTHETIC/', 'candidate');
  const personal = social('https://www.instagram.com/synthetic_nails/', 'candidate');
  const common = { providerName: 'Avery Example', displayName: 'Avery Example', city: 'Synthetic City', services: ['Nails'] };
  const rows = [
    { ...common, id: 'approved-provider', entityType: 'provider', reviewStatus: 'approved', profile: { ...profile, socialLinks: [unresolved, business, post, personal] } },
    { ...common, id: 'approved-unresolved', entityType: 'provider', reviewStatus: 'approved', profile: { ...profile, socialLinks: [unresolved, business] } },
    { ...common, id: 'pending-provider', entityType: 'provider', reviewStatus: 'pending', profile: { ...profile, socialLinks: [personal] } },
    { ...common, id: 'business-record', entityType: 'business', reviewStatus: 'approved', profile: { ...profile, socialLinks: [personal] } },
  ];
  const before = JSON.stringify(rows);
  const isolated = loader({ '@/lib/catalog/store': { loadSharedCatalog: async () => ({ rows }) } });
  const operators = await isolated('src/lib/admin/operator-adapter.ts').listCanonicalOperators();
  assert.equal(operators.length, 2);
  assert.equal(operators.find((entry) => entry.id === 'approved-provider').ig, personal.url);
  assert.equal(operators.find((entry) => entry.id === 'approved-unresolved').ig, undefined);
  assert.equal(JSON.stringify(rows), before);
  const preview = load('src/lib/ops/targetWorkflow.ts').buildHighLevelHandoffPreview([{ id: 'synthetic-list', name: 'Synthetic preview', updatedAt: '2026-01-01', techIds: ['approved-provider'], workflow: { stage: 'qualified' }, ig: personal.url }]);
  assert.equal(preview.previewOnly, true); assert.equal(preview.deliveryEnabled, false);
  assert(!JSON.stringify(preview).includes(personal.url), 'HighLevel preview contains no contact extraction.');
});

(async () => {
  let passed = 0;
  const failures = [];
  for (const entry of tests) {
    try { await entry.work(); passed++; }
    catch (error) { failures.push(entry.name); console.error(`FAIL ${entry.name}\n  ${error.stack || error}`); }
  }
  console.log(`Synthetic adversarial fact recovery: ${passed}/${tests.length} passed; ${failures.length} failed; ${((Date.now() - startedAt) / 1000).toFixed(2)}s. No live network or source writes.`);
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exitCode = 1; });
