(() => {
  const viewer = document.getElementById("score-viewer"); if (!viewer) return;
  const notation = viewer.querySelector("[data-notation]"), status = viewer.querySelector("[data-status]");
  const currentLabel = viewer.querySelector("[data-page-current]"), totalLabel = viewer.querySelector("[data-page-total]"), zoomLabel = viewer.querySelector("[data-zoom]");
  const measuresPerSystem = Number(viewer.dataset.measuresPerSystem) === 2 ? 2 : 4;
  const mobile = measuresPerSystem === 2;
  let highlightedIds = [];
  let toolkit, xml = "", currentPage = 1, pageCount = 1, scale = 45;
  function setStatus(message, isError=false) { status.textContent=message; status.classList.toggle("error",isError); status.hidden=!message; }
  function renderPage(animateEntrance = false) { try { notation.innerHTML=toolkit.renderToSVG(currentPage,false); currentLabel.textContent=currentPage; totalLabel.textContent=pageCount; zoomLabel.textContent=`${scale}%`; setStatus(""); applyHighlights(); if (animateEntrance) animateNotes(); } catch(error) { setStatus(`악보를 표시하지 못했습니다: ${error.message}`,true); } }
  function animateNotes() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const groups = new Set();
    notation.querySelectorAll(".note").forEach(note => {
      let group = note;
      // Keep tuplet numbers, beams and chords with their notes.
      for (let parent = note.parentElement; parent && parent !== notation; parent = parent.parentElement) {
        if (parent.matches(".tuplet, .beam, .chord")) group = parent;
      }
      groups.add(group);
    });
    const duration = 340, stagger = 30, rowPause = 40;
    const rows = new Map();
    // Measure everything before adding animations so moving notes cannot affect ordering.
    groups.forEach(group => {
      const matrix = group.parentElement.getScreenCTM();
      if (!matrix || !matrix.d) return;
      const bounds = group.getBoundingClientRect();
      const system = group.closest(".system") || group.ownerSVGElement;
      if (!rows.has(system)) rows.set(system, {top: system.getBoundingClientRect().top, notes: []});
      rows.get(system).notes.push({
        group, left: bounds.left,
        distance: Math.max(100, (bounds.bottom - group.ownerSVGElement.getBoundingClientRect().top + 40) / Math.abs(matrix.d)),
      });
    });
    let rowStart = 0;
    const scheduled = [];
    Array.from(rows.values()).sort((a, b) => a.top - b.top).forEach(row => {
      row.notes.sort((a, b) => a.left - b.left).forEach((note, index) => {
        scheduled.push({...note, delay: rowStart + index * stagger});
      });
      // Start the next system after the final group in this system has landed.
      rowStart += (row.notes.length - 1) * stagger + duration + rowPause;
    });
    scheduled.forEach(({group, distance, delay}) => {
      // Preserve the renderer's transforms and playback IDs inside a temporary wrapper.
      const wrapper = document.createElementNS("http://www.w3.org/2000/svg", "g");
      wrapper.style.setProperty("--note-drop-duration", `${duration}ms`);
      wrapper.style.setProperty("--note-drop-distance", `${-distance}px`);
      wrapper.style.setProperty("--note-drop-delay", `${delay}ms`);
      group.parentNode.insertBefore(wrapper, group);
      wrapper.appendChild(group);
      wrapper.classList.add("note-entrance");
      wrapper.addEventListener("animationend", event => {
        if (event.target === wrapper) wrapper.replaceWith(group);
      });
    });
  }
  function applyHighlights() {
    notation.querySelectorAll(".playing-note").forEach(note => note.classList.remove("playing-note"));
    highlightedIds.forEach(id => {
      const note = document.getElementById(id);
      if (note && notation.contains(note)) note.classList.add("playing-note");
    });
  }
  viewer.addEventListener("scoreplayhead", event => {
    const ids = event.detail.ids;
    if (ids.join(",") === highlightedIds.join(",")) return;
    highlightedIds = ids;
    const page = ids.length ? toolkit?.getPageWithElement(ids[0]) : 0;
    if (page > 0 && page !== currentPage) { currentPage = page; renderPage(); }
    else applyHighlights();
  });
  function directChildren(element, name) { return Array.from(element.children).filter(child => child.localName === name); }
  function addSystemBreak(container) {
    let print = directChildren(container, "print")[0];
    if (!print) {
      print = container.ownerDocument.createElementNS(container.namespaceURI, "print");
      const attributes = directChildren(container, "attributes")[0];
      container.insertBefore(print, attributes ? attributes.nextSibling : container.firstChild);
    }
    print.setAttribute("new-system", "yes");
  }
  function measuresPerRow(content) {
    const documentXml = new DOMParser().parseFromString(content, "application/xml");
    if (documentXml.querySelector("parsererror")) throw new Error("MusicXML 문법이 올바르지 않습니다.");
    const root = documentXml.documentElement;
    Array.from(root.getElementsByTagNameNS("*", "note")).forEach((note, index) => {
      const id = `playback-note-${index}`;
      note.setAttribute("id", id);
      note.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:id", id);
    });
    // Apply the selected row length without changing the stored MusicXML.
    Array.from(root.getElementsByTagNameNS("*", "print")).forEach(print => {
      print.removeAttribute("new-system"); print.removeAttribute("new-page");
    });
    if (root.localName === "score-partwise") {
      directChildren(root, "part").forEach(part => directChildren(part, "measure").forEach((measure, index) => {
        if (index > 0 && index % measuresPerSystem === 0) addSystemBreak(measure);
      }));
    } else if (root.localName === "score-timewise") {
      directChildren(root, "measure").forEach((measure, index) => {
        if (index > 0 && index % measuresPerSystem === 0) directChildren(measure, "part").forEach(addSystemBreak);
      });
    }
    return new XMLSerializer().serializeToString(documentXml);
  }
  function loadScore(content, animateEntrance = true) { xml=content; setStatus("악보를 만드는 중입니다…"); toolkit.setOptions({scale,pageWidth:mobile ? 1000 : 2100,pageHeight:2970,adjustPageHeight:mobile,breaks:"encoded"}); const playbackXml=measuresPerRow(xml); highlightedIds=[]; if(!toolkit.loadData(playbackXml)) throw new Error("Verovio가 MusicXML을 읽지 못했습니다."); currentPage=1; pageCount=Math.max(1,toolkit.getPageCount()); renderPage(animateEntrance); viewer.dispatchEvent(new CustomEvent("scorexmlchange",{detail:{xml:playbackXml}})); }
  async function initialLoad() { toolkit=new verovio.toolkit(); try { if(viewer.dataset.xmlUrl) { const response=await fetch(viewer.dataset.xmlUrl); if(!response.ok) throw new Error(`서버 응답 ${response.status}`); loadScore(await response.text()); } else loadScore(document.getElementById(viewer.dataset.editorId).value); } catch(error) { setStatus(`악보를 불러오지 못했습니다: ${error.message}`,true); } }
  viewer.addEventListener("click", event => { const action=event.target.closest("button")?.dataset.action; if(!action||!toolkit||!xml) return; if(action==="previous"&&currentPage>1) currentPage--; if(action==="next"&&currentPage<pageCount) currentPage++; if(action==="zoom-in") scale=Math.min(80,scale+5); if(action==="zoom-out") scale=Math.max(20,scale-5); if(action==="reset") scale=45; if(["zoom-in","zoom-out","reset"].includes(action)) loadScore(xml, false); else renderPage(); });
  document.getElementById("preview-button")?.addEventListener("click",()=>{ try { loadScore(document.getElementById(viewer.dataset.editorId).value); } catch(error) { setStatus(`미리보기에 실패했습니다: ${error.message}`,true); } viewer.scrollIntoView({behavior:"smooth",block:"start"}); });
  function boot(){ if(!window.verovio?.module){ setStatus("Verovio CDN을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.",true); return; } verovio.module.onRuntimeInitialized=initialLoad; }
  document.addEventListener("DOMContentLoaded",boot);
})();
