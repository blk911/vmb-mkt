/** Synthetic-only: no network, credentials, or production fixtures. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');
function loader(stubs = {}, globals = {}) {
  const cache = new Map();
  function load(file) {
    const full = path.resolve(__dirname, '..', file);
    if (cache.has(full)) return cache.get(full).exports;
    const module = { exports: {} }; cache.set(full, module);
    const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    vm.runInNewContext(code, { module, exports: module.exports, structuredClone, URL, Date, Buffer, ...globals, require(id) {
      if (id in stubs) return stubs[id];
      if (id === 'server-only') return {};
      if (id === 'node:crypto') return crypto;
      if (id.startsWith('@/')) return load(`src/${id.slice(2)}.ts`);
      if (id.startsWith('.')) return load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(full), id + '.ts')));
      throw new Error(`Unexpected import ${id}`);
    } }, { filename: full });
    return module.exports;
  }
  return load;
}
const load = loader();
const { projectCatalog, CATALOG_COLLECTIONS } = load('src/lib/catalog/projection.ts');
const { filterCatalogRecords } = load('src/lib/catalog/query.ts');
const { targetListCatalogCsv } = load('src/app/admin/_lib/targets/catalogMembership.ts');
const { withStableStagedEvidenceId } = load('src/lib/source-intake/evidence-identity.ts');
const { planLegacyEvidenceRecovery } = load('src/lib/source-intake/legacy-evidence-recovery.ts');
const blank = () => Object.fromEntries(CATALOG_COLLECTIONS.map(key => [key, []]));
const doc = (id, data) => ({ id, data, updatedAt: '2026-01-01T00:00:00.000Z' });
const candidate = (id = 'c1') => ({ id, intakeId: 'i1', displayName: 'Synthetic Provider', ordinal: 1, rawBlock: '', parseConfidence: 'high' });
const fingerprint = value => JSON.stringify(value);
const evidence = (id, extra = {}) => ({ id, intakeId: 'i1', candidateId: 'c1', sourceType: 'manual_field_note', sourceLabel: 'Synthetic evidence', observedAt: '2026-01-01T00:00:00.000Z', candidateName: 'Synthetic Provider', factType: 'booking_url', factValue: 'https://synthetic.glossgenius.com/', confidence: 'high', ...extra });
function fixture() { const s = blank(); s.adminPipelineParsedCandidates = [doc('candidate-document', candidate()), doc('unrelated-document', candidate('c2'))]; return s; }
function provider(s) { return projectCatalog(s, fingerprint).rows.find(r => r.sourceIdentifiers?.candidateId === 'c1'); }

async function main() {
  const sources = fixture();
  sources.adminPipelineSocialQueue = [doc('sq', { id: 'sq', intakeId: 'i1', candidateId: 'c1', status: 'approved' })];
  sources.adminPipelineSocialResults = [doc('sr', { id: 'sr', queueItemId: 'sq', intakeId: 'i1', candidateId: 'c1', finalStatus: 'approved', evidenceIds: ['raw-evidence-id'], discoveredSurfaces: [
    { type: 'booking', value: 'https://synthetic.glossgenius.com/', confidence: 'medium', reasons: ['candidate_source_reported_link_not_fetched_or_identity_verified', 'shared_business_link_not_provider_identity'] },
    { type: 'booking', value: 'https://www.vagaro.com/unverifiedbusiness', confidence: 'high', reasons: ['search_discovery_only_not_fetched_or_identity_verified'] },
    { type: 'instagram', value: '@synthetic_candidate', confidence: 'high', reasons: ['search title overlap'] },
  ] })];
  sources.adminPipelineDoraResults = [doc('dr', { id: 'dr', intakeId: 'i1', candidateId: 'c1', matchedLicenseName: 'Synthetic Provider', matchedLicenseNumber: 'SYNTHETIC-000', licenseType: 'Synthetic Type', licenseStatusText: 'Synthetic status', city: 'Synthetic City', status: 'possible_match', score: 70, reasons: ['synthetic'] })];
  sources.adminPipelineOperatorEvidence = [doc('e1', evidence('e1')), doc('orphan-evidence', evidence('orphan-evidence', { candidateId: 'absent' }))];
  const raw = JSON.stringify(sources), projected = projectCatalog(sources, fingerprint), row = provider(sources);
  assert.equal(JSON.stringify(sources), raw, 'source and manual decisions never mutate');
  assert.equal(row.id, 'provider:adminPipelineParsedCandidates:candidate-document');
  assert.equal(row.platformLabel, 'GlossGenius');
  assert.ok(row.profile.bookingLinks.some(link => link.url.includes('vagaro') && link.attribution === 'unresolved'));
  assert.ok(row.profile.socialLinks.some(link => link.url.includes('instagram') && link.attribution === 'unresolved'));
  assert.equal(filterCatalogRecords([row], { platform: 'vagaro' }).length, 0, 'unverified search is not platform ownership');
  assert.equal(filterCatalogRecords([row], { hasSocial: 'yes' }).length, 0);
  assert.ok(row.factClaims.some(fact => fact.kind === 'dora_matchedLicenseNumber' && fact.value === 'SYNTHETIC-000'));
  assert.equal(row.city, '', 'DORA match city is not silently promoted to person location');
  assert.equal(projected.orphanEvidenceCount, 1);
  assert.equal(projected.rows.find(r => r.sourceIdentifiers?.candidateId === 'c2').profile.bookingLinks.length, 0, 'same intake never borrows facts');
  assert.equal(projected.evidenceAudit.before.knownPlatform, 0);
  assert.equal(projected.evidenceAudit.after.knownPlatform, 1);
  assert.ok(projected.evidenceAudit.after.licenseClaims > 0);
  assert.equal(JSON.stringify(projectCatalog(sources, fingerprint)), JSON.stringify(projected), 'stable derived recomputation');
  assert.ok(row.sourceRefs.some(ref => ref.collection === 'adminPipelineOperatorEvidence' && ref.id === 'e1'));
  assert.ok(row.factClaims.some(fact => fact.evidenceIds?.includes('raw-evidence-id')));

  const multi = fixture(); multi.adminPipelineParsedCandidates[0].data.bookingUrl = 'https://synthetic.glossgenius.com/';
  multi.adminPipelineOperatorEvidence = [doc('e2', evidence('e2', { factValue: 'https://www.vagaro.com/syntheticbusiness', attribution: 'business', sourceRef: 'synthetic:source' }))];
  const multiRow = provider(multi);
  assert.ok(multiRow.platformLabel.includes('GlossGenius') && multiRow.platformLabel.includes('Vagaro'));
  for (const platform of ['vagaro', 'glossgenius']) assert.equal(filterCatalogRecords([multiRow], { platform }).length, 1);
  assert.equal(filterCatalogRecords([multiRow], { platform: 'unknown' }).length, 0);
  const list = { id: 'synthetic-list', name: 'Synthetic', membershipMode: 'snapshot', catalogIds: [row.id], items: [], workflow: {} };
  const csv = targetListCatalogCsv(list, [row], '2026-01-01').csv;
  assert.ok(csv.includes('unresolvedDiscoveries') && csv.includes('factClaims') && csv.includes('raw-evidence-id'));
  assert.ok(csv.includes('GlossGenius'));

  const legacy = blank(); legacy.tech_index = [doc('business', { id: 'retained-raw-id', displayName: 'Synthetic Salon', premise: { links: { bookingUrl: 'https://synthetic.glossgenius.com/' }, social: { instagram: '@synthetic_salon' } }, places: { best: { websiteUrl: 'https://synthetic.example.com/' } }, staff: [{ bookingUrl: 'https://www.vagaro.com/unrelatedperson' }] })];
  const business = projectCatalog(legacy, fingerprint).rows[0];
  assert.equal(business.providerName, '');
  assert.equal(business.profile.providerName, '');
  assert.equal(business.platformLabel, 'GlossGenius');
  assert.ok(business.profile.socialLinks.length && business.profile.websiteLinks.length);
  assert.ok(business.profile.bookingLinks.every(link => link.attribution === 'business'));
  assert.ok(!business.profile.bookingLinks.some(link => link.url.includes('unrelatedperson')));
  assert.ok(business.legacyIds.includes('retained-raw-id'));

  const archiveRows = [evidence('archive-evidence'), evidence('unrelated-archive', { candidateId: 'unrelated' })];
  const archiveText = JSON.stringify(archiveRows), expectedSha256 = crypto.createHash('sha256').update(archiveText).digest('hex');
  const input = { archiveText, expectedSha256, sourceDescription: 'Explicit synthetic archive', allowedIntakeIds: ['i1'] };
  const plan = planLegacyEvidenceRecovery(input, [candidate()], []);
  assert.equal(plan.status, 'verified_plan_not_imported'); assert.equal(plan.rowsToAppend.length, 1); assert.equal(plan.rejectedRows.length, 1); assert.equal(plan.destructiveChanges, 0);
  assert.equal(planLegacyEvidenceRecovery(input, [candidate()], plan.rowsToAppend).rowsToAppend.length, 0);
  assert.throws(() => planLegacyEvidenceRecovery({ ...input, expectedSha256: '0'.repeat(64) }, [candidate()], []), /checksum/);
  assert.throws(() => planLegacyEvidenceRecovery({ ...input, allowedIntakeIds: [] }, [candidate()], []), /scope/);

  const stored = new Map(); let commits = 0;
  const db = { collection(name) { assert.equal(name, 'adminPipelineOperatorEvidence'); return { doc(id) { return { id }; }, async get() { return { docs: [...stored].map(([id, data]) => ({ id, data: () => structuredClone(data) })) }; } }; }, async runTransaction(callback) { const pending = []; const result = await callback({ async getAll(...refs) { return refs.map(ref => ({ exists: stored.has(ref.id), data: () => stored.get(ref.id) })); }, create(ref, row) { pending.push([ref.id, row]); } }); for (const [id, value] of pending) stored.set(id, structuredClone(value)); commits += pending.length; return result; } };
  const durable = loader({ '@/lib/admin/firestoreAdmin': { adminDb: () => db } })('src/lib/source-intake/firestore-staged-evidence.ts');
  await durable.firestoreAppendStagedOperatorEvidence([evidence('durable')]);
  await durable.firestoreAppendStagedOperatorEvidence([evidence('durable')]);
  assert.equal(commits, 1, 'same evidence ID retry is idempotent');
  await assert.rejects(durable.firestoreAppendStagedOperatorEvidence([evidence('durable', { factValue: 'https://changed.example.com' })]), /id_conflict/);
  assert.equal(stored.get('durable').factValue, evidence('durable').factValue);
  await durable.firestoreAppendStagedOperatorEvidence([evidence('second-raw-id')]);
  assert.equal(stored.size, 2, 'equal fact values preserve distinct raw IDs');
  const stableRow = withStableStagedEvidenceId(evidence('unused-generated-id'));
  const stableRetry = withStableStagedEvidenceId(evidence('different-generated-id', { observedAt: '2026-01-02T00:00:00.000Z' }));
  assert.equal(stableRow.id, stableRetry.id);
  await durable.firestoreAppendStagedOperatorEvidence([stableRow]);
  await durable.firestoreAppendStagedOperatorEvidence([stableRetry]);
  assert.equal(stored.size, 3);
  assert.equal(stored.get(stableRow.id).observedAt, stableRow.observedAt, 'retry retains first observation without overwriting');
  assert.notEqual(withStableStagedEvidenceId(evidence('unused', { candidateId: 'different' })).id, stableRow.id);
  const failing = loader({ '@/lib/admin/firestoreAdmin': { adminDb() { throw new Error('durable-unavailable'); } } })('src/lib/source-intake/firestore-staged-evidence.ts');
  await assert.rejects(failing.firestoreListStagedOperatorEvidence(), /durable-unavailable/);

  let reads = 0, writes = 0;
  const routed = loader({ 'node:fs/promises': { mkdir() { throw new Error('file fallback forbidden'); } }, 'node:path': require('node:path'), '@/app/api/admin/_lib/atomic': {}, '@/lib/admin/pipeline/canonical-store-config': { usesFirestoreCanonicalPipelineStore: () => true }, '@/lib/admin/pipeline/firestore-canonical-store': {}, '@/lib/runtime/runtime-data-root': { getRuntimeDataRoot: () => '/synthetic-only' }, '@/lib/social-targets/json-file': {}, './firestore-staged-evidence': { async firestoreListStagedOperatorEvidence() { reads++; return []; }, async firestoreAppendStagedOperatorEvidence(rows) { writes++; return rows; } } })('src/lib/source-intake/store.ts');
  await routed.listStagedOperatorEvidence(); await routed.appendStagedOperatorEvidence([evidence('routed')]);
  assert.equal(reads, 1); assert.equal(writes, 1);
  console.log('Catalog fact-source tests passed: durable append-only staging, source-lane claims, exact candidate scope, known-platform filters, legacy business aliases, same-snapshot audit, and bounded archive dry plan.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
