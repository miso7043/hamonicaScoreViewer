// Run with node scripts/test-repeat-order.cjs [optional fixture JSON].
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('static/scores/player.js','utf8');
const fn=source.slice(source.indexOf('  function measureOrder('),source.indexOf('  function parseMusicXML('));
const context={};vm.runInNewContext(fn,context);
const measure=marks=>({getElementsByTagNameNS:(_,name)=>(marks[name]||[]).map(attrs=>({getAttribute:key=>attrs[key]??null}))});
const run=marks=>Array.from(context.measureOrder(marks.map(measure)));
const forward={repeat:[{direction:'forward'}]}, backward={repeat:[{direction:'backward'}]};
const first={ending:[{number:'1',type:'start'},{number:'1',type:'stop'}],...backward};
const second={ending:[{number:'2',type:'start'},{number:'2',type:'discontinue'}]};
assert.deepEqual(run([{},forward,{},first,second,{}]),[0,1,2,3,1,2,4,5]);
assert.deepEqual(run([{},backward,{}]),[0,1,0,1,2]);
assert.deepEqual(run([forward,backward,forward,backward]),[0,1,0,1,2,3,2,3]);
assert.deepEqual(run([forward,forward,backward,backward]),[0,1,2,1,2,3,0,1,2,1,2,3]);
assert.deepEqual(run([forward,{ending:[{number:'1,2',type:'start'},{number:'1,2',type:'stop'}],...backward},{ending:[{number:'3',type:'start'},{number:'3',type:'stop'}]}]),[0,1,0,1,0,2]);
if(process.argv[2]) {
 for(const fixture of JSON.parse(fs.readFileSync(process.argv[2],'utf8'))) {
  const order=run(fixture.measures);
  assert.deepEqual(order,fixture.expected,fixture.name);
  console.log('PASS actual MusicXML:',fixture.name,order.map(i=>i+1).join(','));
 }
}
console.log('PASS repeat order: endings 1/2 and 1,2/3, implicit start, separate and nested repeats');
