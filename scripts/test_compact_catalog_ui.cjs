/** Synthetic UI regressions only. Never opens a real account or writes catalog fixtures. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const compiled = new Map();
const forbidden = () => { throw new Error('Live requests are forbidden in UI tests.'); };
function loader(overrides = {}, globals = {}) {
  const cache = new Map();
  function load(relative) {
    const file = path.resolve(root, relative);
    assert(file.startsWith(root + path.sep));
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    if (!compiled.has(file)) compiled.set(file, ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText);
    vm.runInNewContext(compiled.get(file), {
      module, exports: module.exports, URL, URLSearchParams, Date, AbortController, setTimeout, clearTimeout, fetch: forbidden,
      console, ...globals,
      require(id) {
        if (Object.hasOwn(overrides, id)) return overrides[id];
        if (['react', 'react/jsx-runtime', 'node:crypto'].includes(id)) return require(id);
        if (id === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
        if (id === 'next/navigation') return { useRouter: () => ({ refresh() {} }) };
        if (id.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
        if (id.startsWith('@/') || id.startsWith('.')) {
          const stem = id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : path.resolve(path.dirname(file), id);
          const target = ['.ts', '.tsx', '.js'].map(ext => stem + ext).find(fs.existsSync);
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
const tests = [];
const test = (name, run) => tests.push({ name, run });
const h = React.createElement;
const markup = (Component, props) => renderToStaticMarkup(h(Component, props));
const load = loader();
const compact = load('src/components/admin/pipeline/CompactProfile.tsx');
const { ProfileLinks } = load('src/components/admin/pipeline/ProfileEvidence.tsx');
const { default: DoraEvidence, DoraStatus } = load('src/components/admin/pipeline/DoraEvidence.tsx');
const { default: CatalogResultRow } = load('src/components/catalog/CatalogResultRow.tsx');
const { default: BookingPlatformLinks, CatalogContactLinks } = load('src/components/catalog/BookingPlatformLinks.tsx');
const { default: CatalogWorkspace } = load('src/components/catalog/CatalogWorkspace.tsx');
const unknown = { status: 'unknown', outcome: 'not_checked', matches: [], reasons: [], conflicts: [] };
const candidate = { name: 'Avery Synthetic', licenseType: 'Manicurist', licenseNumber: '999900001', licensePrefix: 'MAN', statusText: 'Active', city: 'Synthetic City', state: 'CO', postalCode: '00000', sourceUrl: 'https://apps2.colorado.gov/dora/licensing/Lookup/LicenseLookup.aspx', datasetUrl: 'https://data.colorado.gov/resource/7s5z-vewr.json', expirationDate: '2027-03-31T00:00:00.000', identity: 'review', basis: ['Full name matches'], conflicts: ['Identity not corroborated'], sourceRows: 1 };
const review = { status: 'review', outcome: 'matched', matches: [candidate], reasons: ['Independent identifier required'], conflicts: [], checkedAt: '2026-10-14T16:00:00.000Z', datasetUpdatedAt: '2026-10-13T04:00:00.000Z' };
const dora = { schemaVersion: 1, personLicense: review, shopRegistration: unknown };
const row = (extra = {}) => ({ id: 'provider:adminPipelineParsedCandidates:synthetic', entityType: 'provider', displayName: 'Avery Synthetic', providerName: 'Avery Synthetic', businessName: '', platformLabel: '', city: '', state: '', postalCode: '', area: '', services: [], reviewStatus: 'pending', sourceRefs: [], linkedEntities: [], reviewDecisions: [], conflicts: [], evidence: [], legacyIds: [], updatedAt: '', ...extra });
const link = (url, extra = {}) => ({ url, sourceUrl: url, kind: 'profile', platform: 'unknown', attribution: 'candidate', basis: 'submitted', ...extra });
const profile = (extra = {}) => ({ status: 'not_checked', platform: 'unknown', knownPlatforms: [], platformSummary: 'unknown', bookingLinks: [], socialLinks: [], websiteLinks: [], reasons: [], observations: [], fieldEvidence: [], ...extra });

test('missing text is compact and never a negative finding', () => {
  for (const value of [undefined, '', '  ', 'Unknown', 'not collected', 'Not recorded', 'Unkwn']) assert.equal(compact.compactText(value), 'Unkwn');
  assert.equal(compact.compactText('Avery Synthetic'), 'Avery Synthetic');
  for (const status of ['pending', 'queued', 'conflict', undefined]) assert(!/[✓✕]/.test(compact.compactReviewStatus(status).label));
  assert.equal(compact.compactReviewStatus('approved').label, '✓');
  assert.equal(compact.compactReviewStatus('rejected').label, '✕');
  assert.match(compact.compactReviewStatus('rejected').description, /does not mean unlicensed/i);
});
test('compact unknown catalog row has no verbose filler or duplicate person name', () => {
  const html = markup(CatalogResultRow, { row: row(), selected: false, onToggle() {}, onOpen() {} });
  assert.equal((html.match(/<td/g) || []).length, 6);
  assert.equal((html.match(/<button/g) || []).length, 1);
  assert.equal((html.match(/role="img"/g) || []).length, 1);
  assert.equal((html.match(/>Avery Synthetic</g) || []).length, 1);
  assert(!/>[^<]*(not collected|not recorded|Provider record|No supported booking)/i.test(html));
  assert(!/[✓✕]/.test(html));
  assert.match(html, /Unkwn/);
  assert.match(html, /class="nameCell"/); assert.match(html, /class="centerCell"/);
});
test('business rows retain the business name without fabricating an individual provider', () => {
  const html = markup(CatalogResultRow, { row: row({ entityType: 'business', displayName: 'Synthetic Studio', providerName: '', businessName: 'Synthetic Studio' }), selected: false, onToggle() {}, onOpen() {} });
  assert.match(html, /Open business \/ location record: Synthetic Studio/);
  assert.match(html, /Shop registration: Unresolved/);
  assert(!html.includes('Person license:'));
  assert(!html.includes('>—<'));
  assert.equal((html.match(/>Synthetic Studio</g) || []).length, 1);
});
test('short Booking and IG labels keep exact safe destinations and attribution', () => {
  const booking = 'https://syntheticstudio.glossgenius.com/services';
  const html = markup(ProfileLinks, { compact: true, kind: 'booking', links: [link(booking)] });
  assert.match(html, />Booking</); assert(html.includes(`href="${booking}"`)); assert.match(html, /noopener noreferrer/);
  const social = markup(ProfileLinks, { compact: true, kind: 'social', links: [link('https://www.instagram.com/synthetic_artist/', { attribution: 'unresolved', kind: 'social' })] });
  assert.match(social, />IG\?</); assert.match(social, /Attribution unresolved/);
  const unsafe = markup(ProfileLinks, { compact: true, links: [link('javascript:alert(1)'), link('https://user:password@example.org')] });
  assert(!unsafe.includes('<a')); assert.match(unsafe, /Unkwn/);
});
test('more links remain in expandable detailed profile evidence', () => {
  const links = [1, 2, 3].map(n => link(`https://example.org/profile${n}`));
  const summary = markup(ProfileLinks, { links, compact: true });
  assert.equal((summary.match(/<a /g) || []).length, 2); assert.match(summary, /\+1/);
  const detail = markup(ProfileLinks, { links });
  for (const entry of links) assert(detail.includes(entry.url));
});
test('prospect headers contain only the compact identity, links, location and license columns', () => {
  const html = markup(CatalogWorkspace, {});
  const header = html.match(/<thead>([\s\S]*?)<\/thead>/)[1];
  assert.equal((header.match(/<th(?: |>)/g) || []).length, 6);
  for (const label of ['Provider / salon', 'Booking platform', 'IG / website', 'City / State / ZIP', 'License']) assert(header.includes(label), label);
  for (const label of ['Services', 'Area', 'Review', 'Person lic.', 'Shop reg.', 'Record details']) assert(!header.includes(label), label);
});
test('combined identity shows a different business only once and all name clicks open the record', () => {
  let opened = 0, toggled = 0;
  const props = { row: row({ businessName: 'Synthetic Studio', city: 'Synthetic City', state: 'CO', postalCode: '00000' }), selected: true, onToggle: () => toggled++, onOpen: () => opened++ };
  const html = markup(CatalogResultRow, props);
  assert.equal((html.match(/>Avery Synthetic</g) || []).length, 1);
  assert.equal((html.match(/>Synthetic Studio</g) || []).length, 1);
  assert.match(html, />Synthetic City, CO 00000</);
  const tree = CatalogResultRow(props);
  const nameButton = elements(tree, node => node.type === 'button')[0];
  assert.equal(elements(nameButton, node => node.type === 'span').length, 2);
  assert.match(textOf(nameButton), /Avery Synthetic.*Synthetic Studio/);
  assert.equal(nameButton.props['aria-label'], 'Open provider record: Avery Synthetic, Synthetic Studio');
  nameButton.props.onClick();
  elements(tree, node => node.type === 'input')[0].props.onChange();
  assert.equal(opened, 1); assert.equal(toggled, 1);
  assert.equal(tree.props['data-selected'], true);
  const duplicate = markup(CatalogResultRow, { ...props, row: row({ businessName: '  avery synthetic  ' }) });
  assert.equal((duplicate.match(/>Avery Synthetic</g) || []).length, 1);
  assert(!duplicate.includes('>avery synthetic<'));
});
test('each row uses exactly the entity-scoped DORA check without leaking the other scope', () => {
  const props = { row: row({ dora }), selected: false, onToggle() {}, onOpen() {} };
  const person = elements(CatalogResultRow(props), node => node.type?.name === 'DoraLicenseMark');
  assert.equal(person.length, 1); assert.equal(person[0].props.check, review); assert.equal(person[0].props.label, 'Person license');
  const shop = elements(CatalogResultRow({ ...props, row: row({ entityType: 'business', dora }) }), node => node.type?.name === 'DoraLicenseMark');
  assert.equal(shop.length, 1); assert.equal(shop[0].props.check, unknown); assert.equal(shop[0].props.label, 'Shop registration');
});
test('booking platform names are the exact source links and preserve all platforms and attribution', () => {
  const links = [
    link('https://syntheticstudio.glossgenius.com/services?staff=One#book', { platform: 'glossgenius', sourceUrl: 'https://source.example.org/card/1' }),
    link('https://www.vagaro.com/syntheticstudio?staff=Two', { platform: 'vagaro', attribution: 'business' }),
    link('https://booksy.com/en-us/999999_synthetic', { platform: 'booksy', attribution: 'unresolved' }),
  ];
  const html = markup(BookingPlatformLinks, { profile: profile({ bookingLinks: links, knownPlatforms: ['glossgenius', 'vagaro'] }) });
  assert.equal((html.match(/<a /g) || []).length, 3);
  for (const entry of links) assert(html.includes(`href="${entry.url}"`));
  for (const label of ['>GG<', '>Vagaro<', '>Booksy?<']) assert(html.includes(label));
  assert.match(html, /Source: https:\/\/source.example.org\/card\/1/);
  assert.match(html, /Source-linked to provider; identity not verified/);
  assert.match(html, /Shared business link; not individual verification/);
  assert.match(html, /Attribution unresolved; review evidence/);
  assert.equal((html.match(/rel="noopener noreferrer"/g) || []).length, 3);
  assert(!html.includes('>Booking<'));
});
test('duplicate URLs and same-platform links collapse to one evidence-backed preferred link', () => {
  const shared = link('https://syntheticstudio.glossgenius.com/services', { platform: 'glossgenius', kind: 'shared_business', attribution: 'business' });
  const individual = link('https://syntheticstudio.glossgenius.com/staff/synthetic', { platform: 'glossgenius', kind: 'individual', attribution: 'candidate' });
  const uncertain = link('https://syntheticstudio.glossgenius.com/other', { platform: 'glossgenius', attribution: 'unresolved' });
  const links = [shared, { ...shared }, uncertain, individual, { ...individual }];
  const original = JSON.stringify(links);
  const html = markup(BookingPlatformLinks, { profile: profile({ bookingLinks: links }) });
  assert.equal((html.match(/<a /g) || []).length, 1); assert.equal((html.match(/>GG</g) || []).length, 1);
  assert(html.includes(`href="${individual.url}"`)); assert(!html.includes(`href="${shared.url}"`));
  assert.match(html, />\+2</); assert.match(html, /2 more booking source links in Evidence &amp; review/);
  assert.equal(JSON.stringify(links), original, 'compact display cannot mutate source evidence');
  const evidence = markup(ProfileLinks, { links });
  for (const entry of links) assert(evidence.includes(`href="${entry.url}"`));
  const businessOnly = markup(BookingPlatformLinks, { profile: profile({ bookingLinks: [uncertain, shared] }) });
  assert(businessOnly.includes(`href="${shared.url}"`)); assert.match(businessOnly, /Shared business link; not individual verification/); assert.match(businessOnly, />\+1</);
  const exactDuplicates = markup(BookingPlatformLinks, { profile: profile({ bookingLinks: [shared, { ...shared }] }) });
  assert.equal((exactDuplicates.match(/<a /g) || []).length, 1); assert(!exactDuplicates.includes('>+'));
});
test('unsafe, directory-only and unlinked booking platforms cannot invent a booking destination', () => {
  const html = markup(BookingPlatformLinks, { profile: profile({ knownPlatforms: ['glossgenius'], bookingLinks: [link('javascript:alert(1)'), link('https://user:secret@example.org'), link('https://www.vagaro.com/professionals/synthetic', { kind: 'directory' })] }) });
  assert(!html.includes('<a ')); assert(html.includes('>GG<')); assert.match(html, /booking link unavailable/);
  assert(!html.includes('javascript:')); assert(!html.includes('secret'));
  const recognized = markup(BookingPlatformLinks, { profile: profile({ bookingLinks: [link('https://syntheticstudio.glossgenius.com/services')] }) });
  assert.match(recognized, />GG</);
  const misleading = markup(BookingPlatformLinks, { profile: profile({ bookingLinks: [link('https://glossgenius.com.evil.example.org/path')] }) });
  assert.match(misleading, />Booking</); assert(!misleading.includes('>GG<'));
  const custom = markup(BookingPlatformLinks, { profile: profile({ bookingLinks: [link('https://studio.example.org/book', { purpose: 'booking' })] }) });
  assert.match(custom, /href="https:\/\/studio.example.org\/book"/); assert.match(custom, />Booking</);
});
test('IG and website share one cell with their exact source destinations', () => {
  const html = markup(CatalogResultRow, { row: row({ profile: profile({ socialLinks: [link('https://www.instagram.com/synthetic_artist/', { kind: 'social' })], websiteLinks: [link('https://studio.example.org/about', { kind: 'website' })] }) }), selected: false, onToggle() {}, onOpen() {} });
  assert.equal((html.match(/<td/g) || []).length, 6);
  const cells = [...html.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(match => match[1]);
  assert.match(cells[3], />IG</); assert.match(cells[3], />Web</);
  assert(cells[3].includes('href="https://www.instagram.com/synthetic_artist/"'));
  assert(cells[3].includes('href="https://studio.example.org/about"'));
});
test('contact quick links deduplicate safe URLs and omit Web duplicates of booking or social', () => {
  const booking = link('https://syntheticstudio.glossgenius.com/services', { platform: 'glossgenius' });
  const instagram = link('https://www.instagram.com/synthetic_artist/', { kind: 'social', attribution: 'unresolved' });
  const facebook = link('https://www.facebook.com/syntheticstudio', { kind: 'social', attribution: 'business' });
  const website = link('https://studio.example.org/about', { kind: 'website' });
  const value = profile({ bookingLinks: [booking], socialLinks: [instagram, { ...instagram }, facebook, link('javascript:alert(1)', { kind: 'social' })], websiteLinks: [{ ...booking, kind: 'website' }, { ...instagram, kind: 'website' }, website, { ...website }, link('https://user:secret@example.org', { kind: 'website' })] });
  const original = JSON.stringify(value);
  const html = markup(CatalogContactLinks, { profile: value });
  assert.equal((html.match(/<a /g) || []).length, 3);
  assert.equal((html.match(/>IG\?</g) || []).length, 1); assert.equal((html.match(/>FB</g) || []).length, 1); assert.equal((html.match(/>Web</g) || []).length, 1);
  assert(!html.includes(`href="${booking.url}"`));
  for (const entry of [instagram, facebook, website]) assert(html.includes(`href="${entry.url}"`));
  assert.match(html, /Attribution unresolved/); assert.match(html, /Shared business link/);
  assert(!html.includes('javascript:')); assert(!html.includes('secret')); assert(!html.includes('>+'));
  assert.equal(JSON.stringify(value), original);
  const evidence = markup(ProfileLinks, { links: value.websiteLinks });
  assert(evidence.includes(`href="${booking.url}"`)); assert(evidence.includes(`href="${instagram.url}"`));
  assert.equal(markup(CatalogContactLinks, { profile: profile(), hideEmpty: true }), '');
  const empty = markup(CatalogContactLinks, { profile: profile({ websiteLinks: [link('javascript:alert(1)')] }) });
  assert(!empty.includes('<a ')); assert.match(empty, />Unkwn</);
});
test('DORA statuses distinguish review, expiration and no match from a negative finding', () => {
  for (const status of ['unknown', 'review', 'expired', 'active']) {
    const html = markup(DoraStatus, { check: { ...unknown, status }, label: 'Person license' });
    assert(!/[✓✕]/.test(html));
    assert.match(html, new RegExp(status === 'unknown' ? '>Unkwn<' : `>${status[0].toUpperCase() + status.slice(1)}<`));
  }
});
test('Review details expose actual candidate official facts, provenance and freshness', () => {
  const html = markup(DoraEvidence, { dora, catalogId: row().id });
  for (const value of ['Avery Synthetic', 'Manicurist', '999900001', 'Active', 'Synthetic City', '00000', candidate.sourceUrl, candidate.datasetUrl, candidate.expirationDate, review.checkedAt, review.datasetUpdatedAt]) assert(html.includes(value), `Missing candidate detail ${value}`);
  assert.match(html, /Possible match\. Identity needs review/); assert.match(html, /updated nightly/);
  assert.match(html, /<details/); assert.match(html, /Match evidence/); assert(!html.includes('Check DORA'));
});
test('only an admin with a catalog ID gets Check DORA controls', () => {
  assert(markup(DoraEvidence, { dora, catalogId: row().id, admin: true }).includes('Check DORA'));
  assert(!markup(DoraEvidence, { dora, admin: true }).includes('Check DORA'));
  assert(!markup(DoraEvidence, { dora, catalogId: row().id, admin: false }).includes('Check DORA'));
});
test('no-match and unsuccessful checks keep unknown plus separate attempt time', () => {
  const html = markup(DoraEvidence, { dora: { schemaVersion: 1, personLicense: { ...unknown, outcome: 'no_match' }, shopRegistration: { ...unknown, outcome: 'error', attemptedAt: '2026-10-14T16:02:00.000Z' } } });
  assert.match(html, /No matching record found\. Licensing remains unknown/);
  assert.match(html, /Last attempt:/); assert.match(html, /Checked: Unkwn/); assert(!/[✓✕]/.test(html));
});

// Minimal deterministic hook harness: runs component event handlers and effect cleanup,
// rather than assuming SSR alone tests request cancellation or repeated interactions.
function harness(file, initialProps, globals = {}, overrides = {}) {
  const slots = []; let cursor = 0, effects = [], props = initialProps, tree;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const hooks = { ...React,
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, next => { slots[i].value = typeof next === 'function' ? next(slots[i].value) : next; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) { const previous = slots[i]; effects.push(() => { previous?.cleanup?.(); const cleanup = fn(); slots[i] = { deps, cleanup }; }); } },
    useMemo(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { deps, value: fn() }; return slots[i].value; },
    useCallback(fn, deps) { return hooks.useMemo(() => fn, deps); },
  };
  const Component = loader({ react: hooks, ...overrides }, globals)(file).default;
  function render(nextProps = props) { props = nextProps; cursor = 0; effects = []; tree = Component(props); for (const effect of effects) effect(); return tree; }
  render();
  return { render, get tree() { return tree; }, unmount() { for (const slot of slots) slot?.cleanup?.(); } };
}
function elements(node, predicate, result = []) {
  if (Array.isArray(node)) { for (const child of node) elements(child, predicate, result); return result; }
  if (!node || typeof node !== 'object') return result;
  if (predicate(node)) result.push(node);
  elements(node.props?.children, predicate, result); return result;
}
const textOf = node => Array.isArray(node) ? node.map(textOf).join('') : !node ? '' : typeof node === 'object' ? textOf(node.props?.children) : String(node);
const button = (tree, label) => elements(tree, node => node.type === 'button' && textOf(node).includes(label))[0];
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const settle = async () => { for (let n = 0; n < 12; n++) await Promise.resolve(); };
const success = (id, value = dora) => ({ ok: true, json: async () => ({ ok: true, results: [{ catalogId: id, dora: value }] }) });
const doraFile = 'src/components/admin/pipeline/DoraEvidence.tsx';

test('repeated Check DORA clicks send one bounded same-origin request and refresh once', async () => {
  const gate = deferred(), calls = []; let refreshed = 0;
  const instance = harness(doraFile, { catalogId: row().id, dora, admin: true, onUpdated: () => refreshed++ }, { fetch: (url, init) => { calls.push({ url, init }); return gate.promise; } });
  const action = button(instance.tree, 'Check DORA'); action.props.onClick(); action.props.onClick();
  assert.equal(calls.length, 1); assert.equal(calls[0].url, '/api/catalog/dora/refresh');
  assert.equal(calls[0].init.credentials, 'same-origin'); assert.deepEqual(JSON.parse(calls[0].init.body), { catalogIds: [row().id] });
  assert.equal(button(instance.render(), 'Checking').props.disabled, true);
  gate.resolve(success(row().id)); await settle(); instance.render();
  assert.equal(refreshed, 1); assert.equal(button(instance.tree, 'Check DORA').props.disabled, false); instance.unmount();
});
test('failed DORA check leaves previous evidence visible and can retry', async () => {
  let calls = 0;
  const instance = harness(doraFile, { catalogId: row().id, dora, admin: true }, { fetch: async () => { calls++; return calls === 1 ? { ok: false, json: async () => ({ error: 'temporarily_unavailable' }) } : success(row().id); } });
  button(instance.tree, 'Check DORA').props.onClick(); await settle(); instance.render();
  assert.match(textOf(instance.tree), /Previous results remain visible/); assert.equal(elements(instance.tree, n => n.props?.check === review).length, 1);
  button(instance.tree, 'Check DORA').props.onClick(); await settle(); instance.render(); assert.equal(calls, 2); assert(!textOf(instance.tree).includes('Previous results remain visible')); instance.unmount();
});
test('closing a DORA panel aborts its request and ignores a late response', async () => {
  const gate = deferred(); let signal, refreshed = 0;
  const instance = harness(doraFile, { catalogId: row().id, dora, admin: true, onUpdated: () => refreshed++ }, { fetch: (_, init) => { signal = init.signal; return gate.promise; } });
  button(instance.tree, 'Check DORA').props.onClick(); instance.unmount(); assert.equal(signal.aborted, true);
  gate.resolve(success(row().id)); await settle(); assert.equal(refreshed, 0);
});
test('newer DORA navigation releases busy state and rejects older evidence', async () => {
  const gates = [deferred(), deferred()], signals = []; let calls = 0, refreshed = 0;
  const firstProps = { catalogId: row().id, dora, admin: true, onUpdated: () => refreshed++ };
  const instance = harness(doraFile, firstProps, { fetch: (_, init) => { signals.push(init.signal); return gates[calls++].promise; } });
  button(instance.tree, 'Check DORA').props.onClick();
  const newerId = 'provider:adminPipelineParsedCandidates:new-synthetic';
  instance.render({ ...firstProps, catalogId: newerId, dora: { schemaVersion: 1, personLicense: unknown, shopRegistration: unknown } });
  assert.equal(signals[0].aborted, true); assert.equal(button(instance.tree, 'Check DORA').props.disabled, false);
  button(instance.tree, 'Check DORA').props.onClick(); gates[0].resolve(success(row().id)); await settle();
  assert.equal(refreshed, 0); assert.equal(button(instance.render(), 'Checking').props.disabled, true);
  const newerDora = { schemaVersion: 1, personLicense: unknown, shopRegistration: { ...unknown, status: 'review' } };
  gates[1].resolve(success(newerId, newerDora)); await settle(); instance.render();
  assert.equal(refreshed, 1); assert.equal(elements(instance.tree, n => n.props?.check === review).length, 0); instance.unmount();
});
test('catalog details close, Escape and backdrop controls preserve inside clicks and abort reads', async () => {
  const gate = deferred(); let signal, closes = 0;
  const instance = harness('src/components/catalog/CatalogDetail.tsx', { record: row(), onClose: () => closes++ }, { fetch: (_, init) => { signal = init.signal; return gate.promise; } });
  const dialog = instance.tree;
  button(dialog, 'Close').props.onClick(); assert.equal(closes, 1);
  dialog.props.onCancel(); assert.equal(closes, 2);
  const surface = {}; dialog.props.onClick({ target: surface, currentTarget: surface }); assert.equal(closes, 3);
  dialog.props.onClick({ target: {}, currentTarget: surface }); assert.equal(closes, 3);
  instance.unmount(); assert.equal(signal.aborted, true);
  gate.resolve({ ok: true, json: async () => ({ record: row({ displayName: 'Late synthetic response' }) }) }); await settle();
  assert(!textOf(instance.render()).includes('Late synthetic response'));
});
test('newer catalog reload wins when an older request resolves late', async () => {
  const calls = [];
  const instance = harness('src/components/catalog/CatalogWorkspace.tsx', {}, { fetch: (url, init) => { const gate = deferred(); calls.push({ url, init, gate }); return gate.promise; } });
  assert.equal(calls.length, 2);
  button(instance.tree, 'Loading').props.onClick(); assert.equal(calls.length, 4);
  const latest = row({ displayName: 'Latest synthetic record', providerName: 'Latest synthetic record' });
  calls[2].gate.resolve({ ok: true, json: async () => ({ rows: [latest] }) }); calls[3].gate.resolve({ ok: true, json: async () => ({ lists: [] }) });
  await settle(); instance.render();
  assert.equal(elements(instance.tree, n => n.props?.row?.displayName === latest.displayName).length, 1);
  calls[0].gate.resolve({ ok: true, json: async () => ({ rows: [row({ displayName: 'Stale synthetic record' })] }) }); calls[1].gate.resolve({ ok: true, json: async () => ({ lists: [] }) });
  await settle(); instance.render();
  assert.equal(elements(instance.tree, n => n.props?.row?.displayName === latest.displayName).length, 1);
  assert.equal(elements(instance.tree, n => n.props?.row?.displayName === 'Stale synthetic record').length, 0); instance.unmount();
});
test('every legacy URL sort remains valid after removing its table column', async () => {
  const records = [
    row({ id: 'synthetic-z', displayName: 'Zulu Synthetic', providerName: 'Zulu Synthetic', businessName: 'Alpha Studio', services: ['Zulu service'], area: 'Alpha area', postalCode: '20000', reviewStatus: 'pending' }),
    row({ id: 'synthetic-a', displayName: 'Alpha Synthetic', providerName: 'Alpha Synthetic', businessName: 'Zulu Studio', services: ['Alpha service'], area: 'Zulu area', postalCode: '10000', reviewStatus: 'approved' }),
  ];
  const { sortCatalogRecords } = load('src/lib/catalog/query.ts');
  for (const sort of ['name', 'platform', 'booking', 'social', 'provider', 'salon', 'service', 'area', 'city', 'postalCode', 'status']) {
    let url = new URL(`https://synthetic.invalid/dashboard/targets?sort=${sort}&direction=desc&external=keep`);
    const window = { location: { get href() { return url.href; } }, history: { state: { router: 'retained' }, replaceState(state, _, next) { assert.equal(state.router, 'retained'); url = new URL(String(next)); } }, addEventListener() {}, removeEventListener() {} };
    const instance = harness('src/components/catalog/CatalogWorkspace.tsx', {}, { window, fetch: async url => ({ ok: true, json: async () => url === '/api/catalog' ? { rows: records } : { lists: [] } }) });
    await settle(); instance.render();
    const actual = elements(instance.tree, node => node.props?.row?.id).map(node => node.props.row.id);
    assert.deepEqual(actual, Array.from(sortCatalogRecords(records, sort, 'desc'), record => record.id), sort);
    assert.equal(url.searchParams.get('sort'), sort); assert.equal(url.searchParams.get('direction'), 'desc'); assert.equal(url.searchParams.get('external'), 'keep');
    instance.unmount();
  }
});
test('combined name sorting follows the displayed business or provider name', async () => {
  const records = [row({ id: 'synthetic-business', entityType: 'business', displayName: 'Alpha stale label', businessName: 'Zulu Studio' }), row({ id: 'synthetic-provider', displayName: 'Zulu stale label', providerName: 'Alpha Artist' })];
  let url = new URL('https://synthetic.invalid/dashboard/targets?sort=name&direction=asc');
  const window = { location: { get href() { return url.href; } }, history: { state: null, replaceState(_, __, next) { url = new URL(String(next)); } }, addEventListener() {}, removeEventListener() {} };
  const instance = harness('src/components/catalog/CatalogWorkspace.tsx', {}, { window, fetch: async url => ({ ok: true, json: async () => url === '/api/catalog' ? { rows: records } : { lists: [] } }) });
  await settle(); instance.render();
  assert.deepEqual(elements(instance.tree, node => node.props?.row?.id).map(node => node.props.row.id), ['synthetic-provider', 'synthetic-business']);
  button(instance.tree, 'Provider / salon').props.onClick(); instance.render();
  assert.deepEqual(elements(instance.tree, node => node.props?.row?.id).map(node => node.props.row.id), ['synthetic-business', 'synthetic-provider']);
  instance.unmount();
});
test('profile add-to-list returns to the existing selected-list controls without a mutation', async () => {
  const calls = [], frames = []; let focused = 0, scrolled = 0;
  const globals = {
    fetch: async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => url === '/api/catalog' ? { rows: [row()] } : { lists: [] } }; },
    requestAnimationFrame: callback => frames.push(callback),
    document: { getElementById(id) { assert.equal(id, 'catalog-selection-actions'); return { focus(options) { assert.equal(options.preventScroll, true); focused++; }, scrollIntoView(options) { assert.equal(options.block, 'center'); scrolled++; } }; } },
  };
  const instance = harness('src/components/catalog/CatalogWorkspace.tsx', {}, globals);
  await settle(); instance.render();
  elements(instance.tree, node => node.props?.row?.id)[0].props.onOpen(); instance.render();
  const detail = elements(instance.tree, node => node.type?.name === 'CatalogDetail')[0];
  assert(detail); detail.props.onSelectForList(); detail.props.onSelectForList(); instance.render();
  assert.equal(elements(instance.tree, node => node.type?.name === 'CatalogDetail').length, 0);
  assert.equal(elements(instance.tree, node => node.props?.row?.id)[0].props.selected, true);
  const selection = elements(instance.tree, node => node.props?.id === 'catalog-selection-actions')[0];
  assert.equal(selection.props.tabIndex, -1); assert.match(textOf(selection), /1 selected/);
  for (const callback of frames) callback();
  assert.equal(focused, 2); assert.equal(scrolled, 2);
  assert.equal(calls.length, 2); assert(calls.every(call => !call.init?.method || call.init.method === 'GET'));
  instance.unmount();
});
test('long synthetic table values retain complete titles with bounded single-line presentation', () => {
  const long = 'Synthetic long value '.repeat(25).trim();
  const html = markup(CatalogResultRow, { row: row({ displayName: long, providerName: long, businessName: long, area: long, services: [long] }), selected: false, onToggle() {}, onOpen() {} });
  assert(html.includes(`title="Open provider record: ${long}"`));
  assert(!html.includes('>Unkwn</button>'));
  const css = fs.readFileSync(path.join(root, 'src/components/catalog/CatalogWorkspace.module.css'), 'utf8');
  assert.match(css, /\.table \.nameCell > button \{[^}]*max-width: 100%[^}]*text-overflow: ellipsis[^}]*white-space: nowrap/);
  assert.match(css, /\.table \.wrapCell > span \{[^}]*max-width: 144px[^}]*text-overflow: ellipsis[^}]*white-space: nowrap/);
});
test('compact layout fills available width with tight padding, scroll and name/status alignment', () => {
  const css = fs.readFileSync(path.join(root, 'src/components/catalog/CatalogWorkspace.module.css'), 'utf8');
  assert.match(css, /\.table \{[^}]*width: 100%[^}]*min-width: 640px[^}]*table-layout: fixed/); assert.match(css, /\.table td \{[^}]*padding: 7px 8px/);
  assert.match(css, /\.tableScroll \{[^}]*overflow-x: auto/); assert.match(css, /\.table \.centerCell[^}]*text-align: center/);
  const page = fs.readFileSync(path.join(root, 'src/app/admin/validate/page.tsx'), 'utf8');
  assert.match(page, /w-max min-w-full table-auto/); assert.match(page, /aria-sort=/); assert.match(page, /validationSortHref\(params, column\)/);
});

test('fluid table uses six proportional columns with narrow selection and license edges', () => {
  const html = markup(CatalogWorkspace, {});
  const group = html.match(/<colgroup>([\s\S]*?)<\/colgroup>/)[1];
  const expected = ['selectionColumn', 'nameColumn', 'platformColumn', 'contactColumn', 'locationColumn', 'licenseColumn'];
  assert.deepEqual([...group.matchAll(/class="([^"]+)"/g)].map(match => match[1]), expected);
  assert(html.indexOf('</caption>') < html.indexOf('<colgroup>'), 'Caption precedes the native table columns.');
  const css = fs.readFileSync(path.join(root, 'src/components/catalog/CatalogWorkspace.module.css'), 'utf8');
  assert.match(css, /\.tableScroll \{[^}]*width: 100%[^}]*max-width: 100%[^}]*min-width: 0/);
  assert.match(css, /\.table \.selectionColumn \{ width: 40px;/);
  assert.match(css, /\.table \.licenseColumn \{ width: 64px;/);
  const shares = [34, 18, 14];
  expected.slice(1, 4).forEach((column, i) => assert(css.includes(`.${column} { width: ${shares[i]}%; }`)));
  assert.match(css, /\.table \.locationColumn \{ width: auto;/);
  assert(!/Column \{ width: calc\(/.test(css), 'Fixed native table columns must not rely on unsupported mixed calc widths.');
  // Layout-policy arithmetic, not a claim that browser pixels were inspected.
  for (const viewport of [1920, 1366, 1024, 768, 390, 320]) {
    const available = viewport - 48 - 2, table = Math.max(640, available);
    const widths = shares.map(share => table * share / 100);
    widths.push(table - 104 - widths.reduce((sum, width) => sum + width, 0));
    assert(Math.abs(widths.reduce((sum, width) => sum + width, 104) - table) < 0.001);
    assert(widths[0] >= 200 && widths[1] >= 115 && widths[2] >= 85 && widths[3] >= 113);
    assert.equal(table > available, viewport < 690);
  }
});
test('small-screen controls wrap while table overflow stays in its labeled region', () => {
  const html = markup(CatalogWorkspace, {});
  assert.match(html, /tabindex="0" role="region" aria-label="Scrollable catalog results"/);
  const css = fs.readFileSync(path.join(root, 'src/components/catalog/CatalogWorkspace.module.css'), 'utf8');
  assert.match(css, /\.pagination \{ flex-wrap: wrap; \}/);
  assert.match(css, /\.tabs \{ flex-wrap: wrap; gap: 12px; \}/);
  assert.match(css, /\.inlineForm \{ flex-wrap: wrap; \}/);
  assert.match(css, /@media \(max-width: 400px\) \{ \.filterGrid \{ grid-template-columns: 1fr;/);
  assert.match(css, /\.table \.platformCell, \.table \.contactCell, \.table \.locationCell \{ white-space: normal; overflow-wrap: anywhere;/);
  assert(!/\.tableScroll \{[^}]*width: fit-content/.test(css));
  assert(!/\.table \{[^}]*width: max-content/.test(css));
});

async function main() {
  let failures = 0;
  for (const { name, run } of tests) { try { await run(); console.log(`PASS ${name}`); } catch (error) { failures++; console.error(`FAIL ${name}\n${error.stack}`); } }
  console.log(`Compact catalog UI: ${tests.length - failures}/${tests.length} synthetic tests passed.`);
  if (failures) process.exitCode = 1;
  if (process.env.COMPACT_UI_PREVIEW) {
    const target = path.resolve(process.env.COMPACT_UI_PREVIEW); fs.mkdirSync(target, { recursive: true });
    const rich = row({ displayName: 'Blair Synthetic', providerName: 'Blair Synthetic', businessName: 'Synthetic Studio', city: 'Synthetic City', state: 'CO', postalCode: '00000', services: ['Nails'], reviewStatus: 'approved', dora, profile: profile({ knownPlatforms: ['glossgenius'], platformSummary: 'single', platform: 'glossgenius', bookingLinks: [link('https://syntheticstudio.glossgenius.com', { platform: 'glossgenius' })], socialLinks: [link('https://instagram.com/synthetic_artist', { kind: 'social' })] }) });
    const rows = [row(), rich, row({ entityType: 'business', displayName: 'Synthetic Studio', providerName: '', businessName: 'Synthetic Studio' }), row({ displayName: 'Long Synthetic Provider Name For Wrapping', providerName: 'Long Synthetic Provider Name For Wrapping', businessName: 'Synthetic Studio With A Long Business Name', reviewStatus: 'rejected' })];
    const content = `<div class="workspace"><h1>Synthetic compact catalog</h1><p>Render fixture only. No live records or checks.</p><div class="tableScroll"><table class="table"><colgroup><col class="selectionColumn"><col class="nameColumn"><col class="platformColumn"><col class="contactColumn"><col class="locationColumn"><col class="licenseColumn"></colgroup><thead><tr>${['', 'Provider / salon', 'Booking platform', 'IG / website', 'City / State / ZIP', 'License'].map((name, i) => `<th class="${[3, 5].includes(i) ? 'centerCell' : ''}">${name}</th>`).join('')}</tr></thead><tbody>${rows.map(value => markup(CatalogResultRow, { row: value, selected: false, onToggle() {}, onOpen() {} })).join('')}</tbody></table></div><div style="margin-top:24px">${markup(DoraEvidence, { dora, catalogId: rich.id, admin: true })}</div></div>`;
    const candidates = [...new Set([...content.matchAll(/class="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/)))];
    const { compile } = require('@tailwindcss/node');
    const compiler = await compile('@import "tailwindcss";', { base: root, onDependency() {} });
    const css = compiler.build(candidates) + fs.readFileSync(path.join(root, 'src/components/catalog/CatalogWorkspace.module.css'), 'utf8');
    fs.writeFileSync(path.join(target, 'compact-ui.html'), `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\nbody{font-family:Arial,sans-serif;margin:24px;background:#f7f9fc}h1{margin-bottom:8px}.workspace>p{margin-bottom:16px}</style></head><body>${content}</body></html>`);
    console.log(`Synthetic preview written: ${path.join(target, 'compact-ui.html')}`);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
