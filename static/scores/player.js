const playerTranslate = (ko, en) => document.documentElement.lang === "ko" ? ko : en;
(() => {
  const t = playerTranslate;
  const viewer = document.getElementById("score-viewer");
  if (!viewer) return;
  const playButton = viewer.querySelector('[data-player-action="play"]');
  const status = viewer.querySelector("[data-player-status]");
  // Samples are ordered by hole. For duplicate pitches, prefer the earlier hole.
  const samples = [
    [60, "01_hole01_blow_C4.m4a"],
    [62, "02_hole01_draw_D4.m4a"],
    [64, "03_hole02_blow_E4.m4a"],
    [67, "04_hole02_draw_G4.m4a"],
    [67, "05_hole03_blow_G4.m4a"],
    [71, "06_hole03_draw_B4.m4a"],
    [72, "07_hole04_blow_C5.m4a"],
    [74, "08_hole04_draw_D5.m4a"],
    [76, "09_hole05_blow_E5.m4a"],
    [77, "10_hole05_draw_F5.m4a"],
    [79, "11_hole06_blow_G5.m4a"],
    [81, "12_hole06_draw_A5.m4a"],
    [84, "13_hole07_blow_C6.m4a"],
    [83, "14_hole07_draw_B5.m4a"],
    [88, "15_hole08_blow_E6.m4a"],
    [86, "16_hole08_draw_D6.m4a"],
    [91, "17_hole09_blow_G6.m4a"],
    [89, "18_hole09_draw_F6.m4a"],
    [96, "19_hole10_blow_C7.m4a"],
    [93, "20_hole10_draw_A6.m4a"],
    [100, "21_hole11_blow_E7.m4a"],
    [95, "22_hole11_draw_B6.m4a"],
    [103, "23_hole12_blow_G7.m4a"],
    [98, "24_hole12_draw_D7.m4a"],
  ];
  const semitones = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};
  let context, events=[], audioEvents=[], duration=0, offset=0, playRequest=0, timer, animationFrame, audioStartedAt=0, playing=false, activeSources=[];
  const buffers = new Map(), downloads = new Map();
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
      if(++steps>100000) throw new Error(t("도돌이표 반복 횟수가 너무 많습니다.", "Too many repeat iterations."));
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
    if(doc.querySelector("parsererror")) throw new Error(t("MusicXML 문법 오류", "Invalid MusicXML syntax"));
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
  function downloadSample(name) {
    if (!downloads.has(name)) {
      const pending = fetch(viewer.dataset.soundBase + name).then(response => {
        if (!response.ok) throw new Error(`${t("음원 로드 실패", "Failed to load audio sample")}: ${response.status} (${name})`);
        return response.arrayBuffer();
      }).catch(error => { downloads.delete(name); throw error; });
      downloads.set(name, pending);
    }
    return downloads.get(name);
  }
  function neededSamples() {
    return [...new Set(audioEvents.map(note => nearestSample(note.midi)))];
  }
  async function preloadSamples() {
    // Fetch every distinct sample used anywhere in this score, including before a clicked note.
    // Decoding waits for the user's gesture.
    const queue = neededSamples();
    await Promise.all(Array.from({length: Math.min(4, queue.length)}, async () => {
      while (queue.length) {
        const sample = queue.shift();
        try { await downloadSample(sample[1]); } catch (_) { /* Retry on play. */ }
      }
    }));
  }
  async function loadBuffer(sample) {
    const name = sample[1];
    if (buffers.has(name)) return buffers.get(name);
    const pending = (async () => {
      try {
        return await context.decodeAudioData((await downloadSample(name)).slice(0));
      } catch (_) {
        // Some browsers cannot decode AAC/M4A. PCM WAV is the compatibility path.
        const fallback = "fallback/" + name.replace(/\.m4a$/, ".wav");
        try { return await context.decodeAudioData((await downloadSample(fallback)).slice(0)); }
        catch (error) { throw new Error(`${t("음원을 준비하지 못했습니다. 다시 재생해 주세요.", "Could not prepare audio. Please try playing again.")} (${name}): ${error.message}`); }
      }
    })().then(buffer => { buffers.set(name, buffer); return buffer; })
      .catch(error => { buffers.delete(name); throw error; });
    buffers.set(name, pending);
    return pending;
  }
  function cancelSources() { activeSources.forEach(source=>{try{source.stop();}catch(_){}}); activeSources=[]; clearInterval(timer); cancelAnimationFrame(animationFrame); highlight([]); }
  function highlight(ids, midis = []) { viewer.dispatchEvent(new CustomEvent("scoreplayhead", {detail:{ids, midis}})); }
  function playbackOffset() { return Math.min(duration, Math.max(0, context.currentTime-audioStartedAt)); }
  function animatePlayhead() {
    if (!playing) return;
    const position=playbackOffset();
    const currentNotes = events.filter(note=>note.start<=position && position<note.start+note.duration);
    highlight(currentNotes.map(note=>note.id), currentNotes.map(note=>note.midi));
    animationFrame=requestAnimationFrame(animatePlayhead);
  }
  function updateStatus() { status.textContent=events.length?`${formatTime(offset)} / ${formatTime(duration)} · ${events.length}${t("음", " notes")}`:t("재생할 음표가 없습니다", "No notes to play"); }
  async function play(startOffset) {
    if(Number.isFinite(startOffset)) { playing=false; cancelSources(); offset=startOffset; }
    if(playing) { playRequest++; offset=playbackOffset(); playing=false; cancelSources(); playButton.textContent=t("▶ 계속", "\u25b6 Resume"); updateStatus(); return; }
    if(!events.length) return;
    if(offset>=duration) offset=0;
    const request=++playRequest;
    playButton.disabled=true;
    status.textContent=t("악보 전체 음원을 준비하는 중…", "Preparing all score samples…");
    try {
      context ||= new (window.AudioContext||window.webkitAudioContext)();
      await context.resume();
      if(request!==playRequest) return;
      const needed=neededSamples();
      let ready=0;
      await Promise.all(needed.map(async sample => {
        await loadBuffer(sample);
        if(request===playRequest) status.textContent=`${t("악보 전체 음원 준비", "Preparing all score samples")} ${++ready}/${needed.length}`;
      }));
      if(request!==playRequest) return;
      if(context.state === "suspended") await context.resume();
      if(request!==playRequest) return;
      if(context.state !== "running") throw new Error(t("오디오가 일시 중단되었습니다. 다시 재생해 주세요.", "Audio is suspended. Please try playing again."));
    } catch(error) {
      if(request!==playRequest) return;
      status.textContent=error.message; playButton.disabled=false; return;
    }
    // Start the score clock only after the first and every following sample is decoded.
    playButton.disabled=false; playing=true; playButton.textContent=t("Ⅱ 일시정지", "\u2161 Pause");
    viewer.dispatchEvent(new CustomEvent("scoreplaybackstart"));
    const playbackStartOffset=offset, audioStart=context.currentTime+0.5; audioStartedAt=audioStart-playbackStartOffset;
    // Keep decoded samples in memory, but create audio nodes only for the next second.
    // Scheduling an entire long score at once can overload the audio engine at startup.
    const pendingNotes=audioEvents.filter(note=>note.start+note.duration>offset && note.start<duration)
      .sort((a,b)=>a.start-b.start);
    let nextNote=0;
    function scheduleUpcomingNotes() {
      const horizon=context.currentTime+1;
      while(nextNote<pendingNotes.length) {
        const note=pendingNotes[nextNote];
        const scheduledStart=audioStart+Math.max(0,note.start-playbackStartOffset);
        if(scheduledStart>horizon) break;
        nextNote++;
        const end=audioStartedAt+note.start+note.duration;
        if(end<=context.currentTime) continue;
        const sample=nearestSample(note.midi), source=context.createBufferSource(), gain=context.createGain();
        const when=Math.max(scheduledStart,context.currentTime+.01), remaining=end-when;
        if(remaining<=0) continue;
        source.buffer=buffers.get(sample[1]); source.playbackRate.value=2**((note.midi-sample[0])/12); source.loop=source.buffer.duration>1.04; source.loopStart=source.loop ? 1.04 : 0; source.loopEnd=Math.min(3, source.buffer.duration);
        gain.gain.setValueAtTime(0,when); gain.gain.linearRampToValueAtTime(.65,when+Math.min(.015,remaining/3)); gain.gain.setValueAtTime(.65,Math.max(when+Math.min(.015,remaining/3),end-Math.min(.06,remaining/3))); gain.gain.linearRampToValueAtTime(0,end);
        source.onended=()=>{ source.disconnect?.(); gain.disconnect?.(); activeSources=activeSources.filter(item=>item!==source); };
        source.connect(gain).connect(context.destination); source.start(when, 0.2); source.stop(end+.01); activeSources.push(source);
      }
    }
    scheduleUpcomingNotes();
    animatePlayhead();
    timer=setInterval(()=>{
      scheduleUpcomingNotes(); offset=playbackOffset(); updateStatus();
      if(offset>=duration){ playing=false; cancelSources(); playButton.textContent=t("▶ 다시 재생", "\u25b6 Replay"); }
    },100);
  }
  function stop() { playRequest++; playButton.disabled=false; playing=false; cancelSources(); offset=0; playButton.textContent=t("▶ 재생", "\u25b6 Play"); updateStatus(); }
  viewer.addEventListener("scorexmlchange",event=>{stop(); try{parseMusicXML(event.detail.xml); void preloadSamples();}catch(error){status.textContent=error.message;}});
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
