(() => {
  const layer = document.querySelector('.background-music');
  if (!layer) return;
  const symbols = ['♩', '♪', '♫', '♬', '𝄞'];
  const colors = ['#e6c477', '#d5ad60', '#ffe2a0', '#caa567', '#edcf92'];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const random = (min, max) => min + Math.random() * (max - min);
  let animations = [];
  let generation = 0;
  let visible = true;
  const shouldPause = () => !visible || document.hidden || document.body?.classList.contains('score-playback-active');
  function syncAnimations() {
    animations.forEach(animation => shouldPause() ? animation.pause() : animation.play());
  }

  function render() {
    const currentGeneration = ++generation;
    animations.forEach(animation => animation.cancel());
    animations = [];
    layer.replaceChildren();
    const { width, height } = layer.getBoundingClientRect();
    if (!width || !height) return;
    const count = width <= 760 ? 24 : 36;
    for (let i = 0; i < count; i++) {
      const symbol = document.createElement('span');
      symbol.className = 'background-music-symbol';
      symbol.textContent = symbols[i % symbols.length];
      symbol.style.color = colors[i % colors.length];
      symbol.style.fontSize = `${random(24, 46)}px`;
      layer.append(symbol);
      const pose = () => ({
        x: random(8, Math.max(8, width - 64)),
        y: random(72, Math.max(72, height - 64)),
        angle: random(-180, 180),
        scale: random(0.55, 1.5),
      });
      const transform = p => `translate(${p.x}px, ${p.y}px) rotate(${p.angle}deg) scale(${p.scale})`;
      let from = pose();
      symbol.style.transform = transform(from);
      if (reducedMotion.matches || !symbol.animate) continue;
      function move() {
        if (currentGeneration !== generation) return;
        const to = pose();
        to.angle = from.angle + random(-270, 270);
        const animation = symbol.animate([
          { transform: transform(from) },
          { transform: transform(to) },
        ], { duration: random(18000, 36000), easing: 'ease-in-out', fill: 'forwards' });
        animations[i] = animation;
        if (shouldPause()) animation.pause();
        animation.onfinish = () => {
          symbol.style.transform = transform(to);
          animation.cancel();
          from = to;
          move();
        };
      }
      move();
    }
  }
  document.addEventListener('scoreplaybackstate', syncAnimations);
  document.addEventListener('visibilitychange', syncAnimations);
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    syncAnimations();
  }).observe(layer);
  new ResizeObserver(render).observe(layer);
  reducedMotion.addEventListener('change', render);
})();
