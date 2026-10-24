(() => {
  const viewer = document.getElementById("score-viewer");
  if (!viewer) return;
  const playButton = viewer.querySelector('[data-player-action="play"]');
  const status = viewer.querySelector("[data-player-status]");
  // Real VCSL recordings; MIDI mapping and sustain loops are documented in samples.json.
  const samples = [
  [
    60,
    "vcsl/Hohner-Special20_Normal_C3_play.wav",
    1.04,
    3.0
  ],
  [
    64,
    "vcsl/Hohner-Special20_Normal_E3_play.wav",
    1.04,
    3.0
  ],
  [
    72,
    "vcsl/Hohner-Special20_Normal_C4_play.wav",
    1.04,
    3.0
  ],
  [
    76,
    "vcsl/Hohner-Special20_Normal_E4_play.wav",
    1.04,
    3.0
  ],
  [
    79,
    "vcsl/Hohner-Special20_Normal_G4_play.wav",
    1.04,
    3.0
  ],
  [
    84,
    "vcsl/Hohner-Special20_Normal_C5_play.wav",
    1.04,
    3.0
  ],
  [
    88,
    "vcsl/Hohner-Special20_Normal_E5_play.wav",
    1.04,
    3.0
  ],
  [
    91,
    "vcsl/Hohner-Special20_Normal_G5_play.wav",
    1.04,
    3.0
  ],
  [
    96,
    "vcsl/Hohner-Special20_Normal_C6_play.wav",
    1.04,
    3.0
  ]
];
  const semitones = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};
  let context, events=[], audioEvents=[], duration=0, offset=0, playRequest=0, timer, animationFrame, audioStartedAt=0, playing=false, activeSources=[];
  const buffers = new Map();
  const children = (node,name) => Array.from(node.children).filter(child => child.localName===name);
  const first = (node,name) => Array.from(node.getElementsByTagNameNS("*",name))[0];
  const number = (node,name,fallback=0) => Number(first(node,name)?.textContent || fallback);
  const formatTime = value => `${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,"0")}`;
  function nearestSample(midi) { return samples.reduce((best,item) => Math.abs(item[0]-midi)<Math.abs(best[0]-midi)?item:best,samples[0]); }
  // Expand written measures into performance order before scheduling audio.
  function measureOrder(measures) {
    const regions=[], stack=[], endings=[];
    let activeEnding=null;
    measures.forEach((measure,index)=>{
      const repeats=Array.from(measure.getElementsByTagNameNS("*","repeat"));
      if(repeats.some(mark=>mark.getAttribute("direction")==="forward")) stack.push(index);
      const backward=repeats.find(mark=>mark.getAttribute("direction")==="backward");
      if(backward) regions.push({start:stack.pop()??0,end:index,times:Math.max(2,Number(backward.getAttribute("times"))||2)});
      for(const mark of Array.from(measure.getElementsByTagNameNS("*","ending"))) {
        if(mark.getAttribute("type")==="start") {
          activeEnding={start:index,end:measures.length-1,numbers:(mark.getAttribute("number").match(/\d+/g)||[]).map(Number)};
          endings.push(activeEnding);
        } else if(activeEnding) { activeEnding.end=index; activeEnding=null; }
      }
    });
    endings.forEach(ending=>{
      ending.region=regions.filter(region=>region.start<=ending.start && ending.start<=region.end).sort((a,b)=>a.end-b.end)[0]
        || regions.filter(region=>region.end<ending.start).sort((a,b)=>b.end-a.end)[0];
      if(ending.region) ending.region.times=Math.max(ending.region.times,...ending.numbers);
    });
    const passes=new Map(), order=[];
    let index=0, steps=0;
    while(index<measures.length) {
      if(++steps>100000) throw new Error("도돌이표 반복 횟수가 너무 많습니다.");
      const ending=endings.find(ending=>ending.start<=index && index<=ending.end);
      const pass=ending?.region ? (passes.get(ending.region)||1) : 1;
      if(!ending || ending.numbers.includes(pass)) order.push(index);
      const region=regions.find(region=>region.end===index);
      if(region && (passes.get(region)||1)<region.times) {
        passes.set(region,(passes.get(region)||1)+1);
        regions.filter(inner=>inner!==region && region.start<=inner.start && inner.end<region.end).forEach(inner=>passes.delete(inner));
        index=region.start;
      } else index++;
    }
    return order;
  }
  function mergeTiedNotes(notes) {
    const sustained=[], pending=new Map();
    for(const note of notes) {
      const key=`${note.voice}:${note.staff}:${note.midi}`;
      const previous=pending.get(key);
      // A tie must join the same pitch in the same voice/staff without a gap.
      const continuation=note.tieStop && previous && Math.abs(previous.start+previous.duration-note.start)<1e-6;
      let sound;
      if(continuation) {
        previous.duration=note.start+note.duration-previous.start;
        sound=previous;
      } else {
        sound={...note};
        sustained.push(sound);
      }
      if(note.tieStart) pending.set(key,sound);
      else pending.delete(key);
    }
    return sustained;
  }
  function parseMusicXML(xml) {
    const doc=new DOMParser().parseFromString(xml,"application/xml");
    if(doc.querySelector("parsererror")) throw new Error("MusicXML 문법 오류");
    const root=doc.documentElement;
    let measures=[];
    if(root.localName==="score-partwise") measures=children(children(root,"part")[0]||root,"measure");
    else measures=children(root,"measure").map(measure=>children(measure,"part")[0]).filter(Boolean);
    let divisions=1, tempo=120, cursor=0, result=[];
    // Save inherited tempo/divisions at each written measure so repeat jumps
    // do not accidentally inherit the final measure's settings.
    const settings=measures.map(measure=>{
      const entry={divisions,tempo};
      for(const item of Array.from(measure.children)) {
        if(item.localName==="attributes") divisions=number(item,"divisions",divisions)||divisions;
        if(item.localName==="direction") tempo=Number(first(item,"sound")?.getAttribute("tempo"))||number(item,"per-minute",0)||tempo;
      }
      return entry;
    });
    for(const index of measureOrder(measures)) {
      const measure=measures[index];
      ({divisions,tempo}=settings[index]);
      let measureEnd=cursor, previousStart=cursor;
      for(const item of Array.from(measure.children)) {
        if(item.localName==="attributes") divisions=number(item,"divisions",divisions)||divisions;
        if(item.localName==="direction") {
          const sound=first(item,"sound"), marked=number(item,"per-minute",0);
          tempo=Number(sound?.getAttribute("tempo"))||marked||tempo;
        }
        if(item.localName==="backup") { cursor-=number(item,"duration")/divisions*60/tempo; continue; }
        if(item.localName==="forward") { cursor+=number(item,"duration")/divisions*60/tempo; measureEnd=Math.max(measureEnd,cursor); continue; }
        if(item.localName!=="note") continue;
        const length=number(item,"duration")/divisions*60/tempo;
        const chord=Boolean(first(item,"chord"));
        const start=chord?previousStart:cursor;
        if(!chord) previousStart=start;
        const pitch=first(item,"pitch");
        if(pitch && length>0) {
          const step=first(pitch,"step")?.textContent.trim();
          const midi=(number(pitch,"octave")+1)*12+semitones[step]+number(pitch,"alter");
          const ties=[...children(item,"tie"),...Array.from(item.getElementsByTagNameNS("*","tied"))];
          result.push({start,duration:length,midi,id:item.getAttribute("id"),
            voice:first(item,"voice")?.textContent.trim()||"1",
            staff:first(item,"staff")?.textContent.trim()||"1",
            tieStart:ties.some(tie=>tie.getAttribute("type")==="start"),
            tieStop:ties.some(tie=>tie.getAttribute("type")==="stop")});
        }
        if(!chord) cursor+=length;
        measureEnd=Math.max(measureEnd,start+length,cursor);
      }
      cursor=measureEnd;
    }
    events=result; audioEvents=mergeTiedNotes(result); duration=Math.max(cursor,...result.map(note=>note.start+note.duration),0); offset=0; updateStatus();
  }
  async function loadBuffer(sample) {
    if(buffers.has(sample[1])) return buffers.get(sample[1]);
    const promise=fetch(viewer.dataset.soundBase+sample[1]).then(response=>{if(!response.ok) throw new Error("음원 로드 실패"); return response.arrayBuffer();}).then(data=>context.decodeAudioData(data)).then(buffer=>{buffers.set(sample[1],buffer); return buffer;}).catch(error=>{buffers.delete(sample[1]); throw error;});
    buffers.set(sample[1],promise); return promise;
  }
  function cancelSources() { activeSources.forEach(source=>{try{source.stop();}catch(_){}}); activeSources=[]; clearInterval(timer); cancelAnimationFrame(animationFrame); highlight([]); }
  function highlight(ids) { viewer.dispatchEvent(new CustomEvent("scoreplayhead", {detail:{ids}})); }
  function playbackOffset() { return Math.min(duration, Math.max(0, context.currentTime-audioStartedAt)); }
  function animatePlayhead() {
    if (!playing) return;
    const position=playbackOffset();
    highlight(events.filter(note=>note.start<=position && position<note.start+note.duration).map(note=>note.id));
    animationFrame=requestAnimationFrame(animatePlayhead);
  }
  function updateStatus() { status.textContent=events.length?`${formatTime(offset)} / ${formatTime(duration)} · ${events.length}음`:`재생할 음표가 없습니다`; }
  async function play(startOffset) {
    if(Number.isFinite(startOffset)) { playing=false; cancelSources(); offset=startOffset; }
    if(playing) { playRequest++; offset=playbackOffset(); playing=false; cancelSources(); playButton.textContent="▶ 계속"; updateStatus(); return; }
    if(!events.length) return;
    if(offset>=duration) offset=0;
    const request=++playRequest;
    context ||= new (window.AudioContext||window.webkitAudioContext)(); await context.resume();
    if(request!==playRequest) return;
    playButton.disabled=true; status.textContent="하모니카 음원을 불러오는 중…";
    try {
      const needed=[...new Set(audioEvents.filter(note=>note.start+note.duration>offset).map(note=>nearestSample(note.midi)[1]))];
      await Promise.all(needed.map(name=>loadBuffer(samples.find(sample=>sample[1]===name))));
      if(request!==playRequest) return;
    } catch(error) { if(request!==playRequest) return; status.textContent=error.message; playButton.disabled=false; return; }
    playButton.disabled=false; playing=true; playButton.textContent="Ⅱ 일시정지";
    const audioStart=context.currentTime+.05; audioStartedAt=audioStart-offset;
    for(const note of audioEvents) {
      if(note.start+note.duration<=offset || note.start>=duration) continue;
      const sample=nearestSample(note.midi), source=context.createBufferSource(), gain=context.createGain();
      const when=audioStart+Math.max(0,note.start-offset), remaining=note.start+note.duration-Math.max(offset,note.start), end=when+remaining;
      source.buffer=buffers.get(sample[1]); source.playbackRate.value=2**((note.midi-sample[0])/12); source.loop=true; source.loopStart=sample[2]; source.loopEnd=sample[3];
      gain.gain.setValueAtTime(0,when); gain.gain.linearRampToValueAtTime(.65,when+Math.min(.015,remaining/3)); gain.gain.setValueAtTime(.65,Math.max(when+Math.min(.015,remaining/3),end-Math.min(.06,remaining/3))); gain.gain.linearRampToValueAtTime(0,end);
      source.connect(gain).connect(context.destination); source.start(when); source.stop(end+.01); activeSources.push(source);
    }
    animatePlayhead();
    timer=setInterval(()=>{ offset=playbackOffset(); updateStatus(); if(offset>=duration){ playing=false; cancelSources(); playButton.textContent="▶ 다시 재생"; } },100);
  }
  function stop() { playRequest++; playButton.disabled=false; playing=false; cancelSources(); offset=0; playButton.textContent="▶ 재생"; updateStatus(); }
  viewer.addEventListener("scorexmlchange",event=>{stop(); try{parseMusicXML(event.detail.xml);}catch(error){status.textContent=error.message;}});
  viewer.addEventListener("click", event => {
    const element=event.target.closest("[data-notation] .note");
    if(!element || !viewer.contains(element)) return;
    const position=playing?playbackOffset():offset;
    const occurrences=events.filter(note=>note.id===element.id);
    const note=occurrences.find(note=>note.start+note.duration>position)||occurrences[0];
    if(note) play(note.start);
  });
  viewer.addEventListener("click",event=>{const action=event.target.closest("button")?.dataset.playerAction; if(action==="play") play(); if(action==="stop") stop();});
})();
