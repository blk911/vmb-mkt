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
      module, exports: module.exports, URL, URLSearchParams, Date, Error, TypeError, AbortController, Request, Response, Headers,
      Buffer, TextDecoder, TextEncoder, setTimeout, clearTimeout, queueMicrotask, console, requestAnimationFrame: fn => fn(), document: { getElementById: () => null }, fetch: forbidden, ...globals,
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
const hasControl = (tree, label) => elements(tree, node => node.type === 'label' && textOf(node.props.children?.[0]) === label).length > 0;
const child = (tree, name) => elements(tree, node => typeof node.type === 'function' && node.type.name === name)[0];
const rowsIn = tree => elements(tree, node => node.props?.row?.id && node.props.onToggle);
const click = (instance, label) => { const action = button(instance.tree, label); assert(action, `Missing button: ${label}`); assert(!action.props.disabled, `Button disabled: ${label}`); action.props.onClick(); instance.render(); return action; };
const change = (instance, label, value) => { control(instance.tree, label).props.onChange({ target: { value } }); instance.render(); };
const openFilters = instance => { const action = button(instance.tree, /^Filters(?: \(\d+\))?$/); if (action && !action.props['aria-expanded']) click(instance, /^Filters(?: \(\d+\))?$/); };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const settle = async instance => { for (let n = 0; n < 16; n++) await Promise.resolve(); return instance?.render(); };
const response = value => ({ ok: true, status: 200, json: async () => clone(value) });
const storage = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key), clear: () => values.clear(), values }; };
function browser(href = 'https://synthetic.invalid/dashboard/data?external=keep#retained', sharedStorage = storage()) {
  let url = new URL(href), index = 0, routerPath = url.pathname;
  const listeners = new Map(), entries = [{ href: url.href, state: { __NA: true, tree: ['synthetic-next-router-state'] } }], calls = [];
  const location = {};
  for (const key of ['href', 'pathname', 'search', 'hash', 'origin']) Object.defineProperty(location, key, { get: () => url[key] });
  const dispatch = event => { for (const fn of listeners.get(event.type) || []) fn(event); };
  // Next 16 patches user history calls: unmarked/null data synchronizes the router
  // and carries framework state forward; copied __NA/_N data skips that update.
  const routerState = state => {
    if (state?.__NA || state?._N) return clone(state);
    routerPath = url.pathname;
    return { ...clone(state), __NA: entries[index].state.__NA, tree: clone(entries[index].state.tree) };
  };
  const history = {
    get state() { return entries[index].state; }, get length() { return entries.length; },
    replaceState(state, title, next) { url = new URL(String(next), url); entries[index] = { href: url.href, state: routerState(state) }; calls.push({ type: 'replace', state, href: url.href }); },
    pushState(state, title, next) { url = new URL(String(next), url); entries.splice(index + 1); entries.push({ href: url.href, state: routerState(state) }); index++; calls.push({ type: 'push', state, href: url.href }); },
    back() { if (index > 0) { index--; url = new URL(entries[index].href); routerPath = url.pathname; dispatch({ type: 'popstate', state: this.state }); } },
    forward() { if (index < entries.length - 1) { index++; url = new URL(entries[index].href); routerPath = url.pathname; dispatch({ type: 'popstate', state: this.state }); } },
  };
  const window = { location, history, sessionStorage: sharedStorage, localStorage: sharedStorage, setTimeout, clearTimeout,
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); }, dispatchEvent: dispatch,
  };
  return { window, location, history, sessionStorage: sharedStorage, localStorage: sharedStorage, calls, entries, get routerPath() { return routerPath; }, navigate(next) { url = new URL(next, url); routerPath = url.pathname; } };
}
const row = (id = 'alpha', extra = {}) => ({ id: `provider:adminPipelineParsedCandidates:synthetic-${id}`, entityType: 'provider', displayName: `${id} Synthetic`, providerName: `${id} Synthetic`, businessName: '', platformLabel: '', market: 'Unknown', vertical: 'Unknown', verticals: [], city: '', state: '', postalCode: '', area: '', services: [], reviewStatus: 'pending', sourceRefs: [], linkedEntities: [], reviewDecisions: [], conflicts: [], evidence: [], legacyIds: [], updatedAt: '2026-10-14T17:00:00Z', ...extra });
const fixedList = (extra = {}) => ({ id: 'synthetic-fixed', name: 'Synthetic fixed list', membershipMode: 'fixed', catalogIds: [row().id], techIds: [row().id], workflow: {}, ...extra });
const dynamicList = (extra = {}) => fixedList({ id: 'synthetic-search', name: 'Synthetic live search', membershipMode: 'dynamic', filters: { city: 'Synthetic City' }, ...extra });
function apiFixture({ rows = [row()], lists = [], viewer = { canReview: false }, holdPosts = false } = {}) {
  const calls = [], pending = [], failures = [];
  const { filterCatalogRecords } = loader()('src/lib/catalog/query.ts');
  let currentRows = clone(rows), currentLists = clone(lists);
  const resolvedList = value => {
    const list = clone(value);
    if (list.membershipMode === 'dynamic') list.catalogIds = filterCatalogRecords(currentRows, list.filters || {}).map(record => record.id);
    list.techIds = [...(list.catalogIds || list.techIds || [])];
    return list;
  };
  const fetch = (url, init = {}) => {
    const method = init.method || 'GET', call = { url: String(url), init, method }; calls.push(call);
    assert(call.url.startsWith('/api/'), 'Only same-origin mocked API paths are allowed.');
    const failureIndex = failures.findIndex(value => value.method === method && value.url === call.url);
    const failure = failureIndex >= 0 ? failures.splice(failureIndex, 1)[0] : undefined;
    if (method === 'GET' && call.url === '/api/catalog') return Promise.resolve(failure?.result || response({ ok: true, rows: currentRows, viewer, generatedAt: '2026-10-14T17:00:00Z' }));
    if (method === 'GET' && ['/api/targets/lists', '/api/targets/lists?includeArchived=true'].includes(call.url)) {
      if (failure) return Promise.resolve(failure.result);
      const includeArchived = call.url.endsWith('?includeArchived=true');
      if (includeArchived && viewer?.canReview !== true) return Promise.resolve({ ok: false, status: 403, json: async () => ({ ok: false, error: 'forbidden' }) });
      return Promise.resolve(response({ ok: true, lists: currentLists.filter(list => includeArchived || !list.archivedAt).map(resolvedList) }));
    }
    assert.equal(call.url, '/api/targets/lists'); assert.equal(method, 'POST');
    const body = JSON.parse(init.body); call.body = body;
    const complete = () => {
      if (failure) return failure.result;
      if (['archive', 'restore'].includes(body.op) && viewer?.canReview !== true) return { ok: false, status: 403, json: async () => ({ ok: false, error: 'forbidden' }) };
      let list;
      if (body.op === 'create') {
        list = fixedList({ id: `synthetic-created-${currentLists.length}`, name: body.name, membershipMode: body.membershipMode || 'fixed', filters: body.filters, catalogIds: body.catalogIds || [], techIds: body.catalogIds || [] });
        currentLists = [list, ...currentLists];
      } else {
        list = clone(currentLists.find(value => value.id === body.id)); assert(list, 'Synthetic target list must exist.');
        if (body.op === 'addMany') list.catalogIds = [...new Set([...list.catalogIds, ...body.catalogIds])];
        else if (body.op === 'removeMany') list.catalogIds = list.catalogIds.filter(id => !body.catalogIds.includes(id));
        else if (body.op === 'setFilters') list.filters = body.filters;
        else if (body.op === 'archive') list.archivedAt = '2026-10-15T14:00:00Z';
        else if (body.op === 'restore') delete list.archivedAt;
        else if (body.op === 'rename') list.name = body.name;
        else if (body.op === 'setNotes') list.notes = body.notes;
        else if (body.op === 'setWorkflow') list.workflow = body.workflow;
        else throw new Error(`Unexpected list operation: ${body.op}`);
        list.techIds = [...list.catalogIds]; currentLists = currentLists.map(value => value.id === list.id ? list : value);
      }
      return response(body.op === 'archive' ? { ok: true, archived: list.id, deleted: list.id, recoverable: true } : { ok: true, list: resolvedList(list) });
    };
    if (!holdPosts) return Promise.resolve(complete());
    const gate = deferred(); pending.push({ gate, complete }); return gate.promise;
  };
  return { fetch, calls, pending, get posts() { return calls.filter(call => call.method === 'POST'); }, get lists() { return clone(currentLists); }, get rows() { return clone(currentRows); }, replaceRows(value) { currentRows = clone(value); },
    failNext(method, url, message = 'Synthetic service unavailable.', status = 503) { failures.push({ method, url, result: { ok: false, status, json: async () => ({ ok: false, message }) } }); },
    respondNext(method, url, value) { failures.push({ method, url, result: response(value) }); },
    holdNext(method, url) { const gate = deferred(); failures.push({ method, url, result: gate.promise }); return gate; },
    resolvePost(index = 0) { pending[index].gate.resolve(pending[index].complete()); },
  };
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
  change(instance, 'Search this list', 'Changed Synthetic'); assert.equal(api.posts.length, 1);
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
  openFilters(instance); change(instance, 'City', 'Synthetic City'); click(instance, 'Refresh view'); await settle(instance);
  assert.deepEqual(rowsIn(instance.tree).map(n => n.props.row.id), [first.id]); assert.deepEqual(api.lists[0].catalogIds, [first.id, missing]);
  assert.equal(api.posts.length, 0); instance.unmount();
});

test('list refresh restores explicit URL filters instead of silently replacing them', async () => {
  const list = dynamicList({ filters: { city: 'Saved Synthetic City' } });
  const { instance } = await workspace({ props: { initialView: 'lists', initialListId: list.id }, href: `https://synthetic.invalid/dashboard/lists?listId=${list.id}&city=Preview%20Synthetic%20City&sort=provider&direction=desc`, lists: [list] });
  openFilters(instance); assert.equal(control(instance.tree, 'City').props.value, 'Preview Synthetic City');
  assert.match(textOf(instance.tree), /Unsaved filter preview/); instance.unmount();
});

test('cleared dynamic-filter preview survives full browser remount without changing saved membership', async () => {
  const list = dynamicList({ filters: { city: 'Saved Synthetic City' } });
  const props = { initialView: 'lists', initialListId: list.id };
  const first = await workspace({ props, href: `https://synthetic.invalid/dashboard/lists?listId=${list.id}`, lists: [list] });
  openFilters(first.instance); assert.equal(control(first.instance.tree, 'City').props.value, 'Saved Synthetic City');
  click(first.instance, 'Clear filters'); const href = first.client.location.href;
  assert.equal(new URL(href).searchParams.get('preview'), '1'); assert.equal(first.api.posts.length, 0); first.instance.unmount();
  const restored = await workspace({ props, href, lists: [list] });
  openFilters(restored.instance); assert.equal(control(restored.instance.tree, 'City').props.value, '');
  assert.match(textOf(restored.instance.tree), /Unsaved filter preview/); assert.deepEqual(restored.api.lists[0].filters, { city: 'Saved Synthetic City' }); restored.instance.unmount();
});

test('popstate between dynamic lists applies each list saved filters when no preview is present', async () => {
  const firstList = dynamicList({ id: 'synthetic-first-search', filters: { city: 'First Synthetic City' } });
  const secondList = dynamicList({ id: 'synthetic-second-search', filters: { city: 'Second Synthetic City' } });
  const props = { initialView: 'lists', initialListId: firstList.id };
  const { instance, client } = await workspace({ props, href: `https://synthetic.invalid/dashboard/lists?listId=${firstList.id}`, lists: [firstList, secondList] });
  client.history.pushState(client.history.state, '', `/dashboard/lists?listId=${secondList.id}`); client.window.dispatchEvent({ type: 'popstate' }); instance.render();
  openFilters(instance); assert.equal(control(instance.tree, 'City').props.value, 'Second Synthetic City');
  client.history.back(); instance.render(); openFilters(instance); assert.equal(control(instance.tree, 'City').props.value, 'First Synthetic City'); instance.unmount();
});

test('popstate restores URL state, including default sort when omitted', async () => {
  const { instance, client } = await workspace();
  client.history.pushState(client.history.state, '', '/dashboard/targets?q=Synthetic&sort=provider&direction=desc');
  client.window.dispatchEvent({ type: 'popstate' }); instance.render();
  assert.equal(control(instance.tree, 'Search prospects').props.value, 'Synthetic'); assert.equal(new URL(client.location.href).searchParams.get('sort'), 'provider'); assert.equal(new URL(client.location.href).searchParams.get('direction'), 'desc');
  client.history.pushState(client.history.state, '', '/dashboard/targets'); client.window.dispatchEvent({ type: 'popstate' }); instance.render();
  assert.equal(control(instance.tree, 'Search prospects').props.value, ''); assert(button(instance.tree, 'Booking platform ↑'));
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

// Saved-list regressions exercise deterministic React hooks and mocked requests.
// They do not claim browser layout, focus, keyboard or live-service coverage.
const listProps = list => ({ initialView: 'lists', initialListId: list.id });
const listHref = (list, suffix = '') => `https://synthetic.invalid/dashboard/lists?listId=${list.id}${suffix}`;
const renderedIds = instance => rowsIn(instance.tree).map(node => node.props.row.id).sort();
const noCatalogMutations = api => assert(api.calls.every(call => call.method === 'GET' || call.url === '/api/targets/lists'), 'Saved-list actions must never write catalog, profile or review data.');
const region = (tree, label) => elements(tree, node => node.props?.['aria-label'] === label)[0];
const snapshotMembership = list => ({ membershipMode: list.membershipMode, catalogIds: list.catalogIds, techIds: list.techIds, filters: list.filters, unresolvedLegacyItems: list.unresolvedLegacyItems, workflow: list.workflow, notes: list.notes });

test('fixed and dynamic saved lists default to compact controls without stats, sidebar or editor', async () => {
  const first = row('alpha', { city: 'Synthetic City' }), second = row('bravo', { city: 'Elsewhere' });
  for (const list of [fixedList(), dynamicList()]) {
    const { instance, api } = await workspace({ props: listProps(list), href: listHref(list), rows: [first, second], lists: [list] });
    assert(!region(instance.tree, 'Counts in current view'));
    assert.equal(elements(instance.tree, node => node.type === 'aside').length, 0);
    assert(!region(instance.tree, 'My saved lists')); assert(!child(instance.tree, 'ListEditor'));
    assert(!hasControl(instance.tree, 'Find a list')); assert(!hasControl(instance.tree, 'City')); assert(!hasControl(instance.tree, 'Market'));
    assert.deepEqual(elements(region(instance.tree, 'Catalog filters'), node => node.type === 'label').map(node => textOf(node.props.children?.[0])), ['Search this list', 'Platform']);
    assert.equal(control(instance.tree, 'Saved list').props.value, list.id);
    assert(button(instance.tree, '← All prospects')); assert(button(instance.tree, 'List settings'));
    assert.equal(button(instance.tree, /^Filters/).props['aria-expanded'], false);
    const exportLink = elements(instance.tree, node => node.type === 'a' && textOf(node) === 'Export CSV')[0];
    assert.equal(exportLink.props.href, `/api/targets/export?listId=${list.id}&format=csv`);
    assert.deepEqual(renderedIds(instance), [first.id]); assert.equal(api.posts.length, 0);
    openFilters(instance); assert(hasControl(instance.tree, 'City')); click(instance, /^Filters/); assert(!hasControl(instance.tree, 'City'));
    assert.deepEqual(renderedIds(instance), [first.id]); noCatalogMutations(api); instance.unmount();
  }
});

test('saved-list selector resets previews and selection; All prospects clears list restriction and every filter', async () => {
  const records = [row('alpha', { city: 'Synthetic City' }), row('bravo', { city: 'Elsewhere' })];
  const fixed = fixedList(), dynamic = dynamicList({ filters: { city: 'Elsewhere' } });
  const { instance, api, client } = await workspace({ props: listProps(fixed), href: listHref(fixed, '&external=keep#retained'), rows: records, lists: [fixed, dynamic] });
  assert.deepEqual(selectValues(control(instance.tree, 'Saved list')), ['', fixed.id, dynamic.id]);
  selectRow(instance); openFilters(instance); change(instance, 'Search this list', 'no match');
  change(instance, 'Saved list', dynamic.id);
  assert.deepEqual(renderedIds(instance), [records[1].id]); assert(!button(instance.tree, 'Clear selection'));
  assert.equal(control(instance.tree, 'Search this list').props.value, ''); assert(!hasControl(instance.tree, 'City'));
  assert.equal(new URL(client.location.href).searchParams.get('city'), 'Elsewhere');
  change(instance, 'Search this list', 'no match'); openFilters(instance); change(instance, 'Market', 'Unknown'); change(instance, 'Review status', 'approved');
  click(instance, '← All prospects');
  assert.deepEqual(renderedIds(instance), records.map(record => record.id).sort());
  assert(region(instance.tree, 'Counts in current view')); assert(!hasControl(instance.tree, 'Saved list'));
  assert.equal(control(instance.tree, 'Search prospects').props.value, ''); assert.equal(control(instance.tree, 'City').props.value, '');
  const url = new URL(client.location.href);
  for (const name of ['listId', 'q', 'market', 'reviewStatus', 'city', 'page', 'preview']) assert.equal(url.searchParams.has(name), false, `${name} should be cleared`);
  assert.equal(url.pathname, '/dashboard/targets'); assert.equal(client.routerPath, '/dashboard/targets'); assert(client.calls.every(call => call.state === null), 'App calls must not carry Next internal router markers.'); assert.equal(url.searchParams.get('external'), 'keep'); assert.equal(url.hash, '#retained');
  assert.equal(client.history.state.__NA, true); assert.equal(api.posts.length, 0); assert.deepEqual(api.lists, [fixed, dynamic]); instance.unmount();
});

test('My lists is an explicit full-width browser and hides archived lists after remount', async () => {
  const first = fixedList({ workflow: { owner: 'Synthetic owner' }, notes: 'Synthetic note' });
  const second = dynamicList(), archived = fixedList({ id: 'synthetic-archived', name: 'Previously deleted', archivedAt: '2026-10-14T10:00:00Z' });
  const { instance, api } = await workspace({ props: { initialView: 'lists' }, href: 'https://synthetic.invalid/dashboard/lists', lists: [first, second, archived] });
  assert(region(instance.tree, 'My saved lists')); assert(!region(instance.tree, 'Counts in current view'));
  assert(!region(instance.tree, 'Scrollable catalog results')); assert.equal(elements(instance.tree, node => node.type === 'aside').length, 0);
  assert.deepEqual(selectValues(control(instance.tree, 'Saved list')), ['', first.id, second.id]); assert(!textOf(instance.tree).includes(archived.name));
  change(instance, 'Find a list', 'Synthetic owner'); assert(button(instance.tree, /^Synthetic fixed listFixed selection/)); assert(!button(instance.tree, /^Synthetic live searchLive filter/));
  change(instance, 'Find a list', 'Synthetic note'); click(instance, /^Synthetic fixed listFixed selection/);
  assert.equal(control(instance.tree, 'Saved list').props.value, first.id); assert(!region(instance.tree, 'My saved lists'));
  click(instance, /^My lists/); assert(region(instance.tree, 'My saved lists')); assert.equal(control(instance.tree, 'Saved list').props.value, '');
  assert.equal(api.posts.length, 0); instance.unmount();
});

test('list settings opens on demand, closes without a write, and resets when switching lists', async () => {
  const first = fixedList(), second = dynamicList();
  const { instance, api } = await workspace({ props: listProps(first), href: listHref(first), lists: [first, second] });
  click(instance, 'List settings'); let editor = child(instance.tree, 'ListEditor'); assert(editor); assert.equal(editor.props.list.id, first.id);
  assert.equal(button(instance.tree, 'List settings').props['aria-expanded'], true);
  editor.props.onClose(); instance.render(); assert(!child(instance.tree, 'ListEditor'));
  click(instance, 'List settings'); click(instance, 'List settings'); assert(!child(instance.tree, 'ListEditor'));
  click(instance, 'List settings'); change(instance, 'Saved list', second.id); assert(!child(instance.tree, 'ListEditor'));
  let closed = 0;
  const nested = harness('src/components/catalog/ListEditor.tsx', { list: first, onUpdated() { throw new Error('Closing must not save.'); }, onClose() { closed++; }, onSaveStart() { return true; }, onSaveEnd() {} }, { fetch: api.fetch });
  change(nested, 'List name', 'Unsaved name'); change(nested, 'Notes', 'Unsaved notes'); click(nested, 'Done');
  assert.equal(closed, 1); assert.equal(api.posts.length, 0); assert.deepEqual(api.lists, [first, second]); nested.unmount(); instance.unmount();
});

test('list selection and All prospects round-trip through back/forward with preview filters intact', async () => {
  const records = [row('alpha', { city: 'Synthetic City' }), row('bravo', { city: 'Elsewhere' })];
  const first = fixedList(), second = dynamicList({ filters: { city: 'Elsewhere' } });
  const { instance, client, api } = await workspace({ props: listProps(first), href: listHref(first), rows: records, lists: [first, second] });
  change(instance, 'Search this list', 'alpha'); const fixedUrl = client.location.href;
  change(instance, 'Saved list', second.id); change(instance, 'Search this list', 'bravo'); const dynamicUrl = client.location.href;
  selectRow(instance); click(instance, 'List settings'); openFilters(instance); click(instance, '← All prospects'); const allUrl = client.location.href;
  client.history.back(); instance.render();
  assert.equal(client.location.href, dynamicUrl); assert.equal(control(instance.tree, 'Saved list').props.value, second.id); assert.equal(control(instance.tree, 'Search this list').props.value, 'bravo');
  assert.deepEqual(renderedIds(instance), [records[1].id]); assert(!child(instance.tree, 'ListEditor')); assert(!button(instance.tree, 'Clear selection')); assert(!hasControl(instance.tree, 'City'));
  client.history.back(); instance.render(); assert.equal(client.location.href, fixedUrl); assert.equal(control(instance.tree, 'Saved list').props.value, first.id); assert.deepEqual(renderedIds(instance), [records[0].id]);
  client.history.forward(); instance.render(); assert.equal(client.location.href, dynamicUrl); assert.deepEqual(renderedIds(instance), [records[1].id]);
  client.history.forward(); instance.render(); assert.equal(client.location.href, allUrl); assert.deepEqual(renderedIds(instance), records.map(record => record.id).sort());
  assert.equal(client.history.state.__NA, true); assert.equal(api.posts.length, 0); instance.unmount();
});

test('external Next route reuse restores path and list identity without requiring a popstate or remount', async () => {
  const records = [row('alpha', { city: 'Synthetic City' }), row('bravo', { city: 'Elsewhere' })];
  const first = fixedList(), second = dynamicList({ filters: { city: 'Elsewhere' } });
  const { instance, client, api } = await workspace({ props: listProps(first), href: listHref(first), rows: records, lists: [first, second] });
  selectRow(instance); click(instance, 'List settings'); openFilters(instance);
  client.navigate('/dashboard/targets?q=bravo'); instance.render();
  assert(!hasControl(instance.tree, 'Saved list')); assert(region(instance.tree, 'Counts in current view')); assert.deepEqual(renderedIds(instance), [records[1].id]);
  assert.equal(control(instance.tree, 'Search prospects').props.value, 'bravo'); assert(!child(instance.tree, 'ListEditor')); assert(!button(instance.tree, 'Clear selection'));
  client.navigate(`/dashboard/lists?listId=${second.id}`); instance.render();
  assert.equal(control(instance.tree, 'Saved list').props.value, second.id); assert.deepEqual(renderedIds(instance), [records[1].id]); assert.equal(control(instance.tree, 'Search this list').props.value, '');
  client.navigate(`/dashboard/lists?listId=${first.id}`); instance.render();
  assert.equal(control(instance.tree, 'Saved list').props.value, first.id); assert.deepEqual(renderedIds(instance), [records[0].id]);
  client.navigate('/dashboard/lists'); instance.render(); assert(region(instance.tree, 'My saved lists')); assert(!region(instance.tree, 'Scrollable catalog results'));
  assert.equal(api.posts.length, 0); instance.unmount();
});

test('filter-only URL synchronization preserves list selection and open settings', async () => {
  const list = fixedList(); const { instance, client, api } = await workspace({ props: listProps(list), href: listHref(list), lists: [list] });
  selectRow(instance); click(instance, 'List settings'); openFilters(instance);
  change(instance, 'Search this list', 'alpha'); instance.render(); change(instance, 'Market', 'Unknown'); instance.render();
  assert.equal(new URL(client.location.href).searchParams.get('q'), 'alpha'); assert.equal(rowsIn(instance.tree)[0].props.selected, true);
  assert(child(instance.tree, 'ListEditor')); assert.equal(button(instance.tree, /^Filters/).props['aria-expanded'], true);
  assert.equal(control(instance.tree, 'Market').props.value, 'Unknown'); assert.equal(api.posts.length, 0); instance.unmount();
});

test('delayed Next hook updates after native navigation preserve newer user actions; popstate still restores filters', async () => {
  const records = [row('alpha', { city: 'Synthetic City' }), row('bravo', { city: 'Elsewhere' })];
  const first = fixedList(), second = dynamicList({ filters: { city: 'Elsewhere' } });
  const client = browser(listHref(first)), api = apiFixture({ rows: records, lists: [first, second] });
  let routerUrl = new URL(client.location.href);
  const instance = harness(workspaceFile, listProps(first), { ...client, fetch: api.fetch }, {
    'next/navigation': { usePathname: () => routerUrl.pathname, useSearchParams: () => new URLSearchParams(routerUrl.search), useRouter: () => ({ refresh() {} }) },
  });
  await settle(instance); change(instance, 'Saved list', second.id); selectRow(instance); click(instance, 'List settings'); openFilters(instance); change(instance, 'Search this list', 'bravo');
  routerUrl = new URL(client.location.href); instance.render();
  assert.equal(rowsIn(instance.tree)[0].props.selected, true); assert(child(instance.tree, 'ListEditor')); assert.equal(button(instance.tree, /^Filters/).props['aria-expanded'], true);
  assert.equal(control(instance.tree, 'Search this list').props.value, 'bravo');
  client.history.pushState(null, '', `/dashboard/lists?listId=${second.id}&q=no-match&preview=1`); client.window.dispatchEvent({ type: 'popstate' }); instance.render();
  assert.equal(control(instance.tree, 'Search this list').props.value, 'no-match'); assert.equal(rowsIn(instance.tree).length, 0); assert(!child(instance.tree, 'ListEditor')); assert(!button(instance.tree, 'Clear selection'));
  assert.equal(api.posts.length, 0); instance.unmount();
});

test('dynamic lists follow saved filters on catalog refresh while preview edits never save themselves', async () => {
  const first = row('alpha', { city: 'Synthetic City' }), second = row('bravo', { city: 'Elsewhere' }), added = row('charlie', { city: 'Synthetic City' });
  const list = dynamicList();
  const { instance, api } = await workspace({ props: listProps(list), href: listHref(list), rows: [first, second], lists: [list] });
  assert.deepEqual(renderedIds(instance), [first.id]);
  api.replaceRows([first, second, added]); click(instance, 'Refresh view'); await settle(instance);
  assert.deepEqual(renderedIds(instance), [first.id, added.id].sort());
  change(instance, 'Search this list', 'charlie'); assert.deepEqual(renderedIds(instance), [added.id]);
  click(instance, 'Refresh view'); await settle(instance); assert.deepEqual(renderedIds(instance), [added.id]);
  assert.match(textOf(instance.tree), /Unsaved filter preview/); assert.deepEqual(api.lists[0].filters, { city: 'Synthetic City' });
  assert.equal(api.posts.length, 0); noCatalogMutations(api); instance.unmount();
});

test('delete confirmation cancels safely and repeated archive/Undo clicks each send one recoverable request', async () => {
  const record = row('alpha', { reviewStatus: 'approved', evidence: [{ label: 'Synthetic evidence' }] });
  const list = fixedList({ notes: 'Retain notes', workflow: { owner: 'Synthetic owner', pinned: true }, unresolvedLegacyItems: [{ kind: 'tech', refId: 'legacy-synthetic' }] });
  const { instance, api, client } = await workspace({ props: listProps(list), href: listHref(list), rows: [record], lists: [list], viewer: { canReview: true }, holdPosts: true });
  click(instance, 'Delete list'); assert(region(instance.tree, 'Confirm list deletion')); assert.equal(api.posts.length, 0);
  assert.match(textOf(region(instance.tree, 'Confirm list deletion')), /Prospects, profiles, review decisions, and the saved membership stay intact/);
  click(instance, 'Cancel'); assert(!region(instance.tree, 'Confirm list deletion')); assert.deepEqual(api.lists, [list]);
  click(instance, 'Delete list'); const confirm = button(instance.tree, 'Delete list only'); confirm.props.onClick(); confirm.props.onClick(); instance.render();
  assert.equal(api.posts.length, 1); assert.deepEqual(api.posts[0].body, { op: 'archive', id: list.id });
  assert.equal(button(instance.tree, 'Deleting…').props.disabled, true); assert.equal(button(instance.tree, 'Cancel').props.disabled, true);
  api.resolvePost(); await settle(instance);
  assert(!region(instance.tree, 'Confirm list deletion')); assert(button(instance.tree, 'Undo delete')); assert.equal(new URL(client.location.href).pathname, '/dashboard/targets');
  assert(api.lists[0].archivedAt); assert.deepEqual(snapshotMembership(api.lists[0]), snapshotMembership(list)); assert.deepEqual(api.rows, [record]);
  const undo = button(instance.tree, 'Undo delete'); undo.props.onClick(); undo.props.onClick(); instance.render();
  assert.equal(api.posts.length, 2); assert.deepEqual(api.posts[1].body, { op: 'restore', id: list.id }); assert(button(instance.tree, 'Undo delete').props.disabled);
  api.resolvePost(1); await settle(instance);
  assert.equal(control(instance.tree, 'Saved list').props.value, list.id); assert(!button(instance.tree, 'Undo delete')); assert.deepEqual(snapshotMembership(api.lists[0]), snapshotMembership(list)); assert(!api.lists[0].archivedAt);
  assert.deepEqual(api.rows, [record]); assert.deepEqual(renderedIds(instance), [record.id]); noCatalogMutations(api); instance.unmount();
});

test('archive errors and unconfirmed server success keep list, membership and retry controls intact', async () => {
  const list = fixedList();
  const { instance, api } = await workspace({ props: listProps(list), href: listHref(list), lists: [list], viewer: { canReview: true } });
  api.failNext('POST', '/api/targets/lists', 'Synthetic delete failed.');
  click(instance, 'Delete list'); click(instance, 'Delete list only'); await settle(instance);
  assert.match(textOf(instance.tree), /Synthetic delete failed/); assert(region(instance.tree, 'Confirm list deletion'));
  assert.equal(control(instance.tree, 'Saved list').props.value, list.id); assert(!button(instance.tree, 'Undo delete')); assert.deepEqual(api.lists, [list]);
  for (const payload of [{ ok: true, archived: list.id }, { ok: true, archived: 'wrong-list', recoverable: true }]) {
    api.respondNext('POST', '/api/targets/lists', payload); click(instance, 'Delete list only'); await settle(instance);
    assert.match(textOf(instance.tree), /did not confirm recoverable deletion/); assert.deepEqual(api.lists, [list]); assert(!button(instance.tree, 'Undo delete'));
  }
  click(instance, 'Delete list only'); await settle(instance); assert(button(instance.tree, 'Undo delete')); assert(api.lists[0].archivedAt);
  noCatalogMutations(api); instance.unmount();
});

test('Deleted lists survives refresh/remount and restores fixed and dynamic lists with saved configuration', async () => {
  for (const original of [fixedList({ catalogIds: [row().id, 'synthetic-missing'], techIds: [row().id, 'synthetic-missing'] }), dynamicList()]) {
    const record = row('alpha', { city: 'Synthetic City', reviewStatus: 'approved' });
    const first = await workspace({ props: listProps(original), href: listHref(original), rows: [record], lists: [original], viewer: { canReview: true } });
    click(first.instance, 'Delete list'); click(first.instance, 'Delete list only'); await settle(first.instance);
    const persisted = first.api.lists; first.instance.unmount();
    const { instance, api } = await workspace({ props: listProps(original), href: listHref(original), rows: [record], lists: persisted, viewer: { canReview: true }, holdPosts: true });
    assert.match(textOf(instance.tree), /unavailable or deleted/); assert(!button(instance.tree, 'Undo delete')); assert.deepEqual(selectValues(control(instance.tree, 'Saved list')), ['']);
    click(instance, 'Refresh view'); await settle(instance); assert(!textOf(control(instance.tree, 'Saved list')).includes(original.name));
    click(instance, 'Deleted lists'); await settle(instance);
    assert(api.calls.some(call => call.url === '/api/targets/lists?includeArchived=true')); assert(button(instance.tree, `Restore ${original.name}`));
    const restore = button(instance.tree, `Restore ${original.name}`); restore.props.onClick(); restore.props.onClick(); instance.render();
    assert.equal(api.posts.length, 1); assert(button(instance.tree, 'Restoring…').props.disabled);
    api.resolvePost(); await settle(instance);
    assert.equal(control(instance.tree, 'Saved list').props.value, original.id); assert(!region(instance.tree, 'Deleted lists'));
    assert.deepEqual(snapshotMembership(api.lists[0]), snapshotMembership(original)); assert(!api.lists[0].archivedAt); assert.deepEqual(api.rows, [record]);
    click(instance, 'Refresh view'); await settle(instance); assert.equal(control(instance.tree, 'Saved list').props.value, original.id); noCatalogMutations(api); instance.unmount();
  }
});

test('Deleted lists load and restore failures remain recoverable without hiding or changing membership', async () => {
  const list = fixedList({ archivedAt: '2026-10-14T10:00:00Z' });
  const { instance, api } = await workspace({ props: listProps(list), href: listHref(list), lists: [list], viewer: { canReview: true } });
  api.failNext('GET', '/api/targets/lists?includeArchived=true', 'Synthetic deleted-list read failed.');
  click(instance, 'Deleted lists'); await settle(instance); assert.match(textOf(instance.tree), /Synthetic deleted-list read failed/);
  assert.match(textOf(region(instance.tree, 'Deleted lists')), /Deleted lists are unavailable/); assert(!textOf(region(instance.tree, 'Deleted lists')).includes('No deleted lists.'));
  click(instance, 'Retry deleted lists'); await settle(instance); assert(button(instance.tree, `Restore ${list.name}`));
  api.failNext('POST', '/api/targets/lists', 'Synthetic restore failed.');
  click(instance, `Restore ${list.name}`); await settle(instance); assert.match(textOf(instance.tree), /Synthetic restore failed/); assert(button(instance.tree, `Restore ${list.name}`));
  assert.deepEqual(api.lists, [list]);
  for (const payload of [{ ok: true, list }, { ok: true, list: { ...list, id: 'wrong-list', archivedAt: undefined } }, { ok: true }]) {
    api.respondNext('POST', '/api/targets/lists', payload); click(instance, `Restore ${list.name}`); await settle(instance);
    assert.match(textOf(instance.tree), /did not confirm the restored list/); assert.deepEqual(api.lists, [list]); assert(button(instance.tree, `Restore ${list.name}`));
  }
  click(instance, `Restore ${list.name}`); await settle(instance); assert.equal(control(instance.tree, 'Saved list').props.value, list.id); assert(!api.lists[0].archivedAt);
  noCatalogMutations(api); instance.unmount();
});

test('delete and recovery controls use server capability, never admin route or prop hints', async () => {
  const list = fixedList();
  for (const [viewer, admin] of [[{}, true], [{ canReview: false }, true], [{ canReview: true }, false]]) {
    const { instance, api } = await workspace({ props: { ...listProps(list), admin }, href: listHref(list).replace('/dashboard/', '/admin/'), lists: [list], viewer });
    const permitted = viewer.canReview === true;
    assert.equal(Boolean(button(instance.tree, 'Delete list')), permitted); assert.equal(Boolean(button(instance.tree, 'Deleted lists')), permitted);
    assert(!button(instance.tree, 'Undo delete')); assert.equal(api.posts.length, 0); assert(!api.calls.some(call => call.url.includes('includeArchived'))); instance.unmount();
  }
  const client = browser(listHref(list)), gate = deferred();
  const instance = harness(workspaceFile, { ...listProps(list), admin: true }, { ...client, fetch: url => url === '/api/catalog' ? gate.promise : Promise.resolve(response({ lists: [list] })) });
  await settle(instance); assert(!button(instance.tree, 'Delete list')); assert(!button(instance.tree, 'Deleted lists'));
  gate.resolve(response({ rows: [row()], viewer: { canReview: false } })); await settle(instance); assert(!button(instance.tree, 'Delete list')); instance.unmount();
});

test('saved-list archive, restore and archived reads enforce admin authorization on the server', async () => {
  let user = null; const reads = [], writes = [], catalogs = [];
  const stored = { id: 'synthetic-fixed', name: 'Synthetic fixed list', membershipMode: 'fixed', scope: 'tech', items: [], workflow: {}, activity: [] };
  class StoreError extends Error {}
  const api = loader({
    '@/lib/auth/access': { getSessionUserFromCookieHeader: async () => user, canAccessMemberArea: value => ['member', 'admin'].includes(value?.role), canAccessAdmin: value => value?.role === 'admin' },
    '@/app/admin/_lib/targets/store': {
      TargetListStoreError: StoreError,
      listTargetLists: async options => { reads.push(['index', clone(options)]); return { lists: [{ id: stored.id }] }; },
      readTargetList: async (id, options) => { reads.push(['list', id, clone(options)]); return clone(stored); },
      deleteTargetList: async (id, actor) => { writes.push(['archive', id, actor]); },
      restoreTargetList: async (id, actor) => { writes.push(['restore', id, actor]); return clone(stored); },
    },
    '@/app/admin/_lib/targets/catalogMembership': { resolveTargetListMembership: () => ({ catalogIds: [row().id], missingIds: [], unresolvedLegacyItems: [] }), validateDynamicFilters: value => value },
    '@/lib/catalog/store': { loadSharedCatalog: async () => { catalogs.push('read'); return { rows: [row()], coverage: {} }; } },
  })('src/app/api/targets/lists/route.ts');
  const post = op => api.POST(new Request('https://synthetic.invalid/api/targets/lists', { method: 'POST', headers: { origin: 'https://synthetic.invalid', 'content-type': 'application/json' }, body: JSON.stringify({ op, id: stored.id }) }));
  for (const [role, expected] of [[null, 401], ['external', 403], ['member', 403]]) {
    user = role ? { username: `synthetic-${role}`, role } : null;
    for (const op of ['delete', 'archive', 'restore']) assert.equal((await post(op)).status, expected);
    assert.equal((await api.GET(new Request('https://synthetic.invalid/api/targets/lists?includeArchived=true'))).status, expected);
  }
  assert.equal(reads.length, 0); assert.equal(writes.length, 0); assert.equal(catalogs.length, 0);
  user = { username: 'synthetic-admin', role: 'admin' };
  const archived = await post('archive'); assert.equal(archived.status, 200); assert.deepEqual(await archived.json(), { ok: true, archived: stored.id, deleted: stored.id, recoverable: true });
  assert.deepEqual(writes, [['archive', stored.id, 'synthetic-admin']]); assert.equal(catalogs.length, 0, 'Archive must not need or write the catalog.');
  const restored = await post('restore'); assert.equal(restored.status, 200); assert.equal((await restored.json()).list.id, stored.id);
  assert.equal((await api.GET(new Request('https://synthetic.invalid/api/targets/lists?includeArchived=true'))).status, 200);
  assert(reads.some(value => value[0] === 'index' && value[1].includeArchived === true));
  assert.deepEqual(writes, [['archive', stored.id, 'synthetic-admin'], ['restore', stored.id, 'synthetic-admin']]);
});

test('settings saves share the workspace mutation lock across repeated submit, close and editor remount', async () => {
  const list = fixedList(), second = dynamicList();
  const { instance, api } = await workspace({ props: listProps(list), href: listHref(list), lists: [list, second], viewer: { canReview: true }, holdPosts: true });
  click(instance, 'List settings'); const editorProps = child(instance.tree, 'ListEditor').props;
  const editor = harness('src/components/catalog/ListEditor.tsx', editorProps, { fetch: api.fetch });
  change(editor, 'List name', 'Synthetic renamed list'); const form = submit(editor, 'Save name'); form.props.onSubmit({ preventDefault() {} }); editor.render(); instance.render();
  assert.equal(api.posts.length, 1); assert.equal(api.posts[0].body.op, 'rename'); assert(button(editor.tree, 'Done').props.disabled);
  assert(button(instance.tree, 'Delete list').props.disabled); assert(button(instance.tree, 'List settings').props.disabled); assert(button(instance.tree, 'Refresh view').props.disabled);
  // Navigation may legitimately unmount an editor; its shared lock must survive it.
  change(instance, 'Saved list', second.id); editor.unmount();
  const replacement = harness('src/components/catalog/ListEditor.tsx', { ...editorProps, list: second }, { fetch: api.fetch });
  change(replacement, 'List name', 'Must not save during other request'); submit(replacement, 'Save name'); assert.equal(api.posts.length, 1);
  api.resolvePost(); await settle(replacement); await settle(instance);
  assert.equal(control(instance.tree, 'Saved list').props.value, second.id, 'Finishing an old editor save must not navigate away from the current list.');
  assert.equal(api.lists.find(value => value.id === list.id).name, 'Synthetic renamed list'); assert(!button(instance.tree, 'Delete list').props.disabled);
  change(instance, 'Saved list', list.id); click(instance, 'Delete list'); click(instance, 'Delete list only');
  assert.equal(api.posts.length, 2); api.resolvePost(1); await settle(instance);
  assert(api.lists.find(value => value.id === list.id).archivedAt); assert(button(instance.tree, 'Undo delete')); noCatalogMutations(api); replacement.unmount(); instance.unmount();
});

test('settings success invalidates stale list refresh and failed saves release the shared lock', async () => {
  const list = fixedList();
  const { instance, api } = await workspace({ props: listProps(list), href: listHref(list), lists: [list], viewer: { canReview: true }, holdPosts: true });
  click(instance, 'List settings'); const editor = harness('src/components/catalog/ListEditor.tsx', child(instance.tree, 'ListEditor').props, { fetch: api.fetch });
  const stale = api.holdNext('GET', '/api/targets/lists'); click(instance, 'Refresh view');
  change(editor, 'List name', 'Fresh saved name'); submit(editor, 'Save name'); editor.render(); instance.render();
  api.resolvePost(); await settle(editor); await settle(instance);
  stale.resolve(response({ ok: true, lists: [list] })); await settle(instance);
  assert.match(textOf(instance.tree), /Fresh saved name/); assert.equal(button(instance.tree, 'Refresh view').props.disabled, false);
  api.failNext('POST', '/api/targets/lists', 'Synthetic editor save failed.'); change(editor, 'Notes', 'Retryable notes'); submit(editor, 'Save notes'); editor.render(); instance.render();
  assert(button(instance.tree, 'Delete list').props.disabled); api.resolvePost(1); await settle(editor); await settle(instance);
  assert.match(textOf(editor.tree), /Synthetic editor save failed/); assert(!button(editor.tree, 'Done').props.disabled); assert(!button(instance.tree, 'Delete list').props.disabled);
  assert.equal(api.lists[0].notes, undefined); noCatalogMutations(api); editor.unmount(); instance.unmount();
});

test('pending archive and restore completion never overrides a newer list navigation', async () => {
  const first = fixedList(), second = dynamicList();
  const { instance, client, api } = await workspace({ props: listProps(first), href: listHref(first), lists: [first, second], viewer: { canReview: true }, holdPosts: true });
  click(instance, 'Delete list'); click(instance, 'Delete list only'); change(instance, 'Saved list', second.id); const newer = client.location.href;
  api.resolvePost(); await settle(instance); assert.equal(client.location.href, newer); assert.equal(control(instance.tree, 'Saved list').props.value, second.id);
  click(instance, 'Undo delete'); click(instance, '← All prospects'); const all = client.location.href;
  api.resolvePost(1); await settle(instance); assert.equal(client.location.href, all); assert(!hasControl(instance.tree, 'Saved list')); assert(!api.lists[0].archivedAt);
  assert.equal(client.routerPath, '/dashboard/targets'); noCatalogMutations(api); instance.unmount();
});

const detailFile = 'src/components/catalog/CatalogDetail.tsx';
const safeReviewRow = (id = 'alpha') => row(id, { reviewKey: `synthetic-intake::synthetic-${id}`, sourceIdentifiers: { intakeId: 'synthetic-intake', candidateId: `synthetic-${id}` }, reviewLanes: [{ lane: 'DORA', queueItemId: `synthetic-${id}-queue`, status: 'queued', actionable: true }], profile: profile('booksy') });

test('quick profile has one collapsed evidence section and no duplicate dashboard fields', async () => {
  const record = safeReviewRow('Quick');
  Object.assign(record, { businessName: 'Synthetic Studio', city: 'Synthetic City', state: 'CO', postalCode: '00000' });
  let selections = 0;
  const gate = deferred();
  const instance = harness(detailFile, { record, onClose() {}, onSelectForList() { selections++; } }, { fetch: () => gate.promise });
  const folds = elements(instance.tree, node => node.type === 'details');
  assert.equal(folds.length, 1); assert(!folds[0].props.open);
  assert.match(textOf(folds[0].props.children[0]), /Evidence & review/);
  assert.equal(child(instance.tree, 'DoraEvidence').props.compact, true);
  assert(!child(instance.tree, 'ProfileSummaryCard'));
  assert.equal((textOf(instance.tree).match(/Quick Synthetic/g) || []).length, 1);
  assert.equal((textOf(instance.tree).match(/Synthetic Studio/g) || []).length, 1);
  assert.equal(button(instance.tree, 'Add to list…').props.disabled, true);
  gate.resolve(response({ record, viewer: { canReview: true } })); await settle(instance);
  click(instance, 'Add to list…'); assert.equal(selections, 1);
  assert(child(folds[0], 'CatalogEvidenceDetails'));
  instance.unmount();
});

test('profile list action adds explicit selection without mutating membership or clearing filters', async () => {
  const { instance, client, api } = await workspace({ href: 'https://synthetic.invalid/admin/prospects?q=Synthetic' });
  rowsIn(instance.tree)[0].props.onOpen(); instance.render();
  const href = client.location.href;
  child(instance.tree, 'CatalogDetail').props.onSelectForList(); instance.render();
  assert(!child(instance.tree, 'CatalogDetail'));
  assert.equal(rowsIn(instance.tree)[0].props.selected, true);
  assert.equal(client.location.href, href); assert.equal(api.posts.length, 0);
  assert(elements(instance.tree, node => node.props?.id === 'catalog-selection-actions').length);
  instance.unmount();
});

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
  const previewLists = [fixedList({ catalogIds: [records[0].id, records[1].id], techIds: [records[0].id, records[1].id] }), dynamicList()];
  const client = browser('https://synthetic.invalid/admin/prospects'), api = apiFixture({ rows: records, lists: previewLists, viewer: { canReview: true } });
  const instance = harness(workspaceFile, { admin: true }, { ...client, fetch: api.fetch }, overrides); await settle(instance);
  const states = [{ name: 'unified-prospects', tree: instance.tree }];
  selectRow(instance); states.push({ name: 'unified-selection', tree: instance.tree });
  click(instance, 'Save this search'); states.push({ name: 'unified-save-search', tree: instance.tree });
  client.history.pushState(null, '', `/admin/lists?listId=${previewLists[0].id}`); client.window.dispatchEvent({ type: 'popstate' }); instance.render();
  states.push({ name: 'saved-list-fixed', tree: instance.tree });
  openFilters(instance); states.push({ name: 'saved-list-filters', tree: instance.tree }); click(instance, /^Filters/);
  click(instance, 'List settings'); states.push({ name: 'saved-list-settings', tree: instance.tree }); click(instance, 'List settings');
  click(instance, 'Delete list'); states.push({ name: 'saved-list-delete-confirmation', tree: instance.tree }); click(instance, 'Cancel');
  change(instance, 'Saved list', previewLists[1].id); states.push({ name: 'saved-list-live', tree: instance.tree });
  click(instance, 'Delete list'); click(instance, 'Delete list only'); await settle(instance); states.push({ name: 'saved-list-undo', tree: instance.tree });
  client.history.pushState(null, '', '/admin/lists'); client.window.dispatchEvent({ type: 'popstate' }); instance.render();
  states.push({ name: 'saved-list-index', tree: instance.tree });
  click(instance, 'Deleted lists'); await settle(instance); states.push({ name: 'saved-list-deleted', tree: instance.tree });
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
