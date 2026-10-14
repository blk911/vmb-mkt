/* Hermetic shared-list tests. Synthetic records only; no network, credentials, or live data. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
const cache = new Map();
let routeDb;
let routeUser = { username: 'test-member', role: 'member' };
let catalogRows = [];
let catalogFails = false;
const copy = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
function load(file) {
  const absolute = path.resolve(root, file);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const module = { exports: {} };
  cache.set(absolute, module);
  const source = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const requireFrom = Module.createRequire(absolute);
  const localRequire = (id) => {
    if (id === '@/lib/admin/firestoreAdmin') return { adminDb: () => routeDb };
    if (id === '@/lib/auth/access') return {
      getSessionUserFromCookieHeader: async () => routeUser,
      canAccessMemberArea: (user) => user?.role === 'member' || user?.role === 'admin',
      canAccessAdmin: (user) => user?.role === 'admin',
    };
    if (id === '@/lib/access/requestAccessStore') return { listAccessRequests: async () => ({ requests: [] }) };
    if (id === '@/lib/catalog/store') return { loadSharedCatalog: async () => {
      if (catalogFails) throw new Error('Synthetic catalog unavailable');
      return { rows: copy(catalogRows), coverage: { complete: true }, generatedAt: '2026-01-01T00:00:00.000Z' };
    } };
    if (id.startsWith('@/') || id.startsWith('.')) {
      let target = id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : path.resolve(path.dirname(absolute), id);
      if (!path.extname(target)) target += '.ts';
      if (target.endsWith('.ts')) return load(target);
    }
    return requireFrom(id);
  };
  new Function('require', 'module', 'exports', '__filename', '__dirname', source)(localRequire, module, module.exports, absolute, path.dirname(absolute));
  return module.exports;
}
class FakeFirestore {
  documents = new Map();
  transactions = 0;
  retries = 0;
  collection(name) {
    const db = this;
    return {
      doc(id) { return { id, key: `${name}/${id}`, get: async () => db.snapshot(`${name}/${id}`, id) }; },
      get: async () => ({ docs: [...db.documents.keys()].filter((key) => key.startsWith(`${name}/`)).map((key) => db.snapshot(key, key.slice(name.length + 1))) }),
    };
  }
  snapshot(key, id) {
    const entry = this.documents.get(key);
    return { id, exists: !!entry, data: () => copy(entry?.data) };
  }
  async runTransaction(callback) {
    this.transactions++;
    for (let attempt = 0; attempt < 100; attempt++) {
      const reads = new Map();
      const writes = [];
      const result = await callback({
        get: async (ref) => { reads.set(ref.key, this.documents.get(ref.key)?.version || 0); return this.snapshot(ref.key, ref.id); },
        set: (ref, data) => writes.push({ ref, data: copy(data) }),
        create: (ref, data) => writes.push({ ref, data: copy(data), create: true }),
      });
      if ([...reads].some(([key, version]) => (this.documents.get(key)?.version || 0) !== version)) { this.retries++; continue; }
      for (const { ref, data, create } of writes) {
        if (create && this.documents.has(ref.key)) throw new Error('already_exists');
        this.documents.set(ref.key, { data, version: (this.documents.get(ref.key)?.version || 0) + 1 });
      }
      return result;
    }
    throw new Error('Synthetic transaction retry limit exceeded');
  }
}
function row(id, overrides = {}) {
  return {
    id, entityType: 'provider', displayName: `Example ${id}`, providerName: 'Example Provider', businessName: 'Example Salon', platformLabel: 'Booksy', city: 'Denver', state: 'CO', postalCode: '80000', area: 'Denver', services: ['Nails'], reviewStatus: 'unreviewed', sourceRefs: [], linkedEntities: [], reviewDecisions: [], conflicts: [], evidence: [], updatedAt: '2026-01-01T00:00:00.000Z', legacyIds: [], ...overrides,
  };
}
const request = (body, url = 'http://test.local/api/targets/lists') => new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://test.local' }, body: JSON.stringify(body) });
async function run() {
  const storeModule = load('src/app/admin/_lib/targets/store.ts');
  const { createTargetListStore, TARGET_LIST_COLLECTION } = storeModule;
  const db = new FakeFirestore();
  const store = createTargetListStore(() => db);
  const first = await store.createTargetList({ name: 'Initial fixed', scope: 'tech', catalogIds: ['provider:test:a', 'provider:test:a'], selectionSnapshots: [{kind:'tech',refId:'provider:test:a',catalogId:'provider:test:a',label:'Original selection name',city:'Original city'}], savedQuery: { city: 'Denver' }, workflow: { owner: 'Owner', nextAction: 'Review', nextActionAt: '2026-01-01' } });
  assert.equal(first.membershipMode, 'fixed');
  assert.deepEqual(first.catalogIds, ['provider:test:a']);
  assert.equal(first.items.length, 1);
  assert.equal(first.workflow.nextAction, 'Review');
  assert.equal(db.transactions, 1, 'Creation includes membership atomically');
  await Promise.all(Array.from({ length: 15 }, (_, i) => store.addItems(first.id, [{ kind: 'tech', refId: `provider:test:${i}`, label: `Synthetic ${i}` }])));
  let current = await store.readTargetList(first.id);
  assert.equal(current.catalogIds.length, 16, 'Concurrent additions must not lose membership');
  assert(db.retries > 0, 'Synthetic conflicts exercise transaction retries');
  await Promise.all([
    store.updateListMeta(first.id, { workflow: { owner: 'New Owner' }, activityEntry: { type: 'owner', detail: 'owner' } }),
    store.updateListMeta(first.id, { workflow: { nextAction: 'Call later' }, activityEntry: { type: 'next_action', detail: 'next action' } }),
    store.updateListMeta(first.id, { savedQuery: { city: 'Boulder' } }),
  ]);
  current = await store.readTargetList(first.id);
  assert.equal(current.workflow.owner, 'New Owner');
  assert.equal(current.workflow.nextAction, 'Call later');
  assert.equal(current.catalogIds.length, 16, 'Changing filters never changes fixed recipients');
  assert(current.activity.some((activity) => activity.type === 'owner'));
  assert(current.activity.some((activity) => activity.type === 'next_action'));
  assert.equal((await store.readTargetList(first.id)).items.find(item => item.catalogId === 'provider:test:a')?.label, 'Original selection name', 'selection-time label survives later list edits');
  const restarted = createTargetListStore(() => db);
  assert.deepEqual((await restarted.readTargetList(first.id)).catalogIds, current.catalogIds, 'A new process adapter reads the same durable documents');
  await Promise.all([
    store.removeItems(first.id, ['provider:test:0']),
    store.addItems(first.id, [{ kind: 'tech', refId: 'provider:test:new', label: 'New' }]),
  ]);
  current = await store.readTargetList(first.id);
  assert(!current.catalogIds.includes('provider:test:0'));
  assert(current.catalogIds.includes('provider:test:new'));
  await store.deleteTargetList(first.id, 'Admin');
  assert.equal(await store.readTargetList(first.id), null);
  assert.equal((await store.listTargetLists()).lists.length, 0);
  const archived = await store.readTargetList(first.id, { includeArchived: true });
  assert.equal(archived.archivedBy, 'Admin');
  assert.deepEqual(archived.catalogIds, current.catalogIds);
  assert(db.documents.has(`${TARGET_LIST_COLLECTION}/${first.id}`), 'Archive retains stored data');
  await assert.rejects(store.addItems(first.id, []), { code: 'list_archived', status: 409 });
  await store.restoreTargetList(first.id, 'Admin');
  assert.deepEqual((await store.readTargetList(first.id)).catalogIds, current.catalogIds);
  catalogRows = [row('business:tech_index:physical-id', { entityType: 'business', legacyIds: ['physical-id', 'stored-id'], sourceRefs: [{ collection: 'tech_index', id: 'physical-id', role: 'source' }] }), row('provider:test:collision1', { legacyIds: ['collision'] }), row('business:tech_index:collision2', { legacyIds: ['collision'] })];
  const legacy = await store.createTargetList({ name: 'Legacy refs', scope: 'facility' });
  await store.addItems(legacy.id, [{ kind: 'tech', refId: 'stored-id', label: 'Tech' }, { kind: 'facility', refId: 'address-key', label: 'Facility' }, { kind: 'tech', refId: 'collision', label: 'Ambiguous alias' }, { kind: 'tech', refId: 'missing-alias', label: 'Unknown alias' }]);
  const legacyRead = await store.readTargetList(legacy.id);
  assert.deepEqual(legacyRead.catalogIds, ['business:tech_index:physical-id'], 'Unique legacy aliases resolve once to physical canonical identity');
  assert.equal(legacyRead.items[2].referenceResolution, 'ambiguous');
  assert.equal(legacyRead.items[3].referenceResolution, 'unresolved');
  catalogRows = [row('business:tech_index:different', { legacyIds: ['stored-id', 'collision', 'missing-alias'] })];
  assert.deepEqual((await store.readTargetList(legacy.id)).catalogIds, ['business:tech_index:physical-id'], 'Changing aliases never rebinds a stored member');
  await store.addItems(legacy.id, [{ kind: 'tech', refId: 'stored-id', label: 'Repeated original alias' }]);
  assert.deepEqual((await store.readTargetList(legacy.id)).catalogIds, ['business:tech_index:physical-id'], 'A repeated legacy add is idempotent even if source aliases changed');
  catalogFails = true;
  await assert.rejects(store.addItems(legacy.id, [{ kind: 'tech', refId: 'offline-alias', label: 'Offline' }]), { code: 'shared_catalog_unavailable', status: 503 });
  catalogFails = false;
  catalogRows = [];
  assert.equal(legacyRead.items[1].catalogId, undefined, 'Never guess unrelated facility identity');
  const dynamic = await store.createTargetList({ name: 'Denver dynamic', scope: 'tech', membershipMode: 'dynamic', savedQuery: { city: 'Denver' } });
  await assert.rejects(store.addItems(dynamic.id, [{ kind: 'tech', refId: 'x', label: 'x' }]), { code: 'dynamic_membership' });
  await assert.rejects(store.removeItems(dynamic.id, ['x']), { code: 'dynamic_membership' });
  await assert.rejects(store.createTargetList({ name: 'Bad dynamic', scope: 'tech', membershipMode: 'dynamic', catalogIds: ['x'] }), { status: 400 });
  await assert.rejects(store.createTargetList({ name: 'Too large', scope: 'tech', catalogIds: Array.from({ length: 2501 }, (_, i) => `provider:t:${i}`) }), { status: 400 });
  await assert.rejects(store.createTargetList({ name: 'Invalid IDs', scope: 'tech', catalogIds: ['not-a-catalog-id'] }), { status: 400 });
  await assert.rejects(store.createTargetList({ name: 'Unknown dynamic filter', scope: 'tech', membershipMode: 'dynamic', savedQuery: { unknown: 'not ignored' } }), { status: 400 });
  await assert.rejects(store.readTargetList('../invalid'), { status: 400 });
  const offline = createTargetListStore(() => { throw new Error('Synthetic credentials absent'); });
  await assert.rejects(offline.listTargetLists(), { code: 'shared_list_store_unavailable', status: 503 });
  await assert.rejects(offline.createTargetList({ name: 'No fallback', scope: 'tech' }), { code: 'shared_list_store_unavailable', status: 503 });
  assert.equal((await store.listTargetLists()).coverage.legacyFileLists, 'not_imported_unverified');
  const membership = load('src/app/admin/_lib/targets/catalogMembership.ts');
  const rows = [row('provider:test:a'), row('provider:test:b', { city: 'Boulder' })];
  assert.deepEqual(membership.resolveTargetListMembership(first, rows).catalogIds, ['provider:test:a']);
  assert.deepEqual(membership.resolveTargetListMembership(first, []).missingIds, ['provider:test:a']);
  assert.equal(membership.resolveTargetListMembership(dynamic, rows).rows.length, 1);
  assert.equal(membership.resolveTargetListMembership(dynamic, [...rows, row('provider:test:c')]).rows.length, 2);
  assert.throws(() => membership.validateDynamicFilters({ unsupportedPredicate: 'ignored' }));
  for (const input of ['=1+1', '+SUM(A1)', '-1+2', '@SUM(A1)', '  =1', '\t=1', '\u0000=1']) assert(membership.csvCell(input).startsWith('"\''), `Unsafe CSV cell: ${JSON.stringify(input)}`);
  assert.equal(membership.csvCell('A "quoted" name'), '"A ""quoted"" name"');
  const exported = membership.targetListCatalogCsv({ ...first, name: '=HYPERLINK("bad")' }, [], '2026-01-01');
  assert(exported.csv.includes('catalog_record_unavailable'));
  assert(exported.csv.includes('provider:test:a'));
  assert(exported.csv.includes("'=HYPERLINK"));
  assert(membership.targetListCatalogCsv(legacyRead, [], '2026-01-01').csv.includes('unresolved_legacy_reference'));

  routeDb = new FakeFirestore();
  const api = load('src/app/api/targets/lists/route.ts');
  const exportApi = load('src/app/api/targets/export/route.ts');
  routeUser = null;
  assert.equal((await api.GET(new Request('http://test.local/api/targets/lists'))).status, 401);
  assert.equal((await api.POST(request({ op: 'create', name: 'Denied' }))).status, 401);
  assert.equal((await exportApi.GET(new Request('http://test.local/api/targets/export?listId=test'))).status, 401);
  routeUser = { username: 'external', role: 'external' };
  assert.equal((await api.GET(new Request('http://test.local/api/targets/lists'))).status, 403);
  routeUser = { username: 'member', role: 'member' };
  assert.equal((await api.POST(new Request('http://test.local/api/targets/lists', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://evil.test' }, body: JSON.stringify({ op: 'create', name: 'CSRF' }) }))).status, 403);
  assert.equal((await api.POST(new Request('http://test.local/api/targets/lists', { method: 'POST', headers: { 'Content-Type': 'text/plain', Origin: 'http://test.local' }, body: JSON.stringify({ op: 'create', name: 'Wrong content type' }) }))).status, 415);
  assert.equal((await api.POST(new Request('http://test.local/api/targets/lists', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://test.local' }, body: ' '.repeat(750_001) }))).status, 413);
  let result = await api.POST(request({ op: 'create', name: 'API fixed', catalogIds: ['provider:test:a'], filters: { city: 'Denver' } }));
  assert.equal(result.status, 200);
  const fixedApi = (await result.json()).list;
  assert.deepEqual(fixedApi.catalogIds, ['provider:test:a']);
  assert.equal(routeDb.transactions, 1);
  let fixedOnly = await api.GET(new Request('http://test.local/api/targets/lists'));
  let fixedOnlyBody = await fixedOnly.json();
  assert.deepEqual(fixedOnlyBody.lists[0].unresolvedCatalogIds, ['provider:test:a']);
  assert.equal(fixedOnlyBody.lists[0].membershipResolved, true);
  catalogFails = true;
  assert.equal((await api.GET(new Request('http://test.local/api/targets/lists'))).status, 503);
  catalogFails = false;
  assert.equal((await api.POST(request({ op: 'delete', id: fixedApi.id }))).status, 403);
  assert.equal((await api.POST(request({ op: 'setNotes', id: fixedApi.id }))).status, 400);
  assert.equal((await api.POST(request({ op: 'setFilters', id: fixedApi.id }))).status, 400);
  assert.equal((await api.POST(request({ op: 'setWorkflow', id: fixedApi.id, workflow: { stage: 'invalid' } }))).status, 400);
  assert.equal((await api.GET(new Request('http://test.local/api/targets/lists?includeArchived=true'))).status, 403);
  assert.equal((await api.POST(request({ op: 'create', name: 'Bad mode', membershipMode: 'changing' }))).status, 400);
  assert.equal((await api.POST(request({ op: 'create', name: 'Bad IDs', catalogIds: [{ id: 'x' }] }))).status, 400);
  assert.equal((await api.POST(request({ op: 'create', name: 'Bad filters', membershipMode: 'dynamic', filters: { unknown: 'x' } }))).status, 400);
  catalogRows = rows;
  result = await api.POST(request({ op: 'create', name: 'API dynamic', membershipMode: 'dynamic', filters: { city: 'Denver' } }));
  const dynamicApi = (await result.json()).list;
  assert.deepEqual(dynamicApi.catalogIds, ['provider:test:a']);
  catalogRows = [...rows, row('provider:test:c')];
  result = await api.GET(new Request('http://test.local/api/targets/lists'));
  let response = await result.json();
  assert.equal(response.lists.find((list) => list.id === dynamicApi.id).catalogIds.length, 2);
  assert.deepEqual(response.lists.find((list) => list.id === fixedApi.id).catalogIds, ['provider:test:a']);
  result = await api.POST(request({ op: 'setFilters', id: fixedApi.id, filters: { city: 'Boulder' } }));
  assert.deepEqual((await result.json()).list.catalogIds, ['provider:test:a']);
  assert.equal((await api.POST(request({ op: 'addMany', id: dynamicApi.id, catalogIds: ['provider:test:b'] }))).status, 409);
  result = await exportApi.GET(new Request(`http://test.local/api/targets/export?listId=${fixedApi.id}`));
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('X-List-Membership-Mode'), 'fixed');
  assert((await result.text()).includes('Example Provider'));
  catalogRows = [];
  result = await exportApi.GET(new Request(`http://test.local/api/targets/export?listId=${fixedApi.id}`));
  assert.equal(result.headers.get('X-Unresolved-Member-Count'), '1');
  assert((await result.text()).includes('catalog_record_unavailable'));
  const missingResponse = await api.POST(request({ op: 'create', name: 'Remove missing ID', catalogIds: ['provider:absent:member'] }));
  const missingList = (await missingResponse.json()).list;
  assert.deepEqual(missingList.unresolvedCatalogIds, ['provider:absent:member']);
  const removedMissing = await api.POST(request({ op: 'removeMany', id: missingList.id, catalogIds: ['provider:absent:member'] }));
  assert.deepEqual((await removedMissing.json()).list.catalogIds, []);
  catalogFails = true;
  const beforeCreate = routeDb.documents.size;
  assert.equal((await api.POST(request({ op: 'create', name: 'Offline dynamic', membershipMode: 'dynamic', filters: {} }))).status, 503);
  assert.equal(routeDb.documents.size, beforeCreate, 'Failed dynamic resolution must not commit a list');
  assert.equal((await exportApi.GET(new Request(`http://test.local/api/targets/export?listId=${fixedApi.id}`))).status, 503);
  catalogFails = false;
  routeUser = { username: 'admin', role: 'admin' };
  result = await api.POST(request({ op: 'delete', id: fixedApi.id }));
  assert.equal(result.status, 200);
  assert.equal((await result.json()).recoverable, true);
  assert.equal((await api.POST(request({ op: 'restore', id: fixedApi.id }))).status, 200);
  result = await api.GET(new Request('http://test.local/api/targets/lists?includeArchived=true'));
  response = await result.json();
  assert(response.lists.some((list) => list.id === fixedApi.id));
  catalogRows = [row('provider:test:preview1'), row('provider:test:preview2')];
  await api.POST(request({ op: 'setWorkflow', id: dynamicApi.id, workflow: { stage: 'qualified' } }));
  const opsApi = load('src/app/api/dashboard/ops-report/route.ts');
  const previewApi = load('src/app/api/integrations/highlevel/preview/route.ts');
  let report = await opsApi.GET(new Request('http://test.local/api/dashboard/ops-report'));
  assert.equal(report.status, 200);
  let reportBody = await report.json();
  assert.equal(reportBody.summary.dynamicMatchCount, 2, 'Ops counts current dynamic matches');
  let preview = await previewApi.GET(new Request('http://test.local/api/integrations/highlevel/preview'));
  let previewBody = await preview.json();
  assert.equal(previewBody.payload.previewOnly, true);
  assert.equal(previewBody.payload.deliveryEnabled, false);
  assert.equal(previewBody.payload.lists.find((list) => list.id === dynamicApi.id).targetCount, 2);
  assert.equal(previewBody.payload.lists.find((list) => list.id === dynamicApi.id).membershipMode, 'dynamic');
  assert.match(previewBody.payload.lists.find((list) => list.id === dynamicApi.id).membershipNote, /preview only/);
  catalogRows = [];
  catalogFails = true;
  assert.equal((await opsApi.GET(new Request('http://test.local/api/dashboard/ops-report'))).status, 503);
  assert.equal((await previewApi.GET(new Request('http://test.local/api/integrations/highlevel/preview'))).status, 503);
  catalogFails = false;
  routeUser = null;
  assert.equal((await opsApi.GET(new Request('http://test.local/api/dashboard/ops-report'))).status, 401);
  assert.equal((await previewApi.GET(new Request('http://test.local/api/integrations/highlevel/preview'))).status, 401);
  routeUser = { username: 'admin', role: 'admin' };
  const adminExport = load('src/app/api/admin/targets/[listId]/export/route.ts');
  result = await adminExport.GET(new Request(`http://test.local/api/admin/targets/${fixedApi.id}/export?format=json`), { params: Promise.resolve({ listId: fixedApi.id }) });
  assert.equal(result.status, 200);
  assert.deepEqual((await result.json()).unresolvedCatalogIds, ['provider:test:a']);
  routeUser = { username: 'member', role: 'member' };
  assert.equal((await adminExport.GET(new Request(`http://test.local/export`), { params: Promise.resolve({ listId: fixedApi.id }) })).status, 403);
  console.log('Shared lists: atomic creation, transaction retries, concurrent edits, persistence, fixed/dynamic membership, archive/restore, legacy coverage, auth, failure handling, and safe catalog exports passed.');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
