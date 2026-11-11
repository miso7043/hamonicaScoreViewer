const fs = require('fs'), vm = require('vm'), assert = require('assert');
const source = fs.readFileSync('static/scores/viewer.js', 'utf8');
const listeners = {}, calls = [];
let bounds = {top: 250, bottom: 280, left: 100, right: 120};
const note = {classList: {add() {}}, getBoundingClientRect: () => bounds, scrollIntoView: options => calls.push(options)};
const notation = {
  contains: element => element === note, querySelectorAll: () => [],
  getBoundingClientRect: () => ({top: 100, left: 0}),
  clientTop: 0, clientLeft: 0, clientHeight: 500, clientWidth: 400,
};
const viewerClasses = new Set();
const viewer = {classList: {add: value => viewerClasses.add(value), contains: value => viewerClasses.has(value)}, getBoundingClientRect: () => ({top: 260}), dataset: {}, querySelector: selector => selector === '[data-notation]' ? notation : selector === '.playback-toolbar' ? null : {}, addEventListener: (name, handler) => {listeners[name] = handler;}};
const window = {innerHeight: 800, innerWidth: 400};
const document = {getElementById: id => id === 'score-viewer' ? viewer : id === 'missing' || id === 'preview-button' ? null : note, addEventListener() {}};
vm.runInNewContext(source, {window, document});
let index = 0;
const tick = ids => listeners.scoreplayhead({detail: {ids: ids || [`note-${++index}`]}});
tick(); assert.equal(calls.length, 0, 'Visible notes should not move the score');
bounds = {...bounds, top: 620, bottom: 650};
tick(); assert.equal(calls.length, 1, 'Follow notes below the score panel');
tick([`note-${index}`]); assert.equal(calls.length, 1, 'Do not scroll again on every animation frame');
bounds = {...bounds, top: 30, bottom: 60};
tick(); assert.equal(calls.length, 2, 'Follow backward jumps and repeats');
bounds = {top: 250, bottom: 280, left: 410, right: 430};
tick(); assert.equal(calls.length, 3, 'Follow horizontally clipped notes');
bounds = {top: 250, bottom: 280, left: 100, right: 120};
window.visualViewport = {offsetTop: 0, offsetLeft: 0, height: 200, width: 400};
tick(); assert.equal(calls.length, 4, 'Follow notes outside the mobile visual viewport');
tick([]); tick(['missing']); assert.equal(calls.length, 4, 'Rests, stop, and missing notes must not scroll');
assert(calls.every(call => call.behavior === 'instant' && call.block === 'center'));
console.log('PASS: visible notes, panel overflow, backward jumps, horizontal overflow, mobile viewport, idle events');

const documentMoves = [], panelMoves = [];
window.scrollY = 0;
window.scrollTo = options => documentMoves.push(options);
notation.scrollBy = options => panelMoves.push(options);
listeners.scoreplaybackstart();
assert(viewerClasses.has('desktop-playback-layout'));
assert.equal(documentMoves.length, 1, 'Align the panel when playback begins');
assert.equal(documentMoves[0].top, 260);
window.visualViewport = undefined;
bounds = {top: 620, bottom: 650, left: 100, right: 120};
const outerCalls = calls.length;
tick();
assert.equal(panelMoves.length, 1, 'Follow overflow inside the playback panel');
assert.equal(panelMoves[0].top, 285);
assert.equal(calls.length, outerCalls, 'Do not center the note by moving the document');
assert.equal(documentMoves.length, 1, 'Keep the panel aligned while following notes');
bounds = {...bounds, top: 250, bottom: 280};
tick();
assert.equal(panelMoves.length, 1, 'Leave visible notes in place');
console.log('PASS: playback panel alignment and internal scrolling without document movement');
