// Phone screens must get mobile layout even when opening a shared desktop URL.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const source = fs.readFileSync('static/scores/viewer.js', 'utf8');
const setup = source.slice(0, source.indexOf('  const measuresPerSystem'));
for (const fixture of [
  { layout: 'encoded', phone: true, expected: true },
  { layout: 'mobile', phone: false, expected: true },
  { layout: 'encoded', phone: false, expected: false },
]) {
  const classes = new Set();
  const viewer = { dataset: { layout: fixture.layout }, querySelector() { return {}; } };
  const scope = {
    document: { getElementById: () => viewer, body: { classList: { add: name => classes.add(name) } } },
    window: { matchMedia: () => ({ matches: fixture.phone }) },
  };
  vm.runInNewContext(setup + 'globalThis.mobileLayout = mobile;})();', scope);
  assert.equal(scope.mobileLayout, fixture.expected);
  assert.equal(classes.has('mobile-layout'), fixture.expected);
  if (fixture.expected) assert.equal(viewer.dataset.layout, 'mobile');
}
assert(fs.readFileSync('templates/base.html', 'utf8').includes('media="(max-width: 760px), (pointer: coarse) and (max-width: 1100px)"'), 'Shared desktop URLs must load mobile CSS on phones');
console.log('PASS: shared desktop URLs on phones, explicit mobile routes, desktop layout and mobile CSS');
