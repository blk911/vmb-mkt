/** Hermetic unified-workspace regressions. Synthetic fixtures only; no network or production writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const compiled = new Map();
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
    if (!compiled.has(file)) compiled.set(file, ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText);
    const source = compiled.get(file);
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
const storage = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key), clear: () => values.clear(), values }; };
function browser(href = 'https://synthetic.invalid/dashboard/data?external=keep#retained', sharedStorage = storage()) {
  let url = new URL(href), index = 0;
  const listeners = new Map(), entries = [{ href: url.href, state: { __NA: true, tree: ['synthetic-next-router-state'] } }], calls = [];
  const location = {};
  for (const key of ['href', 'pathname', 'search', 'hash', 'origin']) Object.defineProperty(location, key, { get: () => url[key] });
  const dispatch = event => { for (const fn of listeners.get(event.type) || []) fn(event); };
  const history = {
    get state() { return entries[index].state; }, get length() { return entries.length; },
    replaceState(state, title, next) { url = new URL(String(next), url); entries[index] = { href: url.href, state: clone(state) }; calls.push({ type: 'replace', state, href: url.href }); },
    pushState(state, title, next) { url = new URL(String(next), url); entries.splice(index + 1); entries.push({ href: url.href, state: clone(state) }); index++; calls.push({ type: 'push', state, href: url.href }); },
    back() { if (index > 0) { index--; url = new URL(entries[index].href); dispatch({ type: 'popstate', state: this.state }); } },
    forward() { if (index < entries.length - 1) { index++; url = new URL(entries[index].href); dispatch({ type: 'popstate', state: this.state }); } },
  };
  const window = { location, history, sessionStorage: sharedStorage, localStorage: sharedStorage, setTimeout, clearTimeout,
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); }, dispatchEvent: dispatch,
  };
  return { window, location, history, sessionStorage: sharedStorage, localStorage: sharedStorage, calls, entries, navigate(next) { url = new URL(next, url); } };
}
const row = (id = 'alpha', extra = {}) => ({ id: `provider:adminPipelineParsedCandidates:synthetic-${id}`, entityType: 'provider', displayName: `${id} Synthetic`, providerName: `${id} Synthetic`, businessName: '', platformLabel: '', market: 'Unknown', vertical: 'Unknown', verticals: [], city: '', state: '', postalCode: '', area: '', services: [], reviewStatus: 'pending', sourceRefs: [], linkedEntities: [], reviewDecisions: [], conflicts: [], evidence: [], legacyIds: [], updatedAt: '2026-10-14T17:00:00Z', ...extra });
const fixedList = (extra = {}) => ({ id: 'synthetic-fixed', name: 'Synthetic fixed list', membershipMode: 'fixed', catalogIds: [row().id], techIds: [row().id], workflow: {}, ...extra });
const dynamicList = (extra = {}) => fixedList({ id: 'synthetic-search', name: 'Synthetic live search', membershipMode: 'dynamic', filters: { city: 'Synthetic City' }, ...extra });
function apiFixture({ rows = [row()], lists = [], viewer = { canReview: false }, holdPosts = false } = {}) {
  const calls = [], pending = [];
  let currentRows = clone(rows), currentLists = clone(lists);
  const fetch = (url, init = {}) => {
    const method = init.method || 'GET', call = { url: String(url), init, method }; calls.push(call);
    assert(call.url.startsWith('/api/'), 'Only same-origin mocked API paths are allowed.');
    if (method === 'GET' && call.url.startsWith('/api/catalog')) return Promise.resolve(response({ ok: true, rows: currentRows, record: currentRows.find(r => new URL(call.url, 'https://synthetic.invalid').searchParams.get('id') === r.id), viewer, generatedAt: '2026-10-14T17:00:00Z' }));
    if (method === 'GET' && call.url === '/api/targets/lists') return Promise.resolve(response({ ok: true, lists: currentLists }));
    assert.equal(call.url, '/api/targets/lists'); assert.equal(method, 'POST');
    const body = JSON.parse(init.body); call.body = body;
    const complete = () => {
      let list;
      if (body.op === 'create') {
        list = fixedList({ id: `synthetic-created-${currentLists.length}`, name: body.name, membershipMode: body.membershipMode || 'fixed', filters: body.filters, catalogIds: body.catalogIds || [], techIds: body.catalogIds || [] });
        currentLists = [list, ...currentLists];
      } else {
        list = clone(currentLists.find(value => value.id === body.id)); assert(list, 'Synthetic target list must exist.');
        if (body.op === 'addMany') list.catalogIds = [...new Set([...list.catalogIds, ...body.catalogIds])];
        else if (body.op === 'removeMany') list.catalogIds = list.catalogIds.filter(id => !body.catalogIds.includes(id));
        else if (body.op === 'setFilters') list.filters = body.filters;
        else throw new Error(`Unexpected list operation: ${body.op}`);
        list.techIds = [...list.catalogIds]; currentLists = currentLists.map(value => value.id === list.id ? list : value);
      }
      return response({ ok: true, list });
    };
    if (!holdPosts) return Promise.resolve(complete());
    const gate = deferred(); pending.push({ gate, complete }); return gate.promise;
  };
  return { fetch, calls, pending, get posts() { return calls.filter(call => call.method === 'POST'); }, get lists() { return clone(currentLists); }, replaceRows(value) { currentRows = clone(value); }, resolvePost(index = 0) { pending[index].gate.resolve(pending[index].complete()); } };
}
const workspaceFile = 'src/components/catalog/CatalogWorkspace.tsx';
async function workspace({ props = {}, href, ...fixture } = {}) {
  const client = browser(href), api = apiFixture(fixture), instance = harness(workspaceFile, props, { ...client, fetch: api.fetch });
  await settle(instance); return { instance, client, api };
}

test('catalog capability is server-authoritative for member, admin, external and signed-out viewers', async () => {
  let user = null, reads = 0;
  const api = loader({
    '@/lib/auth/access': { getSessionUserFromCookieHeader: async () => user, canAccessMemberArea: value => ['member', 'admin'].includes(value?.role), canAccessAdmin: value => value?.role === 'admin' },
    '@/lib/catalog/store': { loadSharedCatalog: async () => { reads++; return { rows: [row()], coverage: {}, generatedAt: '2026-10-14T17:00:00Z' }; } },
  })('src/app/api/catalog/route.ts');
  for (const [role, status, canReview] of [[null, 401], ['external', 403], ['member', 200, false], ['admin', 200, true]]) {
    user = role ? { username: `synthetic-${role}`, role } : null;
    const before = reads, result = await api.GET(new Request('https://synthetic.invalid/api/catalog'));
    assert.equal(result.status, status);
    if (status === 200) assert.equal((await result.json()).viewer.canReview, canReview);
    else assert.equal(reads, before, 'Unauthorized requests must fail before catalog access.');
  }
});

test('DORA write endpoint rejects members and signed-out callers before any check', async () => {
  let user = null, writes = 0;
  const api = loader({
    '@/lib/auth/access': { getSessionUserFromCookieHeader: async () => user, canAccessAdmin: value => value?.role === 'admin' },
    '@/lib/dora/runner': { refreshCatalogDora: async () => { writes++; return []; } },
  })('src/app/api/catalog/dora/refresh/route.ts');
  for (const [role, status] of [[null, 401], ['member', 403], ['external', 403]]) {
    user = role ? { role, username: `synthetic-${role}` } : null;
    const result = await api.POST(new Request('https://synthetic.invalid/api/catalog/dora/refresh', { method: 'POST', headers: { origin: 'https://synthetic.invalid', 'content-type': 'application/json' }, body: JSON.stringify({ catalogIds: [row().id] }) }));
    assert.equal(result.status, status);
  }
  assert.equal(writes, 0);
});

const profile = (platform = 'booksy') => ({ status: 'not_checked', platform, knownPlatforms: [platform], platformSummary: 'single', bookingLinks: [], socialLinks: [], websiteLinks: [], reasons: [], observations: [], fieldEvidence: [] });
const selectValues = input => elements(input, node => node.type === 'option').map(node => node.props.value ?? textOf(node));
const selectRow = (instance, index = 0) => { rowsIn(instance.tree)[index].props.onToggle(); instance.render(); };
const submit = (instance, label) => { const form = elements(instance.tree, node => node.type === 'form' && textOf(node).includes(label))[0]; assert(form, `Missing form for ${label}`); form.props.onSubmit({ preventDefault() {} }); return form; };

test('selection actions appear only after selection; saved search remains separate', async () => {
  const { instance, api } = await workspace({ lists: [fixedList(), dynamicList()] });
  assert(!button(instance.tree, 'Add to list')); assert(!button(instance.tree, 'Create fixed list'));
  assert(button(instance.tree, 'Save this search'));
  selectRow(instance);
  assert(button(instance.tree, 'Add to list')); assert(button(instance.tree, 'Create fixed list'));
  assert.deepEqual(selectValues(control(instance.tree, 'Fixed list')), ['', 'synthetic-fixed']);
  click(instance, 'Save this search');
  assert(control(instance.tree, 'Live-filter list name'));
  assert(!elements(instance.tree, n => n.type === 'label' && textOf(n).startsWith('Fixed list name')).length);
  click(instance, 'Clear selection');
  assert(!button(instance.tree, 'Add to list')); assert(!button(instance.tree, 'Create fixed list'));
  assert.equal(api.posts.length, 0); instance.unmount();
});

test('Market, Vertical, Platform lead filters, cascade correctly and retain unknown mappings', async () => {
  const records = [row('alpha', { market: 'Synthetic North', vertical: 'Nail', verticals: ['Nail'], platformLabel: 'Booksy', profile: profile('booksy') }), row('bravo', { market: 'Synthetic North', vertical: 'Hair', verticals: ['Hair'], platformLabel: 'GlossGenius', profile: profile('glossgenius') }), row('charlie', { market: 'Synthetic South', vertical: 'Skin', verticals: ['Skin'] }), row('unknown')];
  const { instance } = await workspace({ rows: records });
  const section = elements(instance.tree, n => n.props?.['aria-label'] === 'Catalog filters')[0];
  const labels = elements(section, n => n.type === 'label').map(n => textOf(n.props.children?.[0]));
  assert.deepEqual(labels.slice(0, 3), ['Market', 'Vertical', 'Platform']);
  assert(selectValues(control(instance.tree, 'Market')).includes('Unknown'));
  assert(selectValues(control(instance.tree, 'Vertical')).includes('Unknown'));
  assert(selectValues(control(instance.tree, 'Platform')).includes('Unknown'));
  change(instance, 'Platform', 'Unknown');
  assert.deepEqual(rowsIn(instance.tree).map(n => n.props.row.id).sort(), [records[2].id, records[3].id].sort());
  change(instance, 'Market', 'Synthetic North'); change(instance, 'Vertical', 'Nail'); change(instance, 'Platform', 'Booksy');
  assert.deepEqual(rowsIn(instance.tree).map(n => n.props.row.id), [records[0].id]);
  change(instance, 'Market', 'Synthetic South');
  assert.equal(control(instance.tree, 'Vertical').props.value, ''); assert.equal(control(instance.tree, 'Platform').props.value, '');
  assert(!selectValues(control(instance.tree, 'Vertical')).includes('Nail'));
  change(instance, 'Market', 'Unknown');
  assert.deepEqual(rowsIn(instance.tree).map(n => n.props.row.id), [records[3].id]);
  instance.unmount();
});

test('All prospects and Needs review share one deduplicated table and preserve final decisions', async () => {
  const records = [row('pending'), row('approved', { reviewStatus: 'approved' }), row('rejected', { reviewStatus: 'rejected', conflicts: ['Historical synthetic conflict'] }), row('unresolved', { reviewStatus: 'approved', reviewLanes: [{ lane: 'social', queueItemId: 'synthetic-lane', status: 'pending' }] })];
  const { instance, api } = await workspace({ rows: records });
  assert.equal(rowsIn(instance.tree).length, 4);
  click(instance, /^Needs review/);
  assert.deepEqual(rowsIn(instance.tree).map(n => n.props.row.id).sort(), [records[0].id, records[3].id].sort());
  click(instance, 'All prospects'); assert.equal(rowsIn(instance.tree).length, 4);
  assert.equal(api.posts.length, 0); instance.unmount();
});

test('filters, sort, pagination and selection survive drawer open-close and data refresh', async () => {
  const records = Array.from({ length: 65 }, (_, i) => row(String(i).padStart(3, '0'), { market: 'Synthetic North', vertical: 'Nail', verticals: ['Nail'] }));
  const { instance, client, api } = await workspace({ rows: records });
  change(instance, 'Market', 'Synthetic North'); click(instance, /^Provider /); click(instance, /^Provider /); click(instance, 'Next');
  selectRow(instance); const selectedId = rowsIn(instance.tree)[0].props.row.id, href = client.location.href;
  rowsIn(instance.tree)[0].props.onOpen(); instance.render();
  const drawer = child(instance.tree, 'CatalogDetail'); assert(drawer); assert.equal(drawer.props.record.id, selectedId);
  drawer.props.onClose(); instance.render(); assert(!child(instance.tree, 'CatalogDetail'));
  assert.equal(client.location.href, href); assert.match(textOf(instance.tree), /Page 2 of 3/);
  assert(rowsIn(instance.tree).find(n => n.props.row.id === selectedId).props.selected);
  click(instance, 'Refresh view'); await settle(instance);
  assert.equal(client.location.href, href); assert.match(textOf(instance.tree), /Page 2 of 3/);
  assert(rowsIn(instance.tree).find(n => n.props.row.id === selectedId).props.selected);
  assert.equal(control(instance.tree, 'Market').props.value, 'Synthetic North');
  assert.equal(client.history.state.__NA, true); assert.deepEqual(client.history.state.tree, ['synthetic-next-router-state']);
  const url = new URL(client.location.href); assert.equal(url.searchParams.get('external'), 'keep'); assert.equal(url.hash, '#retained');
  assert.equal(api.posts.length, 0); instance.unmount();
});

test('saved-search submissions are bounded, keep live filters and never include selected IDs', async () => {
  const { instance, api, client } = await workspace({ holdPosts: true });
  selectRow(instance); change(instance, 'Search prospects', 'Synthetic'); click(instance, 'Save this search'); change(instance, 'Live-filter list name', 'Synthetic saved search');
  const form = submit(instance, 'Save live-filter list'); form.props.onSubmit({ preventDefault() {} });
  assert.equal(api.posts.length, 1); assert.equal(api.posts[0].body.membershipMode, 'dynamic'); assert.equal(api.posts[0].body.filters.q, 'Synthetic'); assert(!Object.hasOwn(api.posts[0].body, 'catalogIds'));
  instance.render(); assert(button(instance.tree, 'Saving…').props.disabled);
  api.resolvePost(); await settle(instance);
  assert.equal(api.lists.length, 1); assert.equal(new URL(client.location.href).pathname, '/dashboard/lists');
  assert.equal(client.history.state.__NA, true);
  change(instance, 'Search prospects', 'Changed Synthetic'); assert.equal(api.posts.length, 1);
  assert.equal(api.lists[0].filters.q, 'Synthetic', 'Preview changes must not silently edit saved filters.');
  const saveChanges = button(instance.tree, 'Save live filter changes'); saveChanges.props.onClick(); saveChanges.props.onClick();
  assert.equal(api.posts.length, 2); assert.equal(api.posts[1].body.op, 'setFilters');
  api.resolvePost(1); await settle(instance); assert.equal(api.lists[0].filters.q, 'Changed Synthetic'); instance.unmount();
});

test('fixed-list repeated creation and additions preserve exact canonical membership', async () => {
  const records = [row('alpha'), row('bravo')];
  const { instance, api } = await workspace({ rows: records, lists: [fixedList()], holdPosts: true });
  selectRow(instance, 1); click(instance, 'Create fixed list'); change(instance, 'Fixed list name', 'Synthetic selected');
  const form = submit(instance, 'Save fixed list'); form.props.onSubmit({ preventDefault() {} });
  assert.equal(api.posts.length, 1); assert.equal(api.posts[0].body.membershipMode, 'fixed'); assert.deepEqual(api.posts[0].body.catalogIds, [records[1].id]); assert(!Object.hasOwn(api.posts[0].body, 'filters'));
  api.resolvePost(); await settle(instance); assert.equal(api.lists.length, 2);
  assert.deepEqual(api.lists.find(l => l.id === 'synthetic-fixed').catalogIds, [records[0].id]);
  selectRow(instance); change(instance, 'Fixed list', 'synthetic-fixed');
  const action = button(instance.tree, 'Add to list'); action.props.onClick(); action.props.onClick(); assert.equal(api.posts.length, 2);
  api.resolvePost(1); await settle(instance); assert.deepEqual(api.lists.find(l => l.id === 'synthetic-fixed').catalogIds, [records[0].id, records[1].id]);
  assert(!button(instance.tree, 'Add to list')); instance.unmount();
});

test('fixed list filters and refresh never expand, rebind or write membership', async () => {
  const first = row('alpha', { city: 'Synthetic City' }), other = row('bravo', { city: 'Synthetic City' });
  const missing = 'provider:adminPipelineParsedCandidates:synthetic-missing';
  const list = fixedList({ catalogIds: [first.id, missing], techIds: [first.id, missing] });
  const { instance, api } = await workspace({ props: { initialView: 'lists', initialListId: list.id }, href: `https://synthetic.invalid/dashboard/lists?listId=${list.id}`, rows: [first, other], lists: [list] });
  assert.deepEqual(rowsIn(instance.tree).map(n => n.props.row.id), [first.id]); assert.match(textOf(instance.tree), /Membership is preserved/);
  change(instance, 'City', 'Synthetic City'); click(instance, 'Refresh view'); await settle(instance);
  assert.deepEqual(rowsIn(instance.tree).map(n => n.props.row.id), [first.id]); assert.deepEqual(api.lists[0].catalogIds, [first.id, missing]);
  assert.equal(api.posts.length, 0); instance.unmount();
});

test('list refresh restores explicit URL filters instead of silently replacing them', async () => {
  const list = dynamicList({ filters: { city: 'Saved Synthetic City' } });
  const { instance } = await workspace({ props: { initialView: 'lists', initialListId: list.id }, href: `https://synthetic.invalid/dashboard/lists?listId=${list.id}&city=Preview%20Synthetic%20City&sort=provider&direction=desc`, lists: [list] });
  assert.equal(control(instance.tree, 'City').props.value, 'Preview Synthetic City');
  assert.match(textOf(instance.tree), /Unsaved filter preview/); instance.unmount();
});

test('cleared dynamic-filter preview survives full browser remount without changing saved membership', async () => {
  const list = dynamicList({ filters: { city: 'Saved Synthetic City' } });
  const props = { initialView: 'lists', initialListId: list.id };
  const first = await workspace({ props, href: `https://synthetic.invalid/dashboard/lists?listId=${list.id}`, lists: [list] });
  assert.equal(control(first.instance.tree, 'City').props.value, 'Saved Synthetic City');
  click(first.instance, 'Clear filters'); const href = first.client.location.href;
  assert.equal(new URL(href).searchParams.get('preview'), '1'); assert.equal(first.api.posts.length, 0); first.instance.unmount();
  const restored = await workspace({ props, href, lists: [list] });
  assert.equal(control(restored.instance.tree, 'City').props.value, '');
  assert.match(textOf(restored.instance.tree), /Unsaved filter preview/); assert.deepEqual(restored.api.lists[0].filters, { city: 'Saved Synthetic City' }); restored.instance.unmount();
});

test('popstate between dynamic lists applies each list saved filters when no preview is present', async () => {
  const firstList = dynamicList({ id: 'synthetic-first-search', filters: { city: 'First Synthetic City' } });
  const secondList = dynamicList({ id: 'synthetic-second-search', filters: { city: 'Second Synthetic City' } });
  const props = { initialView: 'lists', initialListId: firstList.id };
  const { instance, client } = await workspace({ props, href: `https://synthetic.invalid/dashboard/lists?listId=${firstList.id}`, lists: [firstList, secondList] });
  client.history.pushState(client.history.state, '', `/dashboard/lists?listId=${secondList.id}`); client.window.dispatchEvent({ type: 'popstate' }); instance.render();
  assert.equal(control(instance.tree, 'City').props.value, 'Second Synthetic City');
  client.history.back(); instance.render(); assert.equal(control(instance.tree, 'City').props.value, 'First Synthetic City'); instance.unmount();
});

test('popstate restores URL state, including default sort when omitted', async () => {
  const { instance, client } = await workspace();
  client.history.pushState(client.history.state, '', '/dashboard/targets?q=Synthetic&sort=provider&direction=desc');
  client.window.dispatchEvent({ type: 'popstate' }); instance.render();
  assert.equal(control(instance.tree, 'Search prospects').props.value, 'Synthetic'); assert(button(instance.tree, 'Provider ↓'));
  client.history.pushState(client.history.state, '', '/dashboard/targets'); client.window.dispatchEvent({ type: 'popstate' }); instance.render();
  assert.equal(control(instance.tree, 'Search prospects').props.value, ''); assert(button(instance.tree, 'Platform ↑'));
  instance.unmount();
});

test('unknown or malformed URL filter enums cannot crash the workspace', async () => {
  const { instance } = await workspace({ href: 'https://synthetic.invalid/dashboard/targets?needsReview=broken&hasBooking=invalid&direction=sideways&page=-9' });
  assert(button(instance.tree, 'Save this search')); assert.match(textOf(instance.tree), /Page 1 of 1/); instance.unmount();
});

test('drawer action capability comes from API result and fails closed when absent', async () => {
  for (const [viewer, permitted] of [[undefined, false], [{ canReview: false }, false], [{ canReview: true }, true]]) {
    const { instance } = await workspace({ props: { admin: true }, viewer: viewer || {} });
    rowsIn(instance.tree)[0].props.onOpen(); instance.render();
    assert.equal(child(instance.tree, 'CatalogDetail').props.admin, permitted); instance.unmount();
  }
});

const detailFile = 'src/components/catalog/CatalogDetail.tsx';
const safeReviewRow = (id = 'alpha') => row(id, { reviewKey: `synthetic-intake::synthetic-${id}`, sourceIdentifiers: { intakeId: 'synthetic-intake', candidateId: `synthetic-${id}` }, reviewLanes: [{ lane: 'DORA', queueItemId: `synthetic-${id}-queue`, status: 'queued', actionable: true }], profile: profile('booksy') });

test('drawer actions require fresh authenticated detail capability, ignoring route hints', async () => {
  for (const viewer of [undefined, { canReview: false }, { canReview: true }]) {
    const record = safeReviewRow(), gate = deferred();
    const instance = harness(detailFile, { record, admin: true, onClose() {} }, { fetch: () => gate.promise });
    assert.equal(child(instance.tree, 'DoraEvidence').props.admin, false);
    assert(!child(instance.tree, 'ProfileRefinementControls'));
    assert.equal(child(instance.tree, 'CatalogReviewActions').props.canReview, false);
    gate.resolve(response({ record, viewer })); await settle(instance);
    const expected = viewer?.canReview === true;
    assert.equal(child(instance.tree, 'DoraEvidence').props.admin, expected);
    assert.equal(Boolean(child(instance.tree, 'ProfileRefinementControls')), expected);
    assert.equal(child(instance.tree, 'CatalogReviewActions').props.canReview, expected);
    instance.unmount();
  }
});

test('drawer refresh and failed or mismatched reads revoke mutation capability while retaining evidence', async () => {
  const record = safeReviewRow(), gates = [deferred(), deferred(), deferred()]; let reads = 0, notified = 0;
  const instance = harness(detailFile, { record, onClose() {}, onRefreshed() { notified++; } }, { fetch: () => gates[reads++].promise });
  gates[0].resolve(response({ record, viewer: { canReview: true } })); await settle(instance);
  assert.equal(child(instance.tree, 'DoraEvidence').props.admin, true);
  child(instance.tree, 'DoraEvidence').props.onUpdated(); instance.render();
  assert.equal(notified, 1); assert.equal(child(instance.tree, 'DoraEvidence').props.admin, false);
  assert.equal(child(instance.tree, 'CatalogReviewActions').props.disabled, true);
  gates[1].resolve({ ok: false, status: 503, json: async () => ({ error: 'synthetic_unavailable' }) }); await settle(instance);
  assert.match(textOf(instance.tree), /Latest details could not be loaded/); assert.match(textOf(instance.tree), /alpha Synthetic/);
  assert.equal(child(instance.tree, 'DoraEvidence').props.admin, false);
  click(instance, 'Retry'); gates[2].resolve(response({ record: safeReviewRow('wrong'), viewer: { canReview: true } })); await settle(instance);
  assert.match(textOf(instance.tree), /did not match this request/); assert(!textOf(instance.tree).includes('wrong Synthetic'));
  assert.equal(child(instance.tree, 'DoraEvidence').props.admin, false); instance.unmount();
});

test('switching drawer identity aborts stale reads and never leaks prior admin capability', async () => {
  const gates = [deferred(), deferred()], calls = [];
  const first = safeReviewRow('alpha'), second = safeReviewRow('bravo');
  const props = { record: first, admin: true, onClose() {} };
  const instance = harness(detailFile, props, { fetch: (_, init) => { calls.push(init); return gates[calls.length - 1].promise; } });
  instance.render({ ...props, record: second }); assert.equal(calls[0].signal.aborted, true);
  gates[0].resolve(response({ record: first, viewer: { canReview: true } })); await settle(instance);
  assert.equal(child(instance.tree, 'DoraEvidence').props.admin, false); assert(!textOf(instance.tree).includes('alpha Synthetic'));
  gates[1].resolve(response({ record: second, viewer: { canReview: false } })); await settle(instance);
  assert.equal(child(instance.tree, 'DoraEvidence').props.admin, false); assert.match(textOf(instance.tree), /bravo Synthetic/); instance.unmount();
});

test('review action helper rejects ambiguous identities, unsafe lanes and terminal mutations', () => {
  const { default: ReviewActions, actionableReviewLane, hasSafeReviewIdentity } = loader()('src/components/catalog/CatalogReviewActions.tsx');
  const record = safeReviewRow(), lane = record.reviewLanes[0];
  assert.equal(hasSafeReviewIdentity(record), true); assert.equal(actionableReviewLane(lane), true);
  for (const status of ['approved', 'rejected', 'merged', 'failed', 'dismissed', 'unexpected']) assert.equal(actionableReviewLane({ ...lane, status }), false);
  for (const queueItemId of ['', '../escape', 'name%2fescape', ' wrapped ', 'control\u0000']) assert.equal(actionableReviewLane({ ...lane, queueItemId }), false);
  assert.equal(hasSafeReviewIdentity({ ...record, sourceIdentifiers: { ...record.sourceIdentifiers, intakeId: 'a::b' } }), false);
  assert.equal(hasSafeReviewIdentity({ ...record, conflicts: ['duplicate_candidate_source_key'] }), false);
  assert.equal(ReviewActions({ record, canReview: false, onComplete() {} }), null);
  const tree = ReviewActions({ record, canReview: true, disabled: true, onComplete() {} });
  const actions = child(tree, 'ValidateDetailActions'); assert(actions); assert.equal(actions.props.allowMerge, false); assert.equal(actions.props.disabled, true);
  assert.equal(actions.props.resolveEndpoint, '/api/source-intake/dora-queue/synthetic-alpha-queue/resolve');
});

async function preview(directory) {
  const target = path.resolve(directory); fs.mkdirSync(target, { recursive: true });
  const real = loader(); const overrides = {};
  for (const name of ['CatalogResultRow', 'CatalogDetail', 'ListEditor']) overrides[`./${name}`] = real(`src/components/catalog/${name}.tsx`);
  const records = [row('Avery', { market: 'Synthetic North', vertical: 'Nail', verticals: ['Nail'], profile: profile('booksy'), platformLabel: 'Booksy', city: 'Synthetic City', services: ['Nails'] }), row('Blair', { market: 'Synthetic North', vertical: 'Hair', verticals: ['Hair'], profile: profile('glossgenius'), platformLabel: 'GlossGenius', reviewStatus: 'approved' }), row('Casey'), row('Synthetic Studio', { entityType: 'business', providerName: '', businessName: 'Synthetic Studio', reviewStatus: 'pending' })];
  const client = browser('https://synthetic.invalid/admin/prospects'), api = apiFixture({ rows: records, lists: [fixedList(), dynamicList()], viewer: { canReview: true } });
  const instance = harness(workspaceFile, { admin: true }, { ...client, fetch: api.fetch }, overrides); await settle(instance);
  const states = [{ name: 'unified-prospects', tree: instance.tree }];
  selectRow(instance); states.push({ name: 'unified-selection', tree: instance.tree });
  click(instance, 'Save this search'); states.push({ name: 'unified-save-search', tree: instance.tree });
  const { compile } = require('@tailwindcss/node');
  for (const state of states) {
    const content = renderToStaticMarkup(state.tree);
    const candidates = [...new Set([...content.matchAll(/class="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/)))];
    const compiler = await compile('@import "tailwindcss";', { base: root, onDependency() {} });
    const css = compiler.build(candidates) + fs.readFileSync(path.join(root, 'src/components/catalog/CatalogWorkspace.module.css'), 'utf8');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\nbody{font-family:Arial,sans-serif;margin:24px;background:#f7f9fc}</style></head><body>${content}</body></html>`;
    fs.writeFileSync(path.join(target, `${state.name}.html`), html);
    console.log(`Synthetic preview written: ${path.join(target, `${state.name}.html`)}`);
  }
  instance.unmount();
}

async function main() {
  let failed = 0;
  for (const { name, run } of tests) { try { await run(); console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}\n${error.stack}`); } }
  console.log(`Unified workspace: ${tests.length - failed}/${tests.length} synthetic tests passed.`);
  if (failed) process.exitCode = 1;
  if (process.env.UNIFIED_UI_PREVIEW) await preview(process.env.UNIFIED_UI_PREVIEW);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
