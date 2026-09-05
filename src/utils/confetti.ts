/**
 * Lightweight, zero-dependency confetti burst using native HTML5 Canvas.
 * Follows Ponytail's ladder: native platform capability replaces canvas-confetti.
 */
export function fireConfetti(options?: { particleCount?: number }) {
  if (typeof document === 'undefined') return;

  const count = options?.particleCount || 60;
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '99999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#eab308'];
  const particles = Array.from({ length: count }, () => ({
    x: width / 2,
    y: height * 0.65,
    vx: (Math.random() - 0.5) * 14,
    vy: -(Math.random() * 12 + 6),
    color: colors[Math.floor(Math.random() * colors.length)],
    size: Math.random() * 6 + 4,
    rotation: Math.random() * 360,
    vRotation: (Math.random() - 0.5) * 10,
    alpha: 1,
  }));

  let frameId: number;
  const startTime = Date.now();
  const duration = 2000;

  function render() {
    const elapsed = Date.now() - startTime;
    if (elapsed > duration || !ctx) {
      cancelAnimationFrame(frameId);
      canvas.remove();
      return;
    }

    ctx.clearRect(0, 0, width, height);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // gravity
      p.vx *= 0.98; // drag
      p.rotation += p.vRotation;
      p.alpha = Math.max(0, 1 - elapsed / duration);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }

    frameId = requestAnimationFrame(render);
  }

  frameId = requestAnimationFrame(render);
}
