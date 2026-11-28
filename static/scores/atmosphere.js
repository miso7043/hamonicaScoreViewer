(() => {
  const layer = document.querySelector('.gold-atmosphere');
  if (!layer) return;
  const svg = layer.querySelector('svg');
  const ns = 'http://www.w3.org/2000/svg';
  const mobile = window.matchMedia('(max-width: 760px)').matches;
  // Build curves once. Animate independent SVG layers with transform/opacity only;
  // no frame loop, path mutations or trigonometry competes with score playback.
  const bands = [
    { y: 360, amplitude: 190, frequency: 1.1, phase: 0 },
    { y: 450, amplitude: 250, frequency: .8, phase: 2.1 },
    { y: 580, amplitude: 200, frequency: 1.35, phase: 4.2 },
    { y: 700, amplitude: 260, frequency: .95, phase: 1.3 },
  ];
  bands.forEach((band, index) => {
    const ribbon = document.createElementNS(ns, 'svg');
    ribbon.setAttribute('viewBox', '0 0 1440 1000');
    ribbon.setAttribute('preserveAspectRatio', 'none');
    ribbon.setAttribute('class', `gold-ribbon gold-ribbon-${index}`);
    // Each layer owns its gradient, so it can be rasterized independently.
    ribbon.append(svg.querySelector('defs').cloneNode(true));
    const gradient = ribbon.querySelector('linearGradient');
    gradient.id = `atmosphere-gold-${index}`;
    for (let line = 0; line < (mobile ? 6 : 8); line++) {
      const points = [];
      for (let x = -100; x <= 1540; x += 30) {
        const phase = x / 1440 * Math.PI * 2 * band.frequency + band.phase;
        const y = band.y + Math.sin(phase + line * .045) * (band.amplitude + line * 5)
          + Math.sin(phase * .56) * 55 + (line - 4) * 6;
        points.push(`${x},${y.toFixed(1)}`);
      }
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', `M${points.join(' L')}`);
      path.setAttribute('stroke', `url(#atmosphere-gold-${index})`);
      path.setAttribute('stroke-width', line === 3 ? '2' : '.8');
      path.setAttribute('opacity', line === 3 ? '.9' : '.32');
      ribbon.append(path);
    }
    layer.insertBefore(ribbon, layer.querySelector('.gold-particles'));
  });
  svg.remove();
  const particles = layer.querySelector('.gold-particles');
  for (let i = 0; i < (mobile ? 40 : 60); i++) {
    const particle = document.createElement('i');
    particle.style.cssText = `left:${Math.random() * 100}%;top:${30 + Math.random() * 75}%;--size:${2 + Math.random() * 3}px;--drift:${(Math.random() - .5) * 260}px;--rise:${180 + Math.random() * 380}px;--duration:${4 + Math.random() * 5}s;--delay:${-Math.random() * 12}s`;
    particles.append(particle);
  }
  const syncVisibility = () => layer.classList.toggle('is-paused', document.hidden);
  document.addEventListener('visibilitychange', syncVisibility);
  syncVisibility();
})();
