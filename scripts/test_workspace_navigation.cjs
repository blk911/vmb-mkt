/** Synthetic route/navigation regressions. No network, account, or data-store writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { NextRequest } = require('next/server');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
let pathname = '/admin/prospects';
let user = { role: 'admin', username: 'synthetic' };
let intakeFailure = false;
const h = React.createElement;
const cache = new Map();
const catalog = (props) => h('div', { 'data-catalog': props.title, 'data-view': props.initialView, 'data-list': props.initialListId, 'data-admin': String(!!props.admin) });
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} }; cache.set(filename, module);
  let compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  // Expose the private login normalizer only inside this hermetic test VM.
  if (relative === 'src/app/auth/login/page.tsx') compiled += '\nmodule.exports.testSanitizeNextPath = sanitizeNextPath;';
  vm.runInNewContext(compiled, { module, exports: module.exports, URLSearchParams, Date, AbortController, console, process: { env: {} }, fetch() { throw new Error('Network access is forbidden'); }, require(id) {
    if (id === 'react' || id === 'react/jsx-runtime') return require(id);
    if (id === 'next/server') return require(id);
    if (id === 'next/link') return { __esModule: true, default: ({ children, ...props }) => h('a', props, children) };
    if (id === 'next/headers') return { cookies: async () => ({}) };
    if (id === 'next/navigation') return { usePathname: () => pathname, redirect: (href) => { throw Object.assign(new Error('redirect'), { href }); } };
    if (id === '@/lib/auth/access') return {
      getSessionUserFromCookies: async () => user, getSessionUserFromToken: async () => user,
      canAccessAdmin: (value) => value?.role === 'admin', canAccessMemberArea: (value) => ['admin', 'member'].includes(value?.role),
      canShowNavItem: (name, value) => name === 'marketing' || ['request_access', 'login'].includes(name) && !value || ['markets', 'datastore', 'team'].includes(name) && ['admin', 'member'].includes(value?.role) || ['admin', 'liveunits'].includes(name) && value?.role === 'admin',
      isAdminRoute: (value) => value.startsWith('/admin') || value.startsWith('/api/admin'),
      isPublicRoute: (value) => value === '/', isAuthRoute: (value) => value.startsWith('/auth') || value.startsWith('/api/auth'),
      canAccessRoute: (value, session) => value.startsWith('/admin/markets') ? !!session : value.startsWith('/admin') || value.startsWith('/api/admin') ? session?.role === 'admin' : ['admin', 'member'].includes(session?.role),
    };
    if (id === '@/lib/auth/config') return { getSessionSecret: () => 'synthetic-test-secret' };
    if (id === '@/lib/auth/session') return { SESSION_COOKIE: 'synthetic_session' };
    if (id === '@/components/admin/markets/MarketsSectionSubnav') return { __esModule: true, default: () => h('nav', { 'aria-label': 'Markets section' }) };
    if (id === '@/components/catalog/CatalogWorkspace') return { __esModule: true, default: catalog };
    if (id === '@/lib/source-intake/store') return { listSourceIntakes: async () => { if (intakeFailure) throw new Error('synthetic failure'); return [{ id: 'intake/a', sourceLabel: 'Synthetic import', sourceType: 'manual', status: 'processed', submittedAt: '2026-10-14T12:00:00Z', parseSummary: { totalCandidates: 4 }, processSummary: { matchedCount: 1, newCandidateCount: 2, heldCount: 1 } }]; } };
    if (id === '@/lib/admin/pipeline/dashboard') return { getAdminDashboardMetrics: async () => ({ newInputs: 8, pendingValidation: 12, readyTargets: 7, activeOutreach: 3 }) };
    if (id.startsWith('@/') || id.startsWith('.')) {
      const stem = id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : path.resolve(path.dirname(filename), id);
      const file = ['.ts', '.tsx'].map((ext) => stem + ext).find(fs.existsSync);
      assert(file, `Cannot resolve ${id}`); return load(path.relative(root, file));
    }
    throw new Error(`Unexpected import ${id}`);
  } }, { filename });
  return module.exports;
}
const html = (component, props = {}) => renderToStaticMarkup(h(component, props));
const tests = [];
const test = (name, run) => tests.push({ name, run });
const nav = load('src/lib/admin/workspace-nav.ts');
const PipelineNav = load('src/components/admin/PipelineNav.tsx').default;
const AppSwitchNav = load('src/app/_components/AppSwitchNav.tsx').default;

async function redirects(page, params, expected) {
  await assert.rejects(() => load(page).default({ searchParams: Promise.resolve(params) }), (error) => { assert.equal(error.href, expected); return true; });
}
test('query-preserving aliases retain list IDs, filters, repeated values and feedback', async () => {
  const params = { q: 'Nails & hair', listId: 'list/a', status: ['success', 'review'], message: 'Saved' };
  const query = '?q=Nails+%26+hair&listId=list%2Fa&status=success&status=review&message=Saved';
  assert.equal(nav.workspaceHref('/admin/lists', params), '/admin/lists' + query);
  await redirects('src/app/admin/target/page.tsx', params, '/admin/lists' + query);
  await redirects('src/app/admin/page.tsx', {}, '/admin/prospects');
  await redirects('src/app/admin/build/page.tsx', params, '/admin/sources/import' + query);
  await redirects('src/app/admin/data/page.tsx', params, '/admin/tools/data' + query);
  await redirects('src/app/dashboard/data/page.tsx', params, '/dashboard/targets' + query);
});
test('dashboard aliases route administrators into the single workspace', async () => {
  user = { role: 'admin' };
  await redirects('src/app/dashboard/targets/page.tsx', { city: 'Denver' }, '/admin/prospects?city=Denver');
  await redirects('src/app/dashboard/targets/page.tsx', { listId: 'saved' }, '/admin/lists?listId=saved');
  await redirects('src/app/dashboard/lists/page.tsx', { listId: 'saved', page: '2' }, '/admin/lists?listId=saved&page=2');
  await redirects('src/app/dashboard/ops/page.tsx', { owner: 'Avery' }, '/admin/lists/work?owner=Avery');
});
test('member aliases retain their working catalog, lists, and workload without Admin access', async () => {
  user = { role: 'member' };
  const prospects = await load('src/app/dashboard/targets/page.tsx').default({ searchParams: Promise.resolve({}) });
  assert.match(renderToStaticMarkup(prospects), /data-catalog="Prospects"/);
  const lists = await load('src/app/dashboard/lists/page.tsx').default({ searchParams: Promise.resolve({ listId: 'saved' }) });
  assert.match(renderToStaticMarkup(lists), /data-list="saved"/);
  assert.match(renderToStaticMarkup(lists), /data-admin="false"/);
  const work = await load('src/app/dashboard/ops/page.tsx').default({});
  assert.match(renderToStaticMarkup(work), /href="\/dashboard\/lists"/);
});
test('the three workspace pills replace duplicate workflow navigation', () => {
  pathname = '/admin/prospects';
  const rendered = html(PipelineNav);
  for (const label of ['Prospects', 'My lists', 'Sources', 'Admin tools']) assert(rendered.includes(label));
  for (const label of ['Build', 'Review Queue', 'Target', 'Activate', 'Dashboard']) assert(!rendered.includes(`>${label}<`));
  assert.equal((rendered.match(/aria-current="page"/g) || []).length, 1);
  assert.match(rendered, /href="\/admin\/prospects" aria-current="page"/);
});
test('source and list subroutes select the correct parent pill', () => {
  for (const route of ['/admin/source-intake', '/admin/build', '/admin/source-intake/imported-profiles', '/admin/sources/import']) {
    pathname = route; assert.match(html(PipelineNav), /href="\/admin\/sources" aria-current="page"/);
  }
  pathname = '/admin/lists/work'; assert.match(html(PipelineNav), /href="\/admin\/lists" aria-current="page"/);
  pathname = '/admin/tools/data'; assert.match(html(PipelineNav), /href="\/admin\/tools" aria-current="page"/);
  pathname = '/admin/validate/legacy-row'; assert.match(html(PipelineNav), /href="\/admin\/prospects" aria-current="page"/);
});
test('Markets, Social Targets, Live Units and print avoid duplicate Admin navigation', () => {
  for (const route of ['/admin/markets', '/admin/markets/outreach-queue', '/admin/social-targets', '/admin/live-units', '/dashboard/targets/print']) {
    pathname = route; assert.equal(html(PipelineNav), '');
  }
});
test('members see only authorized workspace destinations', () => {
  pathname = '/dashboard/lists';
  const rendered = html(PipelineNav, { member: true });
  assert.match(rendered, /href="\/dashboard\/targets"/); assert.match(rendered, /href="\/dashboard\/lists" aria-current="page"/);
  assert(!rendered.includes('href="/admin/')); assert(!rendered.includes('Sources')); assert(!rendered.includes('Admin tools'));
});
test('global admin navigation has one workspace entry and retires legacy primary pills', () => {
  pathname = '/admin/prospects';
  const rendered = html(AppSwitchNav, { sessionUser: { role: 'admin' } });
  for (const label of ['VMB SALONS', 'TEAM', 'ADMIN']) assert(rendered.includes(label));
  for (const label of ['MARKETS', 'LIVE UNITS']) assert(!rendered.includes(`>${label}<`));
  assert(!rendered.includes('DATA STORE')); assert(!rendered.includes('/dashboard/targets'));
  assert.equal((rendered.match(/aria-current="page"/g) || []).length, 1);
});
test('legacy pages retain local navigation and a clear route back to Prospects and Admin tools', () => {
  for (const route of ['/admin/markets', '/admin/markets/member/example', '/admin/social-targets', '/admin/live-units']) {
    pathname = route;
    const rendered = html(AppSwitchNav, { sessionUser: { role: 'admin' } });
    assert.match(rendered, /aria-label="Legacy tools navigation"/);
    assert.match(rendered, /href="\/admin\/prospects"[^>]*aria-current="page"/);
    assert.match(rendered, /href="\/admin\/prospects"[^>]*>Back to Prospects<\/a>/);
    assert.match(rendered, /href="\/admin\/tools"/);
    assert(!rendered.includes('>MARKETS<')); assert(!rendered.includes('>LIVE UNITS<'));
    assert.equal(rendered.includes('aria-label="Markets section"'), route !== '/admin/live-units');
  }
});
test('members retain prospect navigation without legacy primary pills or admin-only return links', () => {
  for (const route of ['/dashboard/targets', '/admin/markets']) {
    pathname = route;
    const rendered = html(AppSwitchNav, { sessionUser: { role: 'member' } });
    assert.match(rendered, /href="\/dashboard\/targets"/);
    assert(!rendered.includes('>MARKETS<')); assert(!rendered.includes('>LIVE UNITS<'));
    assert(!rendered.includes('href="/admin/prospects"')); assert(!rendered.includes('href="/admin/tools"'));
    assert.equal(rendered.includes('Back to Prospects'), route === '/admin/markets');
  }
});
test('Admin tools retains clearly labeled legacy routes without replacing current intake', () => {
  const rendered = html(load('src/app/admin/tools/page.tsx').default);
  assert.match(rendered, /Legacy Markets/); assert.match(rendered, /Legacy Live Units/);
  assert.match(rendered, /separate datasets/); assert.match(rendered, /sample-derived signals/);
  for (const route of ['/admin/markets', '/admin/live-units']) {
    assert(rendered.includes(`href="${route}"`));
    assert(fs.existsSync(path.join(root, 'src/app', route, 'page.tsx')));
  }
});
test('login defaults enter Prospects while explicit legacy URLs remain valid', () => {
  const sanitize = load('src/app/auth/login/page.tsx').testSanitizeNextPath;
  for (const value of [undefined, '', 'https://example.invalid', '//example.invalid', '/auth/login', '/auth/login?next=/admin/markets']) assert.equal(sanitize(value), '/dashboard/targets');
  for (const value of ['/admin/markets?category=Nail', '/admin/markets/member/example', '/admin/live-units', '/admin/sources/import?source=URL']) assert.equal(sanitize(value), value);
});
test('denied admin access returns members to Prospects while direct authorized legacy routes remain', async () => {
  const middleware = load('src/middleware.ts').middleware;
  user = { role: 'member' };
  const denied = await middleware(new NextRequest('https://synthetic.invalid/admin/tools?private=value'));
  assert.equal(denied.headers.get('location'), 'https://synthetic.invalid/dashboard/targets');
  assert.equal((await middleware(new NextRequest('https://synthetic.invalid/admin/markets?category=Nail'))).headers.get('x-middleware-next'), '1');
  assert.equal((await middleware(new NextRequest('https://synthetic.invalid/api/admin/live-units/dataset'))).status, 403);
  user = { role: 'admin' };
  for (const route of ['/admin/markets', '/admin/live-units']) assert.equal((await middleware(new NextRequest(`https://synthetic.invalid${route}`))).headers.get('x-middleware-next'), '1');
  user = { role: 'external' };
  assert.equal((await middleware(new NextRequest('https://synthetic.invalid/admin/tools'))).headers.get('location'), 'https://synthetic.invalid/');
  user = null;
  const login = new URL((await middleware(new NextRequest('https://synthetic.invalid/admin/markets'))).headers.get('location'));
  assert.equal(login.pathname, '/auth/login'); assert.equal(login.searchParams.get('next'), '/admin/markets');
  user = { role: 'admin' };
});
test('runtime counts name their units without claiming campaigns or outreach eligibility', async () => {
  const rendered = renderToStaticMarkup(await load('src/app/admin/tools/overview/page.tsx').default());
  for (const label of ['Intake submissions', 'Pending review tasks', 'Approved providers', 'Outreach queue rows']) assert(rendered.includes(label));
  for (const label of ['New Inputs', 'Ready Targets', 'Active Outreach', 'operators pending']) assert(!rendered.includes(label));
  assert.match(rendered, /multiple review tasks/); assert.match(rendered, /Approval does not establish outreach eligibility/);
});
test('Sources destinations are real routes and avoid retired redirect-only surfaces', async () => {
  const rendered = html(load('src/app/admin/sources/page.tsx').default);
  const destinations = [...rendered.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  const redirects = await load('next.config.ts').default.redirects();
  for (const destination of destinations) {
    assert(fs.existsSync(path.join(root, 'src/app', destination, 'page.tsx')), `Missing route ${destination}`);
    for (const rule of redirects) {
      const wildcard = rule.source.indexOf('/:');
      assert(!(rule.source === destination || wildcard >= 0 && destination.startsWith(rule.source.slice(0, wildcard) + '/')), `${destination} redirects away from its labeled feature`);
    }
  }
  assert(destinations.includes('/admin/sources/import'));
  assert(destinations.includes('/admin/sources/history'));
  assert(!destinations.some((destination) => destination.startsWith('/admin/source-intake') || destination.startsWith('/admin/operators')));
});
test('read-only intake history links to scoped review with accurate parsed-row counts', async () => {
  const rendered = renderToStaticMarkup(await load('src/app/admin/sources/history/page.tsx').default());
  assert.match(rendered, /Synthetic import/);
  assert.match(rendered, /href="\/admin\/validate\?intakeId=intake%2Fa"/);
  assert.match(rendered, /not unique prospects/);
  assert.match(rendered, /1 matched · 2 new · 1 held/);
  assert(!rendered.includes('<button'));
});
test('history failure stays distinct from a zero-count or empty result', async () => {
  intakeFailure = true;
  const rendered = renderToStaticMarkup(await load('src/app/admin/sources/history/page.tsx').default());
  assert.match(rendered, /role="alert"/); assert.match(rendered, /unavailable/);
  assert(!rendered.includes('0 intake submissions')); assert(!rendered.includes('No source submissions yet'));
  intakeFailure = false;
});
(async () => {
  for (const { name, run } of tests) { await run(); console.log(`PASS ${name}`); }
  console.log(`${tests.length} workspace-navigation regressions passed`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
