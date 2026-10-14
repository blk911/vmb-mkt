/** Hermetic record-review regressions. Synthetic fixtures only; no network or production writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const tests = [];
const test = (name, run) => tests.push({ name, run });
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const forbidden = () => { throw new Error('Live requests are forbidden in unified UI tests.'); };
function loader(overrides = {}, globals = {}) {
  const cache = new Map();
  function load(relative) {
    const file = path.resolve(root, relative);
    assert(file.startsWith(root + path.sep), 'Test modules must remain in the repository.');
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    vm.runInNewContext(source, {
      module, exports: module.exports, URL, URLSearchParams, Date, AbortController, Request, Response, Headers,
      Buffer, TextDecoder, TextEncoder, setTimeout, clearTimeout, queueMicrotask, console, fetch: forbidden, ...globals,
      require(id) {
        if (Object.hasOwn(overrides, id)) return overrides[id];
        if (['react', 'react/jsx-runtime', 'node:crypto', 'next/server'].includes(id)) return require(id);
        if (id === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
        if (id === 'next/navigation') return { useRouter: () => ({ refresh() {} }), usePathname: () => globals.window?.location.pathname || '/dashboard/data', useSearchParams: () => new URLSearchParams(globals.window?.location.search || '') };
        if (id.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
        if (id.startsWith('@/') || id.startsWith('.')) {
          const stem = id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : path.resolve(path.dirname(file), id);
          const target = ['', '.ts', '.tsx', '.js', '/index.ts', '/index.tsx'].map(ext => stem + ext).find(value => fs.existsSync(value) && fs.statSync(value).isFile());
          if (!target) throw new Error(`Missing import: ${id}`);
          return load(path.relative(root, target));
        }
        throw new Error(`Unexpected test import: ${id}`);
      },
    }, { filename: file });
    return module.exports;
  }
  return load;
}

// Deterministic hook harness: effects, cleanup, refs, setters and events run, but
// nested children are inspected separately so tests cannot launch their requests.
function harness(file, initialProps = {}, globals = {}, overrides = {}) {
  const slots = []; let cursor = 0, effects = [], props = initialProps, tree, dirty = true, mounted = true;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const hooks = { ...React,
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, next => { if (!mounted) return; const value = typeof next === 'function' ? next(slots[i].value) : next; if (!Object.is(value, slots[i].value)) { slots[i].value = value; dirty = true; } }]; },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) { const previous = slots[i]; slots[i] = { deps }; effects.push(() => { previous?.cleanup?.(); slots[i].cleanup = fn(); }); } },
    useMemo(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { deps, value: fn() }; return slots[i].value; },
    useCallback(fn, deps) { return hooks.useMemo(() => fn, deps); },
  };
  hooks.useLayoutEffect = hooks.useEffect;
  const Component = loader({ react: hooks, ...overrides }, globals)(file).default;
  function render(nextProps = props) {
    props = nextProps;
    for (let pass = 0; pass < 30; pass++) {
      dirty = false; cursor = 0; effects = []; tree = Component(props);
      for (const effect of effects) effect();
      if (!dirty) return tree;
    }
    throw new Error('Component did not settle after 30 synthetic render passes.');
  }
  render();
  return { render, get tree() { return tree; }, get dirty() { return dirty; }, unmount() { mounted = false; for (const slot of slots) slot?.cleanup?.(); } };
}
function elements(node, predicate, result = []) {
  if (Array.isArray(node)) { for (const child of node) elements(child, predicate, result); return result; }
  if (!node || typeof node !== 'object') return result;
  if (predicate(node)) result.push(node);
  elements(node.props?.children, predicate, result); return result;
}
const textOf = node => Array.isArray(node) ? node.map(textOf).join('') : node === null || node === undefined || node === false ? '' : typeof node === 'object' ? textOf(node.props?.children) : String(node);
const button = (tree, label) => elements(tree, node => node.type === 'button' && (typeof label === 'string' ? textOf(node) === label : label.test(textOf(node))))[0];
const control = (tree, label) => { const field = elements(tree, node => node.type === 'label' && textOf(node.props.children?.[0]) === label)[0]; assert(field, `Missing label: ${label}`); const input = elements(field, node => ['input', 'select', 'textarea'].includes(node.type))[0]; assert(input, `Missing control: ${label}`); return input; };
const child = (tree, name) => elements(tree, node => typeof node.type === 'function' && node.type.name === name)[0];
const rowsIn = tree => elements(tree, node => node.props?.row?.id && node.props.onToggle);
const click = (instance, label) => { const action = button(instance.tree, label); assert(action, `Missing button: ${label}`); assert(!action.props.disabled, `Button disabled: ${label}`); action.props.onClick(); instance.render(); return action; };
const change = (instance, label, value) => { control(instance.tree, label).props.onChange({ target: { value } }); instance.render(); };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const settle = async instance => { for (let n = 0; n < 16; n++) await Promise.resolve(); return instance?.render(); };
const response = value => ({ ok: true, status: 200, json: async () => clone(value) });
const row = (extra = {}) => ({ id: 'provider:adminPipelineParsedCandidates:synthetic', entityType: 'provider', displayName: 'Synthetic Provider', providerName: 'Synthetic Provider', businessName: '', platformLabel: '', market: 'Unknown', vertical: 'Unknown', city: '', state: '', postalCode: '', area: '', services: [], reviewStatus: 'pending', reviewKey: 'intake-1::candidate-1', sourceIdentifiers: { intakeId: 'intake-1', candidateId: 'candidate-1' }, reviewLanes: [{ lane: 'DORA', queueItemId: 'queue:exact-1', status: 'queued', actionable: true }], sourceRefs: [], linkedEntities: [], reviewDecisions: [], conflicts: [], evidence: [], legacyIds: [], updatedAt: '' , ...extra });
const detailFile = 'src/components/catalog/CatalogDetail.tsx';
const actionFile = 'src/components/admin/pipeline/ValidateDetailActions.tsx';
const actionsFile = 'src/components/catalog/CatalogReviewActions.tsx';
const props = (extra = {}) => ({ queueItemId: 'queue:exact-1', displayName: 'Synthetic Provider (DORA)', resolveEndpoint: '/api/source-intake/dora-queue/queue%3Aexact-1/resolve', allowMerge: false, ...extra });

test('server capability, not the route prop, unlocks all detail actions', async () => {
  for (const routeAdmin of [false, true]) {
    const gate = deferred();
    const instance = harness(detailFile, { record: row(), onClose() {}, admin: routeAdmin }, { fetch: () => gate.promise });
    assert.equal(child(instance.tree, 'CatalogReviewActions').props.canReview, false);
    assert.equal(child(instance.tree, 'DoraEvidence').props.admin, false);
    assert(!child(instance.tree, 'ProfileRefinementControls'));
    gate.resolve(response({ ok: true, record: row(), viewer: { canReview: true } })); await settle(instance);
    assert.equal(child(instance.tree, 'CatalogReviewActions').props.canReview, true);
    assert.equal(child(instance.tree, 'CatalogReviewActions').props.disabled, false);
    assert.equal(child(instance.tree, 'DoraEvidence').props.admin, true);
    assert.equal(child(instance.tree, 'ProfileRefinementControls').props.buttonLabel, 'Refine');
    instance.unmount();
  }
});
test('new record navigation fails closed and rejects late evidence from the previous record', async () => {
  const gates = [deferred(), deferred()]; let calls = 0;
  const first = row(), newer = row({ id: 'provider:adminPipelineParsedCandidates:newer', displayName: 'Newer Synthetic', providerName: 'Newer Synthetic' });
  const instance = harness(detailFile, { record: first, onClose() {}, admin: true }, { fetch: () => gates[calls++].promise });
  instance.render({ record: newer, onClose() {}, admin: true });
  assert.equal(child(instance.tree, 'DoraEvidence').props.admin, false);
  gates[0].resolve(response({ ok: true, record: first, viewer: { canReview: true } })); await settle(instance);
  assert.match(textOf(instance.tree), /Newer Synthetic/); assert.equal(child(instance.tree, 'DoraEvidence').props.admin, false);
  gates[1].resolve(response({ ok: true, record: newer, viewer: { canReview: false } })); await settle(instance);
  assert.equal(child(instance.tree, 'CatalogReviewActions').props.canReview, false); instance.unmount();
});
test('detail API reports current admin permission and keeps response private', async () => {
  let user = { role: 'member' };
  const api = loader({
    '@/lib/auth/access': { getSessionUserFromCookieHeader: async () => user, canAccessMemberArea: value => ['member', 'admin'].includes(value?.role), canAccessAdmin: value => value?.role === 'admin' },
    '@/lib/catalog/store': { loadSharedCatalog: async () => ({ rows: [row()], coverage: {}, generatedAt: '2026-10-14T17:00:00Z' }) },
  })('src/app/api/catalog/route.ts');
  for (const role of ['member', 'admin']) {
    user = { role };
    const result = await api.GET(new Request(`https://synthetic.invalid/api/catalog?id=${encodeURIComponent(row().id)}`));
    assert.equal(result.status, 200); assert.equal(result.headers.get('Cache-Control'), 'private, no-store'); assert.equal(result.headers.get('Vary'), 'Cookie');
    const data = await result.json(); assert.equal(data.viewer.canReview, role === 'admin'); assert.equal(data.record.id, row().id);
  }
});
test('member, absent capability and failed detail responses keep controls closed', async () => {
  for (const result of [response({ ok: true, record: row(), viewer: { canReview: false } }), response({ ok: true, record: row() }), { ok: false, status: 403, json: async () => ({ error: 'forbidden' }) }]) {
    const instance = harness(detailFile, { record: row(), onClose() {}, admin: true }, { fetch: async () => result });
    await settle(instance);
    assert.equal(child(instance.tree, 'CatalogReviewActions').props.canReview, false);
    assert.equal(child(instance.tree, 'DoraEvidence').props.admin, false);
    assert(!child(instance.tree, 'ProfileRefinementControls'));
    instance.unmount();
  }
});
test('failed refresh keeps successful review mounted, disabled and in the same drawer', async () => {
  let calls = 0, refreshed = 0, closes = 0;
  const instance = harness(detailFile, { record: row(), onClose: () => closes++, onRefreshed: () => refreshed++ }, { fetch: async () => ++calls === 1 ? response({ ok: true, record: row(), viewer: { canReview: true } }) : { ok: false, status: 503, json: async () => ({ error: 'catalog_store_unavailable' }) } });
  await settle(instance); child(instance.tree, 'CatalogReviewActions').props.onComplete(); instance.render();
  assert.equal(child(instance.tree, 'CatalogReviewActions').props.canReview, true);
  assert.equal(child(instance.tree, 'CatalogReviewActions').props.disabled, true);
  await settle(instance);
  assert.equal(refreshed, 1); assert.equal(closes, 0);
  assert.equal(child(instance.tree, 'CatalogReviewActions').props.disabled, true);
  assert.match(textOf(instance.tree), /Latest details could not be loaded/);
  instance.unmount();
});
test('review metadata must identify an explicit eligible lane and exact queue ID', () => {
  const { actionableReviewLane, catalogReviewHref, hasSafeReviewIdentity, default: Component } = loader()(actionsFile);
  const lane = row().reviewLanes[0];
  assert.equal(actionableReviewLane(lane), true);
  for (const extra of [{ actionable: undefined }, { actionable: false }, { status: 'approved' }, { status: 'failed' }, { status: 'dismissed' }, { status: 'future_unknown_status' }, { queueItemId: 'wrong%2Ftarget' }, { queueItemId: 'wrong/target' }, { queueItemId: ' spaced ' }, { lane: 'OTHER' }]) assert.equal(actionableReviewLane({ ...lane, ...extra }), false);
  assert.equal(hasSafeReviewIdentity(row()), true);
  assert.equal(hasSafeReviewIdentity(row({ reviewKey: 'wrong::candidate-1' })), false);
  assert.equal(hasSafeReviewIdentity(row({ conflicts: ['duplicate_candidate_source_key'] })), false);
  assert(catalogReviewHref(row()).startsWith('/admin/validate/intake-1%3A%3Acandidate-1?'));
  assert(!catalogReviewHref(row({ reviewKey: undefined })).includes('/validate/'));
  const html = renderToStaticMarkup(React.createElement(Component, { record: row(), canReview: true, onComplete() {} }));
  assert.match(html, /Approve/); assert.match(html, /Reject/); assert(!html.includes('Merge Target ID')); assert(!html.includes('Dismiss'));
  assert.match(html, /target="_blank"/);
  assert.equal(renderToStaticMarkup(React.createElement(Component, { record: row(), canReview: false, onComplete() {} })), '');
  const tree = harness(actionsFile, { record: row(), canReview: true, onComplete() {} }).tree;
  assert.equal(child(tree, 'ValidateDetailActions').props.resolveEndpoint, props().resolveEndpoint);
});
test('inline approval submits existing payload once and refreshes without navigation', async () => {
  const gate = deferred(), calls = []; let refreshed = 0, pushed = 0;
  const instance = harness(actionFile, props({ onComplete: () => refreshed++ }), { fetch: (url, init) => { calls.push({ url, init }); return url.endsWith('/log') ? Promise.resolve(response({ ok: true })) : gate.promise; } }, { 'next/navigation': { useRouter: () => ({ push: () => pushed++ }) } });
  const action = button(instance.tree, 'Approve'); action.props.onClick(); action.props.onClick(); instance.render();
  assert.equal(calls.length, 1); assert.equal(calls[0].url, props().resolveEndpoint);
  assert.equal(calls[0].init.credentials, 'same-origin'); assert.deepEqual(JSON.parse(calls[0].init.body), { action: 'approved' });
  gate.resolve(response({ ok: true })); await settle(instance);
  assert.equal(refreshed, 1); assert.equal(pushed, 0); assert.equal(button(instance.tree, 'Approve').props.disabled, true);
  assert.match(textOf(instance.tree), /approved and removed from pending review/); instance.unmount();
});
test('reject requires confirmation and Cancel never submits', async () => {
  const calls = []; const instance = harness(actionFile, props({ onComplete() {} }), { fetch: async (url, init) => { calls.push({ url, init }); return response({ ok: true }); } });
  click(instance, 'Reject'); assert.equal(calls.length, 0); assert(button(instance.tree, 'Confirm rejection'));
  click(instance, 'Cancel'); assert.equal(calls.length, 0); assert(!button(instance.tree, 'Confirm rejection'));
  click(instance, 'Reject'); click(instance, 'Confirm rejection'); await settle(instance);
  assert.deepEqual(JSON.parse(calls[0].init.body), { action: 'rejected' }); instance.unmount();
});
test('merge requires a user-entered target and confirmation; never borrows a suggestion', async () => {
  const calls = []; const instance = harness(actionFile, props({ allowMerge: true, onComplete() {} }), { fetch: async (url, init) => { calls.push({ url, init }); return response({ ok: true }); } });
  click(instance, 'Merge'); assert.equal(calls.length, 0); assert.match(textOf(instance.tree), /exact target ID/);
  change(instance, 'Merge Target ID', 'explicit-target'); click(instance, 'Merge');
  assert.equal(calls.length, 0); assert.match(textOf(instance.tree), /target explicit-target/);
  click(instance, 'Confirm merge'); await settle(instance);
  assert.deepEqual(JSON.parse(calls[0].init.body), { action: 'merged', mergeTargetId: 'explicit-target' }); instance.unmount();
});
test('failed review stays visible without navigation or success refresh', async () => {
  let pushed = 0, refreshed = 0;
  const instance = harness(actionFile, props({ onComplete: () => refreshed++ }), { fetch: async url => url.endsWith('/log') ? response({ ok: true }) : { ok: false, status: 403, json: async () => ({ error: 'forbidden' }) } }, { 'next/navigation': { useRouter: () => ({ push: () => pushed++ }) } });
  click(instance, 'Approve'); await settle(instance);
  assert.equal(pushed, 0); assert.equal(refreshed, 0); assert.match(textOf(instance.tree), /Review was not confirmed: forbidden/);
  assert.equal(button(instance.tree, 'Approve').props.disabled, false); instance.unmount();
});
test('closing while a review is pending prevents late navigation and callback', async () => {
  const gate = deferred(); let refreshed = 0, pushed = 0;
  const instance = harness(actionFile, props({ onComplete: () => refreshed++ }), { fetch: url => url.endsWith('/log') ? Promise.resolve(response({ ok: true })) : gate.promise }, { 'next/navigation': { useRouter: () => ({ push: () => pushed++ }) } });
  click(instance, 'Approve'); instance.unmount(); gate.resolve(response({ ok: true })); await settle();
  assert.equal(refreshed, 0); assert.equal(pushed, 0);
});
(async () => { for (const { name, run } of tests) { await run(); console.log(`PASS ${name}`); } console.log(`${tests.length} isolated catalog review regressions passed.`); })().catch(error => { console.error(error); process.exitCode = 1; });
