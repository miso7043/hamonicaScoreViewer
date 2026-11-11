const fs = require('fs'), vm = require('vm'), assert = require('assert');
const source = fs.readFileSync(process.argv[2] || 'static/scores/player.js', 'utf8');
const flush = async () => { for (let n = 0; n < 20; n++) await Promise.resolve(); };
function setup({failM4a=false, failAll=false, failResume=false, nodeCost=0}={}) {
  const fetched=[], decodes=[], starts=[], sampleOffsets=[], notices=[], intervals=[];
  let audioContext;
  const button={}, status={};
  const viewer={dataset:{soundBase:'/audio/'},querySelector:s=>s.includes('action')?button:status,
    addEventListener(){},dispatchEvent:event=>notices.push({type:event.type,detail:event.detail})};
  class AudioContext {
    constructor(){this.state='suspended';this.currentTime=10;this.destination={};audioContext=this;}
    async resume(){if(failResume)throw new Error('resume failed');this.state='running';}
    decodeAudioData(data){
      if(failAll || (failM4a && data.name.endsWith('.m4a'))) return Promise.reject(new Error('codec unsupported'));
      return new Promise(resolve=>decodes.push(()=>resolve({duration:3})));
    }
    createBufferSource(){this.currentTime+=nodeCost;return {playbackRate:{},connect(){return {connect(){}}},start:(time,offset)=>{starts.push(time);sampleOffsets.push(offset);},stop(){}};}
    createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){}}};}
  }
  const scope={window:{AudioContext},document:{documentElement:{lang:'ko'},getElementById:()=>viewer},
    fetch:async name=>{fetched.push(name);return {ok:true,arrayBuffer:async()=>Object.assign(new ArrayBuffer(1),{name, slice(){return this;}})};},
    CustomEvent:class {constructor(type,options){this.type=type;this.detail=options?.detail;}},setInterval(callback){intervals.push(callback);return callback;},clearInterval(callback){const i=intervals.indexOf(callback);if(i>=0)intervals.splice(i,1);},requestAnimationFrame(){},cancelAnimationFrame(){}};
  vm.runInNewContext(source.replace(/\}\)\(\);\s*$/, `
    globalThis.test={play,stop,preloadSamples,loadBuffer,samples,setNotes(notes){events=notes;audioEvents=notes;duration=4;},getOffset:()=>offset,getPlaybackOffset:()=>playbackOffset(),animatePlayhead,setDuration:value=>{duration=value;}};
  })();`),scope);
  scope.test.setNotes([{start:0,duration:1,midi:60,id:'first'},{start:1,duration:1,midi:62,id:'next'}]);
  return {api:scope.test,button,status,fetched,decodes,starts,sampleOffsets,notices,advance(seconds){audioContext.currentTime+=seconds;intervals.slice().forEach(tick=>tick());}};
}
(async()=>{
  let h=setup();
  await h.api.preloadSamples();assert.equal(h.fetched.length,2,'Prefetch following notes before play');
  const play=h.api.play();await flush();
  assert.equal(h.starts.length,0);assert.equal(h.api.getOffset(),0,'Loading must not advance score time');
  h.decodes.shift()();await flush();assert.equal(h.starts.length,0,'Wait for the next sample too');
  h.decodes.shift()();await play;
  assert.deepEqual(h.starts,[10.5],'Only the first second is scheduled at startup');
  h.advance(1);
  assert.deepEqual(h.starts,[10.5,11.5],'Wait 0.5 seconds after all samples decode, then retain score timing');
  assert.equal(h.fetched.length,2,'Reuse prefetched downloads');
  assert.deepEqual(h.sampleOffsets,[0.2,0.2],'Skip the first 200ms of every sample without shifting score timing');
  h=setup();const seek=h.api.play(1);await flush();
  assert.equal(h.fetched.length,2,'Clicking a later note must still load every sample in the score');
  h.decodes.shift()();await flush();assert.equal(h.starts.length,0,'Do not start until even earlier score samples finish decoding');
  h.decodes.shift()();await seek;assert.equal(h.starts.length,1,'Start at the clicked note only after the whole score is ready');
  assert.equal(h.api.getPlaybackOffset(),1,'The 0.5s startup delay must not move the playhead before the clicked note');
  let head=h.notices.filter(event=>event.type==='scoreplayhead').at(-1);
  assert.equal(head.detail.midis.length,0,'Do not animate the previous note during startup delay');
  h.advance(0.5);h.api.animatePlayhead();
  head=h.notices.filter(event=>event.type==='scoreplayhead').at(-1);
  assert.deepEqual(Array.from(head.detail.midis),[62],'First animation must match the clicked note when sound starts');
  h=setup({failM4a:true});const fallback=h.api.play();await flush();
  assert(h.fetched.some(name=>name.includes('/fallback/')),'Use PCM WAV when AAC cannot be decoded');
  h.decodes.splice(0).forEach(resolve=>resolve());await fallback;h.advance(1);assert.equal(h.starts.length,2);
  h=setup();const cancelled=h.api.play();await flush();h.api.stop();h.decodes.splice(0).forEach(resolve=>resolve());await cancelled;
  assert.equal(h.starts.length,0,'Stopping while loading must cancel playback');assert.equal(h.button.disabled,false);
  h=setup({nodeCost:0.02});
  h.api.setNotes(Array.from({length:500},(_,i)=>({start:i*0.25,duration:0.25,midi:60,id:`n${i}`})));h.api.setDuration(125);
  const longScore=h.api.play();await flush();h.decodes.splice(0).forEach(resolve=>resolve());await longScore;
  assert(h.starts.length<=4,'Long scores must not create hundreds of nodes before the first sound');
  assert.equal(h.starts[0],10.5,'Expensive node creation must not discard the opening notes');
  h.advance(0.5);assert(h.starts.length>3,'Keep scheduling subsequent notes ahead of time');
  h.api.stop();const count=h.starts.length;h.advance(2);assert.equal(h.starts.length,count,'Stop must cancel future scheduling');
  h=setup({failAll:true});await h.api.play();assert.equal(h.starts.length,0);assert.equal(h.button.disabled,false);assert(h.status.textContent.includes('준비하지 못했습니다'));
  h=setup({failResume:true});await h.api.play();assert.equal(h.status.textContent,'resume failed');assert.equal(h.button.disabled,false);
  console.log('PASS: prefetch, decode barrier, score timing, WAV fallback, cancellation, long-score startup, decode/resume errors');
})().catch(error=>{console.error(error);process.exitCode=1;});
