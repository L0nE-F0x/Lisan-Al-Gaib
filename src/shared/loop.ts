/**
 * One requestAnimationFrame scheduler for the whole page.
 *
 * - Runs only while at least one subscriber exists AND the tab is visible.
 * - Passes dt in seconds, clamped to 0.1 s so returning from a background tab never
 *   causes a jump (e.g. hundreds of timeline years at once).
 * - A subscriber that throws is logged and removed; it can never stop the loop for others.
 */

export type FrameFn = (dt: number, time: number) => void;

const subs = new Set<FrameFn>();
let rafId = 0;
let last = 0;

function frame(now: number): void {
  rafId = 0;
  const dt = last === 0 ? 1 / 60 : Math.min((now - last) / 1000, 0.1);
  last = now;
  for (const fn of Array.from(subs)) {
    try {
      fn(dt, now / 1000);
    } catch (err) {
      console.error('[loop] frame subscriber failed and was removed', err);
      subs.delete(fn);
    }
  }
  schedule();
}

function schedule(): void {
  if (rafId || subs.size === 0 || document.hidden) return;
  rafId = requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  } else {
    last = 0;
    schedule();
  }
});

/** Subscribe to frames. Returns an unsubscribe function. */
export function onFrame(fn: FrameFn): () => void {
  subs.add(fn);
  schedule();
  return () => {
    subs.delete(fn);
    if (subs.size === 0 && rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
      last = 0;
    }
  };
}

/**
 * Run `fn` every frame only while `el` is on screen. Useful for hub sections
 * (worm canvas, hero) so off-screen effects cost nothing.
 */
export function onFrameWhileVisible(el: Element, fn: FrameFn, rootMargin = '100px'): () => void {
  let off: (() => void) | null = null;
  const io = new IntersectionObserver(
    (entries) => {
      const visible = entries.some((e) => e.isIntersecting);
      if (visible && !off) off = onFrame(fn);
      else if (!visible && off) {
        off();
        off = null;
      }
    },
    { rootMargin },
  );
  io.observe(el);
  return () => {
    io.disconnect();
    off?.();
  };
}
