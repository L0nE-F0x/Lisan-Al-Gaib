/**
 * Hero: Arrakis rising as a crescent horizon behind the title.
 *
 * - The globe (three.js) is imported lazily after first paint, so the title is the LCP.
 * - A CSS planet with the same framing shows immediately and stays as the fallback
 *   when WebGL is unavailable.
 * - Renders only while the hero is on screen and the tab is visible (shared loop);
 *   capped at 30 fps on mid/low tier devices.
 * - Scrolling sinks and dims the planet using transforms/opacity only.
 */
import type { ArrakisGlobe } from '../shared/globe/globe.ts';
import { onFrame } from '../shared/loop.ts';
import { deviceTier, onReducedMotionChange, reducedMotion } from '../shared/prefs.ts';
import { clamp, h } from '../shared/dom.ts';

const HALF_FOV_TAN = Math.tan((17.5 * Math.PI) / 180); // globe camera: 35° vertical fov

/** Camera distance (planet radii) at which the planet's silhouette radius is `radiusPx`. */
function distanceFor(radiusPx: number, heightPx: number): number {
  const x = (radiusPx / (heightPx / 2)) * HALF_FOV_TAN;
  return Math.sqrt(1 + x * x) / x;
}

interface Framing {
  distance: number;
  shiftY: number;
}

/** Big, gently curved horizon: the limb's apex sits ~2/3 down the viewport. */
function horizonFraming(w: number, hgt: number): Framing {
  const portrait = hgt > w;
  const radius = portrait ? Math.max(w * 1.3, hgt * 0.62) : Math.max(w * 0.72, hgt * 1.05);
  const apex = hgt * (portrait ? 0.7 : 0.66);
  const centre = apex + radius;
  return { distance: distanceFor(radius, hgt), shiftY: (centre - hgt / 2) / hgt };
}

export interface Hero {
  /** Render a fully lit still of the planet for the Arrakis portal card (null without WebGL). */
  snapshot(): Promise<Blob | null>;
}

export function initHero(): Hero {
  const section = document.getElementById('hero')!;
  const stage = document.querySelector<HTMLElement>('.hero-stage')!;
  const canvas = document.getElementById('hero-canvas') as HTMLCanvasElement;
  const inner = section.querySelector<HTMLElement>('.hero__inner')!;

  splitTitle(document.getElementById('hero-title')!);

  let globe: ArrakisGlobe | null = null;
  let ready: Promise<ArrakisGlobe | null> | null = null;
  let progress = 0; // 0 at top, 1 once the hero has scrolled away
  let off: (() => void) | null = null;
  let acc = 0;
  let still = reducedMotion();
  const tier = deviceTier();
  const minStep = tier === 'high' ? 0 : 1 / 31;

  let lastP = -1;
  let lastKey = '';
  const applyScroll = () => {
    const vh = window.innerHeight || 1;
    progress = clamp(window.scrollY / (vh * 0.9), 0, 1);
    if (progress === lastP) return;
    lastP = progress;
    // Content drifts up and fades; the planet dims. Transform/opacity only.
    const p = progress;
    if (!still) inner.style.transform = `translate3d(0, ${(-p * 70).toFixed(1)}px, 0)`;
    inner.style.opacity = String(clamp(1 - p * 1.35, 0, 1).toFixed(3));
    stage.style.opacity = String((1 - p * 0.75).toFixed(3));
  };

  const frame = (dt: number, force = false) => {
    applyScroll();
    if (!globe) return;
    acc += dt;
    if (acc < minStep && !force) return;
    const step = acc;
    acc = 0;
    const { width, height } = globe.size;
    if (still) {
      // Static under reduced motion: redraw only when size or scroll changed.
      const key = `${width}x${height}`;
      if (key === lastKey && !force) return;
      lastKey = key;
    } else {
      globe.view.centerLon += step * 1.6;
    }
    const f = horizonFraming(width, height);
    globe.view.distance = f.distance;
    // Sinking: the planet slides further down as the page scrolls.
    globe.setFrameShift(0, f.shiftY + (still ? 0 : progress * 0.22));
    globe.render(still ? 0 : step);
  };

  const start = () => {
    if (!off) off = onFrame((dt) => frame(dt));
  };
  const stop = () => {
    off?.();
    off = null;
  };

  // Only work while the hero is on screen.
  const io = new IntersectionObserver(
    (entries) => {
      const visible = entries.some((e) => e.isIntersecting);
      stage.dataset.offscreen = String(!visible);
      if (visible) start();
      else stop();
    },
    { rootMargin: '0px' },
  );
  io.observe(section);

  // Reduced motion: no spin, no parallax; render on demand.
  onReducedMotionChange((r) => {
    still = r;
    if (r) inner.style.transform = '';
  });
  applyScroll();

  const boot = (): Promise<ArrakisGlobe | null> => {
    if (ready) return ready;
    ready = import('../shared/globe/globe.ts')
      .then(({ ArrakisGlobe }) => {
        try {
          const g = new ArrakisGlobe(canvas, {
            quality: tier,
            maxDpr: tier === 'low' ? 1 : 1.5,
            moons: false,
            stars: true,
            storms: tier !== 'low',
          });
          // Sun behind the planet and above: a thin sunrise along the limb.
          g.setSunFromView(0.28, 0.72, -0.36);
          g.setStorms(0.32);
          g.view.centerLat = 18;
          g.view.centerLon = -28;
          globe = g;
          // First frame, then fade the canvas in over the CSS planet.
          frame(1 / 60, true);
          requestAnimationFrame(() => stage.classList.add('is-live'));
          return g;
        } catch (err) {
          console.info('[hero] WebGL unavailable, keeping the CSS planet.', err);
          stage.classList.add('no-webgl');
          return null;
        }
      })
      .catch((err) => {
        console.warn('[hero] globe failed to load', err);
        stage.classList.add('no-webgl');
        return null;
      });
    return ready;
  };

  // Defer the heavy work until the title has painted.
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
    .requestIdleCallback;
  requestAnimationFrame(() => {
    if (idle) idle(() => void boot(), { timeout: 600 });
    else window.setTimeout(() => void boot(), 120);
  });

  const snapshot = async (): Promise<Blob | null> => {
    const g = await boot();
    if (!g) return null;
    const { width, height } = g.size;
    const saved = { lat: g.view.centerLat, lon: g.view.centerLon, dist: g.view.distance };
    g.view.centerLat = 24;
    g.view.centerLon = 12;
    // Fit inside the 16:9 crop the portal card shows (object-fit: cover).
    g.view.distance = distanceFor(Math.min(width * 0.5625, height) * 0.4, height);
    g.setFrameShift(0, 0);
    g.setSunFromView(-0.62, 0.38, 0.68);
    g.render(0);
    // Read back in the same task as the draw (no preserveDrawingBuffer needed).
    const blob = new Promise<Blob | null>((resolve) => {
      try {
        canvas.toBlob((b) => resolve(b), 'image/webp', 0.86);
      } catch {
        resolve(null);
      }
    });
    g.view.centerLat = saved.lat;
    g.view.centerLon = saved.lon;
    g.view.distance = saved.dist;
    g.setSunFromView(0.28, 0.72, -0.36);
    frame(0, true);
    return blob;
  };

  return { snapshot };
}

/** Wrap each letter for the reveal; the accessible name stays the plain text. */
function splitTitle(el: HTMLElement): void {
  const text = el.textContent?.trim() ?? '';
  if (!text) return;
  let i = 0;
  const words = text.split(/\s+/).map((word) =>
    h(
      'span',
      { class: 'hero__word' },
      ...Array.from(word).map((ch) => h('span', { class: 'hero__ch', style: `--i:${i++}` }, ch)),
    ),
  );
  const visual = h('span', { class: 'hero__letters', 'aria-hidden': 'true' });
  words.forEach((w, n) => {
    if (n) visual.append(' ');
    visual.append(w);
  });
  el.replaceChildren(h('span', { class: 'sr-only' }, text), visual);
}
