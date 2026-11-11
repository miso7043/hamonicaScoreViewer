const viewerTranslate = (ko, en) => document.documentElement.lang === "ko" ? ko : en;
(() => {
  const t = viewerTranslate;
  const viewer = document.getElementById("score-viewer"); if (!viewer) return;
  const notation = viewer.querySelector("[data-notation]"), status = viewer.querySelector("[data-status]");
  const currentLabel = viewer.querySelector("[data-page-current]"), totalLabel = viewer.querySelector("[data-page-total]");
  const previousButton = viewer.querySelector('[data-action="previous"]'), nextButton = viewer.querySelector('[data-action="next"]');
  const mobile = viewer.dataset.layout === "mobile";
  const measuresPerSystem = 2;
  let highlightedIds = [];
  let toolkit, xml = "", currentPage = 1, pageCount = 1;
  const scale = 45;
  function setStatus(message, isError=false) { status.textContent=message; status.classList.toggle("error",isError); status.hidden=!message; }
  function renderPage(animateEntrance = false) {
    try {
      notation.innerHTML = toolkit.renderToSVG(currentPage, false);
      currentLabel.textContent = currentPage;
      totalLabel.textContent = pageCount;
      previousButton.hidden = nextButton.hidden = pageCount < 2;
      previousButton.disabled = currentPage <= 1;
      nextButton.disabled = currentPage >= pageCount;
      setStatus("");
      applyHighlights();
      if (animateEntrance) animateNotes();
    } catch(error) { setStatus(`${t("악보를 표시하지 못했습니다: ", "Could not display score: ")}${error.message}`,true); }
  }
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
  viewer.addEventListener("scoreplaybackstart", () => {
    if (mobile) return;
    viewer.classList.add("desktop-playback-layout");
    // Align the panel once; following notes must never move the document.
    window.scrollTo({top: window.scrollY + viewer.getBoundingClientRect().top, behavior: "instant"});
  });
  function followPlayhead() {
    const note = highlightedIds.map(id => document.getElementById(id)).find(note => note && notation.contains(note));
    if (!note) return;
    // Finish entrance effects so their temporary positions cannot misdirect scrolling.
    notation.querySelectorAll(".note-entrance").forEach(wrapper => wrapper.replaceWith(...wrapper.childNodes));
    const bounds = note.getBoundingClientRect(), panel = notation.getBoundingClientRect();
    if (!mobile && viewer.classList.contains("desktop-playback-layout")) {
      const top = panel.top + notation.clientTop;
      const left = panel.left + notation.clientLeft;
      const bottom = top + notation.clientHeight;
      const right = left + notation.clientWidth;
      if (bounds.top < top + 16 || bounds.bottom > bottom - 16 || bounds.left < left + 16 || bounds.right > right - 16) {
        notation.scrollBy({
          top: (bounds.top + bounds.bottom - top - bottom) / 2,
          left: bounds.left < left ? bounds.left - left - 16 : bounds.right > right ? bounds.right - right + 16 : 0,
          behavior: "instant",
        });
      }
      return;
    }
    const viewport = window.visualViewport;
    const top = Math.max(panel.top + notation.clientTop, viewport?.offsetTop || 0);
    const left = Math.max(panel.left + notation.clientLeft, viewport?.offsetLeft || 0);
    const dock = viewer.querySelector(".playback-toolbar");
    const bottom = Math.min(panel.top + notation.clientTop + notation.clientHeight, (viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight), dock ? dock.getBoundingClientRect().top : Infinity);
    const right = Math.min(panel.left + notation.clientLeft + notation.clientWidth, (viewport?.offsetLeft || 0) + (viewport?.width || window.innerWidth));
    if (bounds.top < top + 16 || bounds.bottom > bottom - 16 || bounds.left < left + 16 || bounds.right > right - 16) {
      // Scroll both the score panel and the document, including backward repeats.
      note.scrollIntoView({behavior: "instant", block: "center", inline: "nearest"});
    }
  }
  viewer.addEventListener("scoreplayhead", event => {
    const ids = event.detail.ids;
    if (ids.join(",") === highlightedIds.join(",")) return;
    highlightedIds = ids;
    const page = ids.length ? toolkit?.getPageWithElement(ids[0]) : 0;
    if (page > 0 && page !== currentPage) { currentPage = page; renderPage(); }
    else applyHighlights();
    followPlayhead();
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
    if (documentXml.querySelector("parsererror")) throw new Error(t("MusicXML 문법이 올바르지 않습니다.", "Invalid MusicXML syntax."));
    const root = documentXml.documentElement;
    Array.from(root.getElementsByTagNameNS("*", "note")).forEach((note, index) => {
      const id = `playback-note-${index}`;
      note.setAttribute("id", id);
      note.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:id", id);
    });
    // Desktop preserves the system and page breaks encoded in the source.
    if (!mobile) return new XMLSerializer().serializeToString(documentXml);
    // Mobile uses two measures per system without changing the stored MusicXML.
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
  function loadScore(content, animateEntrance = true) { xml=content; setStatus(t("악보를 만드는 중입니다…", "Rendering score\u2026")); toolkit.setOptions({scale,pageWidth:mobile ? 1000 : 2100,pageHeight:2970,adjustPageHeight:true,breaks:"encoded"}); const playbackXml=measuresPerRow(xml); highlightedIds=[]; if(!toolkit.loadData(playbackXml)) throw new Error(t("Verovio가 MusicXML을 읽지 못했습니다.", "Verovio could not read the MusicXML.")); currentPage=1; pageCount=Math.max(1,toolkit.getPageCount()); renderPage(animateEntrance); viewer.dispatchEvent(new CustomEvent("scorexmlchange",{detail:{xml:playbackXml}})); }
  async function initialLoad() { toolkit=new verovio.toolkit(); try { if(viewer.dataset.xmlUrl) { const response=await fetch(viewer.dataset.xmlUrl); if(!response.ok) throw new Error(`${t("서버 응답 ", "Server response ")}${response.status}`); loadScore(await response.text()); } else loadScore(document.getElementById(viewer.dataset.editorId).value); } catch(error) { setStatus(`${t("악보를 불러오지 못했습니다: ", "Could not load score: ")}${error.message}`,true); } }
  viewer.addEventListener("click", event => {
    const action = event.target.closest("button")?.dataset.action;
    if (!toolkit || !xml) return;
    if (action === "previous" && currentPage > 1) { currentPage--; renderPage(); }
    if (action === "next" && currentPage < pageCount) { currentPage++; renderPage(); }
  });
  document.getElementById("preview-button")?.addEventListener("click",()=>{ try { loadScore(document.getElementById(viewer.dataset.editorId).value); } catch(error) { setStatus(`${t("미리보기에 실패했습니다: ", "Preview failed: ")}${error.message}`,true); } viewer.scrollIntoView({behavior:"smooth",block:"start"}); });
  function boot(){ if(!window.verovio?.module){ setStatus(t("Verovio CDN을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.", "Could not load Verovio. Check your internet connection."),true); return; } verovio.module.onRuntimeInitialized=initialLoad; }
  document.addEventListener("DOMContentLoaded",boot);
})();
