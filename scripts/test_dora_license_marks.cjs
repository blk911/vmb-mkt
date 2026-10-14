/** Synthetic presentation-only checks. No catalog writes, live requests or real prospects. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const now = Date.parse('2026-10-14T19:00:00.000Z');
class TestDate extends Date { static now() { return now; } }
const cache = new Map();
function load(relative) {
  const file = path.resolve(root, relative);
  assert(file.startsWith(root + path.sep));
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, Date: TestDate, URL, URLSearchParams, AbortController,
    fetch() { throw new Error('Live requests are forbidden in synthetic tests.'); },
    require(id) {
      if (['react', 'react/jsx-runtime'].includes(id)) return require(id);
      if (id.startsWith('@/') || id.startsWith('.')) {
        const stem = id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : path.resolve(path.dirname(file), id);
        const target = ['.ts', '.tsx'].map(ext => stem + ext).find(fs.existsSync);
        assert(target, `Missing import ${id}`);
        return load(path.relative(root, target));
      }
      throw new Error(`Unexpected import ${id}`);
    },
  }, { filename: file });
  return module.exports;
}
const { matchDoraRecords, emptyDoraCheck } = load('src/lib/dora/model.ts');
const { default: DoraEvidence, DoraLicenseMark, DoraCheckDetails } = load('src/components/admin/pipeline/DoraEvidence.tsx');
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
const subject = { scope: 'person', name: 'Avery Synthetic', city: 'Synthetic City', state: 'CO', postalCode: '00000', licenseClaims: [{ prefix: 'MAN', number: '999900001', sourceRef: 'independent-synthetic-source' }] };
const official = { firstname: 'Avery', lastname: 'Synthetic', licensetype: 'MAN', licensenumber: '999900001', licensestatusdescription: 'Active', city: 'Synthetic City', state: 'CO', mailzipcode: '00000', licenseexpirationdate: '2027-03-31T00:00:00.000Z' };
const context = { checkedAt: '2026-10-14T18:00:00.000Z', datasetUpdatedAt: '2026-10-14T04:00:00.000Z' };
const match = (rows = [official], who = subject, extra = {}) => matchDoraRecords(who, rows, { ...context, ...extra });
const active = match();
const expired = match([{ ...official, licensestatusdescription: 'Expired', licenseexpirationdate: '2025-03-31T00:00:00.000Z' }]);
const unknown = emptyDoraCheck();
let total = 0;
function expectMark(name, check, symbol, labelText) {
  const html = render(DoraLicenseMark, { check, label: 'Person license' });
  assert.match(html, new RegExp(`aria-hidden="true">${symbol === '?' ? '\\?' : symbol}</span>`), name);
  assert.match(html, /role="img"/, `${name}: accessible image role`);
  assert.match(html, /aria-label="Person license:/, `${name}: descriptive accessible label`);
  assert.match(html, /title="Person license:/, `${name}: descriptive title`);
  if (labelText) assert(html.includes(labelText), `${name}: correct status label`);
  if (symbol === '?') assert(!html.includes('>✓<') && !html.includes('>×<'), `${name}: no confirmed symbol`);
  console.log(`PASS ${name}`); total++;
}
expectMark('corroborated active', active, '✓', 'Confirmed active');
expectMark('corroborated inactive (expired)', expired, '×', 'Confirmed inactive (expired)');
const nameOnly = match([official], { ...subject, licenseClaims: [] });
expectMark('name-only Active record', nameOnly, '?', 'Unresolved');
expectMark('name-only Expired record', match([{ ...official, licensestatusdescription: 'Expired', licenseexpirationdate: '' }], { ...subject, licenseClaims: [] }), '?');
expectMark('ambiguous records', match([official, { ...official, licensenumber: '999900002' }]), '?');
expectMark('no matching record', match([]), '?', 'no match');
expectMark('conflicting source rows', match([official, { ...official, city: 'Other Synthetic City' }]), '?');
expectMark('conflicting identity', match([official], { ...subject, name: 'Blair Synthetic' }), '?');
expectMark('no check', undefined, '?', 'not checked');
expectMark('not checked', unknown, '?');
expectMark('review despite active candidate', { ...active, status: 'review' }, '?');
expectMark('blocked with preserved active record', { ...active, outcome: 'blocked' }, '?', 'check blocked');
expectMark('truncated with preserved active record', { ...active, truncated: true }, '?');
expectMark('check conflict despite active label', { ...active, conflicts: ['Manual identity rejection'] }, '?');
expectMark('match conflict despite active label', { ...active, matches: [{ ...active.matches[0], conflicts: ['Identity differs'] }] }, '?');
expectMark('candidate identity despite active label', { ...active, matches: [{ ...active.matches[0], identity: 'review' }] }, '?');
expectMark('official status disagrees with check', { ...active, matches: [{ ...active.matches[0], statusText: 'Expired' }] }, '?');
expectMark('stale source check', { ...active, checkedAt: '2026-10-13T18:00:00.000Z' }, '?');
expectMark('missing checked date', { ...active, checkedAt: undefined }, '?');
expectMark('future checked date', { ...active, checkedAt: '2026-10-15T18:00:00.000Z' }, '?');
expectMark('unknown official status', match([{ ...official, licensestatusdescription: 'Suspended' }]), '?');

const dora = { schemaVersion: 1, personLicense: nameOnly, shopRegistration: unknown };
const compact = render(DoraEvidence, { dora, compact: true, catalogId: 'synthetic', admin: true });
assert(compact.includes('Person license') && compact.includes('Shop registration'));
assert(compact.includes('Needs review') && compact.includes('Not checked'));
assert(compact.includes('Check DORA'));
assert(!compact.includes('<details') && !compact.includes('No attributable DORA record'));
assert(!compact.includes('updated nightly') && !compact.includes('Avery Synthetic'));
assert(!render(DoraEvidence, { dora, compact: true, admin: false }).includes('Check DORA'));
console.log('PASS compact rows have summaries and authorized controls without their own evidence accordion'); total++;
const details = render(DoraCheckDetails, { check: nameOnly, label: 'Person license' });
for (const value of ['Avery Synthetic', 'Active', 'MAN.999900001', 'Nail Technician', 'Synthetic City', '00000', context.checkedAt, context.datasetUpdatedAt, 'DORA research dataset', 'Possible match. Identity needs review.']) assert(details.includes(value), `Missing detailed evidence: ${value}`);
console.log('PASS exported details preserve actual candidate facts, dates, sources and identity uncertainty'); total++;
const full = render(DoraEvidence, { dora });
assert(full.includes('updated nightly') && full.includes('Avery Synthetic') && full.includes('<details'));
console.log('PASS existing full mode remains the default'); total++;
console.log(`${total} synthetic DORA presentation checks passed.`);
