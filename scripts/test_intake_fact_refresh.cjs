/** Synthetic-only intake, cached projection and independent refresh lifecycle checks. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-intake-refresh-'));
const sourceCandidates = [];
const sourceDora = [];
const sourceSocial = [];
const staged = [];
let refinementCalls = 0;
const stubs = {
  'server-only': {},
  '@/lib/admin/firestoreAdmin': { adminDb() { throw new Error('No external database permitted in this test'); } },
  '@/lib/runtime/runtime-data-root': { getRuntimeDataRoot: () => runtimeRoot },
  './canonical-store-config': { usesFirestoreCanonicalPipelineStore: () => false },
  '@/lib/source-intake/store': { listParsedCandidates: async id => sourceCandidates.filter(row => row.intakeId === id), listStagedOperatorEvidence: async () => staged },
  '@/lib/source-intake/phase2-store': { listDoraResults: async () => sourceDora, listSocialResults: async () => sourceSocial },
  './profile-refinement': { refineCandidateProfile: async profile => { refinementCalls++; return { ...profile, status: 'unmatched', observations: [{ sourceUrl: profile.bookingLinks[0]?.url || 'https://example.com', fetchedAt: '2026-01-02T00:00:00.000Z', outcome: 'retrieved', claims: [] }] }; } },
  './build': {}, '@/lib/operators/upload-adapter': {}, './profile-fetch': {},
  '@/lib/operators/domain-parsers/vagaro': {}, '@/lib/source-intake/dora-queue': {}, '@/lib/source-intake/social-queue': {}, './dedupe': {},
};
const cache = new Map();
function load(file) {
  const full = path.resolve(root, file);
  if (cache.has(full)) return cache.get(full);
  const module = { exports: {} }; cache.set(full, module.exports);
  const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, URL, URLSearchParams, Date, structuredClone, process, Buffer, setTimeout, clearTimeout, require(id) {
    if (Object.hasOwn(stubs, id)) return stubs[id];
    if (id.startsWith('node:')) return require(id);
    if (id.startsWith('@/')) return load(`src/${id.slice(2)}.ts`);
    if (id.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(full), `${id}.ts`)));
    throw new Error(`Unexpected dependency ${id}`);
  } }, { filename: full });
  return module.exports;
}
const { parseHashtagPasteRequest } = load('src/lib/hashtag-paste-intake/parser.ts');
const { candidateRowsFromInstagram } = load('src/lib/admin/pipeline/build-queue.ts');
const { recoverCandidateProfile, reconcileCandidateProfile, PROFILE_FACT_RECOVERY_VERSION } = load('src/lib/admin/pipeline/profile-model.ts');
const presentation = load('src/lib/admin/pipeline/profile-presentation.ts');
const store = load('src/lib/admin/pipeline/profile-store.ts');
const { refineReviewProfiles } = load('src/lib/admin/pipeline/profile-runner.ts');
const booking = 'https://studioalpha.glossgenius.com/';
const secondBooking = 'https://www.vagaro.com/studioalpha';
const post = '@studio_alpha\nExample Alpha\nLicensed nail artist. Book appointments: studioalpha.glossgenius.com\nPhotography credit @camera_friend';
const repeat = '@studio_alpha\nExample Alpha\nNail services. Booking: https://www.vagaro.com/studioalpha';
const candidate = { id: 'candidate', intakeId: 'intake', displayName: 'Example Alpha', ordinal: 1, rawBlock: '', bookingUrl: booking, parseConfidence: 'high', reviewAction: 'pending' };
let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`PASS ${name}`); }
async function asyncCheck(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
(async () => {
  check('all owned posts and scheme-less booking links survive ingestion', () => {
    const rows = candidateRowsFromInstagram('intake-multi', `${post}\n\n${repeat}`);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].sourceEvidenceLinks.filter(link => link.attribution === 'provider').length, 2);
    assert.ok(rows[0].sourceEvidenceLinks.every(link => link.sourcePostId && link.sourceUrl));
    const profile = recoverCandidateProfile(rows[0]);
    assert.deepEqual([...profile.knownPlatforms].sort(), ['glossgenius', 'vagaro']);
    assert.equal(rows[0].rawBlock.includes('@camera_friend'), true);
  });
  check('bare-handle display-name fallback retains complete bio URLs', () => {
    const parsed = parseHashtagPasteRequest({ platform: 'instagram', rawText: 'bare_example\nExample Beta\nLicensed nail artist\nhttps://bareexample.glossgenius.com\nBook online: vagaro.com/bareexample' });
    assert.equal(parsed.parsedPosts.length, 1);
    assert.equal(parsed.parsedPosts[0].urls.length, 2);
    assert.ok(parsed.parsedPosts[0].rawBlock.includes('vagaro.com/bareexample'));
  });
  check('client posts retain source links without assigning the client to a provider', () => {
    const raw = '@reviewer_one\nExample Reviewer\nMy girl @tagged_provider did my nails. Highly recommend! https://clientone.glossgenius.com\n\n@reviewer_two\nAnother Reviewer\nMy nail tech @tagged_provider did my nails. Love her work! https://clienttwo.glossgenius.com';
    const rows = candidateRowsFromInstagram('intake-client', raw);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].instagramHandle, 'tagged_provider');
    assert.equal(rows[0].displayName, '@tagged_provider');
    assert.equal(rows[0].bookingUrl, undefined);
    assert.equal(rows[0].sourceEvidenceLinks.length, 2);
    assert.ok(rows[0].sourceEvidenceLinks.every(link => link.attribution === 'unknown' && link.evidenceType === 'client_post'));
    assert.ok(recoverCandidateProfile(rows[0]).bookingLinks.every(link => link.attribution === 'unresolved'));
  });
  check('inline mentions cannot become a source owner', () => {
    const parsed = parseHashtagPasteRequest({ platform: 'instagram', rawText: 'Love the nails from @tagged_provider. Book with her: https://example.glossgenius.com' });
    assert.equal(parsed.parsedPosts[0].handle, undefined);
  });
  check('client-first evidence never becomes the provider caption or booking claim', () => {
    const raw = '@reviewer_start\nExample Reviewer\nMy nail tech @owner_later did my nails. Highly recommend! https://clientonly.glossgenius.com\n\n@owner_later\nExample Owner\nLicensed nail artist in Denver';
    const row = candidateRowsFromInstagram('mixed-intake', raw).find(item => item.instagramHandle === 'owner_later');
    assert.ok(row);
    assert.equal(row.captionSnippet.includes('clientonly'), false);
    assert.ok(recoverCandidateProfile(row).bookingLinks.every(link => link.attribution === 'unresolved'));
  });
  check('same-line tagged booking links respect ownership despite normalized trailing slash', () => {
    const raw = '@owner_line\nExample Owner\nLicensed nail artist. Inspo @other_artist https://foreignexample.glossgenius.com\nBooking: https://ownexample.glossgenius.com';
    const row = candidateRowsFromInstagram('line-intake', raw)[0];
    assert.equal(row.sourceEvidenceLinks.find(link => link.url.includes('foreignexample')).attribution, 'unknown');
    assert.equal(row.sourceEvidenceLinks.find(link => link.url.includes('ownexample')).attribution, 'provider');
  });
  check('fingerprints include newly consumed fields but exclude manual decisions', () => {
    const original = store.fingerprintCandidate(candidate);
    assert.equal(original, store.fingerprintCandidate({ ...candidate, reviewAction: 'hold' }));
    assert.notEqual(original, store.fingerprintCandidate({ ...candidate, captionSnippet: 'Additional source fact' }));
    assert.notEqual(original, store.fingerprintCandidate({ ...candidate, sourceEvidenceLinks: [{ url: secondBooking, attribution: 'provider', evidenceType: 'owned_post' }] }));
    assert.notEqual(original, store.fingerprintCandidate(candidate, [{ url: secondBooking, kind: 'shared_business', attribution: 'business', sourceUrl: secondBooking, basis: 'submitted' }]));
  });
  check('refresh eligibility is independent of review outcomes, social stays unsupported', () => {
    const profile = recoverCandidateProfile(candidate);
    for (const status of ['approved', 'merged', 'rejected', 'held']) assert.equal(presentation.toRefinementQueueItem({ reviewKey: 'intake::candidate', profile, status, lanes: ['DORA'], laneStatuses: { DORA: status } }).eligible, true);
    assert.equal(presentation.toRefinementQueueItem({ reviewKey: 'intake::social', profile: recoverCandidateProfile({ ...candidate, bookingUrl: undefined, instagramHandle: 'synthetic_social' }) }).eligible, false);
    assert.equal(presentation.profileMissingLinkLabel(undefined), 'Booking link not collected');
  });
  await asyncCheck('stale heads retain old safe evidence and normalize before display', async () => {
    const key = 'intake::candidate';
    const originalFingerprint = store.fingerprintCandidate(candidate);
    const original = await store.claimProfileRefinement(key, originalFingerprint);
    assert.equal(original.status, 'claimed');
    const profile = recoverCandidateProfile(candidate);
    delete profile.candidateRef;
    profile.platform = 'unknown'; profile.platformLabel = 'Unknown'; profile.knownPlatforms = [];
    profile.nextAttemptAt = new Date(Date.now() + 86400000).toISOString();
    const record = { schemaVersion: 1, reviewKey: key, fingerprint: originalFingerprint, runId: 'synthetic_old_run', profile, completedAt: new Date().toISOString() };
    assert.equal(await store.completeProfileRefinement(record, original.token), true);
    const changed = { ...candidate, bookingUrl: secondBooking };
    const read = await store.readProfileRefinement(key, store.fingerprintCandidate(changed), changed);
    assert.equal(read.profile.factRecoveryVersion, PROFILE_FACT_RECOVERY_VERSION);
    assert.deepEqual([...read.profile.knownPlatforms].sort(), ['glossgenius', 'vagaro']);
    assert.equal(read.profile.nextAttemptAt, undefined);
    const renamed = { ...changed, displayName: 'Example Updated Name' };
    const historical = await store.readProfileRefinement(key, store.fingerprintCandidate(renamed), renamed);
    assert.ok(historical.profile.bookingLinks.some(link => link.url === booking && link.attribution === 'unresolved'));
    const next = await store.claimProfileRefinement(key, store.fingerprintCandidate(changed));
    assert.equal(next.status, 'claimed');
    assert.equal(next.previous.runId, 'synthetic_old_run');
    await store.releaseProfileLease(key, next.token);
  });
  await asyncCheck('existing held/reviewed records refresh without source or decision mutations', async () => {
    const statuses = ['approved', 'merged', 'rejected'];
    for (let i = 0; i < statuses.length; i++) {
      sourceCandidates.push({ ...candidate, id: `candidate${i}`, reviewAction: 'hold' });
      sourceDora.push({ id: `result${i}`, intakeId: 'intake', candidateId: `candidate${i}`, finalStatus: statuses[i], queueItemId: `queue${i}` });
    }
    const before = JSON.stringify({ sourceCandidates, sourceDora, sourceSocial, staged });
    const results = await refineReviewProfiles(statuses.map((_, i) => `intake::candidate${i}`));
    assert.ok(results.every(result => result.status === 'completed'));
    assert.equal(refinementCalls, 3);
    assert.equal(JSON.stringify({ sourceCandidates, sourceDora, sourceSocial, staged }), before);
    const cached = await refineReviewProfiles(['intake::candidate0']);
    assert.equal(cached[0].status, 'cached'); assert.equal(refinementCalls, 3);
    sourceCandidates[0].bookingUrl = secondBooking;
    const changed = await refineReviewProfiles(['intake::candidate0']);
    assert.equal(changed[0].status, 'completed'); assert.equal(refinementCalls, 4);
    assert.deepEqual([...changed[0].profile.knownPlatforms].sort(), ['glossgenius', 'vagaro']);
  });
  await asyncCheck('new exact-key staged links invalidate cache, foreign candidates stay separate', async () => {
    staged.push({ id: 'staged-link', intakeId: 'intake', candidateId: 'candidate1', factType: 'booking_url', factValue: secondBooking, sourceUrl: secondBooking, attribution: 'business', sourceRef: 'synthetic-import:row1' });
    staged.push({ id: 'foreign-link', intakeId: 'other', candidateId: 'candidate1', factType: 'booking_url', factValue: 'https://booksy.com/en-us/123_synthetic', attribution: 'candidate', sourceRef: 'synthetic-import:other' });
    const refreshed = await refineReviewProfiles(['intake::candidate1']);
    assert.equal(refreshed[0].status, 'completed');
    assert.ok(refreshed[0].profile.knownPlatforms.includes('vagaro'));
    assert.equal(refreshed[0].profile.knownPlatforms.includes('booksy'), false);
  });
  await asyncCheck('ambiguous legacy keys never trigger a source refresh', async () => {
    const before = refinementCalls;
    const result = await refineReviewProfiles(['intake::nested::candidate', 'intake:::candidate']);
    assert.equal(result[0].status, 'skipped');
    assert.equal(result[0].error, 'ambiguous_source_key');
    assert.equal(result[1].error, 'ambiguous_source_key');
    assert.equal(refinementCalls, before);
  });
  console.log(`Intake/fact refresh regression checks passed: ${checks}. Synthetic fixtures only; no network or production writes.`);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => fs.rmSync(runtimeRoot, { recursive: true, force: true }));
