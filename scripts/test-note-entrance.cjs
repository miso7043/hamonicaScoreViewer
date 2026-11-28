const fs = require('fs'), vm = require('vm'), assert = require('assert');
const source = fs.readFileSync('static/scores/viewer.js', 'utf8');
const animate = source.slice(source.indexOf('  function animateNotes()'), source.indexOf('  function applyHighlights()'));
function run({panelHeight = 1000, dockTop = 650, viewportTop = 0, viewportHeight = 844, reduced = false} = {}) {
  const wrapped = [];
  const svg = {getBoundingClientRect: () => ({top: 100})};
  const parent = {matches: () => false, getScreenCTM: () => ({d: 1}), insertBefore(wrapper, group) {wrapped.push(group.id);}};
  const group = (id, top, bottom, left = 20, right = 40) => ({
    id, parentElement: parent, parentNode: parent, ownerSVGElement: svg,
    getBoundingClientRect: () => ({top, bottom, left, right}), closest: () => svg,
  });
  const groups = [group('visible', 200, 220), group('above-score', 60, 80),
    group('behind-dock', 700, 720), group('below-screen', 950, 970),
    group('outside-right', 420, 440, 400, 430)];
  const notation = {clientTop: 0, clientLeft: 0, clientHeight: panelHeight, clientWidth: 390,
    getBoundingClientRect: () => ({top: 100, left: 0}), querySelectorAll: () => groups};
  const scope = {notation, viewer: {querySelector: () => dockTop === null ? null : {getBoundingClientRect: () => ({top: dockTop, bottom: 844})}},
    window: {innerHeight: 844, innerWidth: 390, visualViewport: {offsetTop: viewportTop, offsetLeft: 0, height: viewportHeight, width: 390}, matchMedia: () => ({matches: reduced})},
    document: {createElementNS: () => ({style: {setProperty() {}}, appendChild() {}, classList: {add() {}}, addEventListener() {}})}};
  vm.runInNewContext(animate, scope);
  scope.animateNotes();
  return wrapped;
}
assert.deepEqual(run(), ['visible'], 'Only initially visible notes should animate');
assert.deepEqual(run({dockTop: null}), ['visible', 'behind-dock'], 'Viewport bottom clips desktop score');
assert.deepEqual(run({dockTop: null, panelHeight: 150}), ['visible'], 'Scrollable score panel clips notes too');
assert.deepEqual(run({viewportHeight: 150}), [], 'Mobile visual viewport must be respected');
assert.deepEqual(run({reduced: true}), [], 'Reduced motion must remain static');
console.log('PASS: initial viewport, score panel, dock occlusion, horizontal clipping and reduced motion');
