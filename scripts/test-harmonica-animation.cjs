const fs = require('fs'), vm = require('vm'), assert = require('assert');
const listeners = {}, groups = [];
let transitions = 0;
const overlay = {
  closest: () => ({getBoundingClientRect: () => ({height: 200})}),
  appendChild(element) { if (element.tag === 'g') groups.push(element); },
  getBoundingClientRect() { return {}; },
};
const viewer = {querySelector: () => overlay, addEventListener: (name, fn) => {listeners[name] = fn;}};
const document = {
  documentElement: {style: {setProperty() {}}}, getElementById: () => viewer,
  createElementNS(namespace, tag) {
    const classes = new Set();
    return {tag, dataset: {}, setAttribute() {}, appendChild() {}, classList: {
      add: value => classes.add(value), remove: value => { if (classes.delete(value) && value === 'is-playing') transitions++; },
      toggle(value, active) {
        if (value === 'is-playing' && classes.has(value) !== active) transitions++;
        if (active) classes.add(value); else classes.delete(value);
      },
      contains: value => classes.has(value),
    }};
  },
};
vm.runInNewContext(fs.readFileSync('static/scores/harmonica.js', 'utf8'), {
  document, ResizeObserver: class {observe() {}},
});
const tick = (ids, midis) => listeners.scoreplayhead({detail: {ids, midis}});
const active = () => groups.filter(group => group.classList.contains('is-playing'));
const xml = fs.readFileSync('musicXML/someoneLikeYou.musicxml', 'utf8');
const steps = {C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11};
const pitches = [...xml.matchAll(/<pitch>([\s\S]*?)<\/pitch>/g)].map(([, pitch]) => {
  const value = tag => pitch.match(new RegExp(`<${tag}>(.*?)</${tag}>`))?.[1];
  return (Number(value('octave')) + 1) * 12 + steps[value('step')] + Number(value('alter') || 0);
});
assert.deepEqual(pitches.slice(0, 4), [57, 61, 64, 61]);
pitches.forEach((midi, index) => {
  tick([`note-${index}`], [midi]);
  assert.equal(active().length, 1, `Someone Like You note ${index + 1} (${midi}) must animate`);
  if (groups.some(group => group.dataset.midi === midi)) assert.equal(active()[0].dataset.midi, midi);
});
tick(['tie-start'], [60]);
let before = transitions;
tick(['tie-stop'], [60]);
assert.equal(transitions, before, 'Keep the final state on tie continuation');
before = transitions;
tick(['tie-stop'], [60]);
assert.equal(transitions, before, 'Do not restart the same note on every frame');
tick(['repeat'], [60]);
assert.equal(transitions, before, 'Repeated pitches keep the final animation state');
tick(['changed'], [64]);
assert.equal(transitions, before + 2, 'A different hole ends the old animation and starts the new one');
tick([], []);
before = transitions;
tick(['after-rest'], [64]);
assert.equal(transitions, before + 1, 'Restart after a rest');
tick(['low', 'sharp', 'high'], [12, 61, 120]);
assert.equal(active().length, 3, 'Chords, accidentals and pitches outside the diagram must animate');
tick([], []);
assert.equal(active().length, 0, 'Clear animations on rests and stop');
console.log(`PASS: all ${pitches.length} Someone Like You notes, ties, repeated pitches, chords, range fallback and rests`);
