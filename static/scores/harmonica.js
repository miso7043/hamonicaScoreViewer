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
  // C-major 24-hole Asian tremolo tuning, from Suzuki's notation chart:
  // https://www.suzuki-music.co.jp/app/uploads/000082_3.pdf
  // Each vertical pair of reeds sounds one pitch, rather than blow/draw rows.
  const pitches = [55,62,60,65,64,69,67,71,72,74,76,77,79,81,84,83,88,86,91,89,96,93,100,95];
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
    const label = document.createElementNS(namespace, "text");
    label.setAttribute("x", x); label.setAttribute("y", 263);
    label.textContent = index + 1;
    overlay.appendChild(label);
    overlay.appendChild(group);
    return group;
  });
  let previous = "";
  viewer.addEventListener("scoreplayhead", event => {
    const midis = [...new Set(event.detail.midis || [])].sort((a, b) => a - b);
    const key = midis.join(",");
    if (key === previous) return;
    previous = key;
    holes.forEach((hole, index) => {
      const active = midis.includes(pitches[index]);
      hole.classList.toggle("is-playing", active);
    });
  });
})();
