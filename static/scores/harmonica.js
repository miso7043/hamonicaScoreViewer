(() => {
  const viewer = document.getElementById("score-viewer");
  const overlay = viewer?.querySelector("[data-harmonica-overlay]");
  if (!overlay) return;
  {
    const dock = overlay.closest(".playback-toolbar");
    const updateDockHeight = () => {
      document.documentElement.style.setProperty("--harmonica-dock-height", `${Math.ceil(dock.getBoundingClientRect().height)}px`);
    };
    // Re-measure after rotation, image loading and safe-area changes.
    new ResizeObserver(updateDockHeight).observe(dock);
    updateDockHeight();
  }
  // Left-to-right pitches from musicXML/트레몰로 하모니카 기본음.musicxml.
  // Preserve the score's octave numbers (G2 at hole 1, B5 at hole 24).
  // Each vertical pair of reeds sounds one pitch, rather than blow/draw rows.
  const pitches = [43,50,48,53,52,57,55,59,60,62,64,65,67,69,72,71,76,74,79,77,84,81,88,83];
  const namespace = "http://www.w3.org/2000/svg";
  const holes = pitches.map((midi, index) => {
    const group = document.createElementNS(namespace, "g");
    group.dataset.midi = midi;
    group.classList.add("harmonica-hole");
    group.classList.add(index % 2 === 0 ? "harmonica-blow" : "harmonica-draw");
    // Match the cropped 980×232 artwork; leave space below it for numbers.
    const x = 54.2 + 37.48833 * index;
    for (const y of [120.5, 164.5]) {
      const circle = document.createElementNS(namespace, "circle");
      circle.setAttribute("cx", x); circle.setAttribute("cy", y); circle.setAttribute("r", 14.45);
      group.appendChild(circle);
    }
    overlay.appendChild(group);
    return group;
  });
  let previous = "";
  viewer.addEventListener("scoreplayhead", event => {
    const midis = [...new Set(event.detail.midis || [])].filter(Number.isFinite).sort((a, b) => a - b);
    // Keep the final animation state while the same pitches continue.
    const key = midis.join(",");
    if (key === previous) return;
    previous = key;
    // This C harmonica has no hole for accidentals or out-of-range pitches.
    // Show the closest hole for those notes; audio keeps the original pitch.
    const activeHoles = new Set(midis.map(midi => pitches.reduce((best, pitch, index) =>
      Math.abs(pitch - midi) < Math.abs(pitches[best] - midi) ? index : best, 0)));
    holes.forEach((hole, index) => {
      hole.classList.toggle("is-playing", activeHoles.has(index));
    });
  });
})();
