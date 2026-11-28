(() => {
  const layer = document.querySelector('.header-music');
  if (!layer) return;
  const symbols = ['♩', '♪', '♫', '♬', '𝄞', '𝄢', '♯', '♭', '♮', '𝄽', '𝄐'];
  const colors = ['#79e4ce', '#edb2ef', '#ffd27d', '#87beff', '#ffaab7'];
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
    const count = Math.min(18, Math.max(10, Math.round(width / 42)));
    for (let i = 0; i < count; i++) {
      const symbol = document.createElement('span');
      symbol.className = 'header-music-symbol';
      symbol.textContent = symbols[i % symbols.length];
      symbol.style.color = colors[i % colors.length];
      symbol.style.fontSize = `${random(22, 52)}px`;
      layer.append(symbol);
      const pose = () => ({
        x: random(-15, Math.max(0, width - 20)),
        y: random(-18, Math.max(0, height - 20)),
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
