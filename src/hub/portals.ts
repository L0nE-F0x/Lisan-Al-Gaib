/**
 * Enter the Archives: two portal cards with cheap live previews.
 *  - Arrakis: a still of the real procedural planet, rendered by the hero's WebGL context
 *    (no second context); a CSS planet stands in until it arrives or without WebGL.
 *  - Known Universe: an SVG star map drawn from the lore's star systems.
 */
import { lore } from '../data/index.ts';
import type { Hero } from './hero.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function initPortals(section: HTMLElement, hero: Hero): void {
  stats();
  starmap(document.getElementById('portal-starmap') as SVGSVGElement | null);

  // Pause decorative CSS animation while the section is off screen.
  new IntersectionObserver((entries) => {
    section.dataset.onscreen = String(entries.some((e) => e.isIntersecting));
  }).observe(section);

  // Fetch the planet still once the section approaches.
  const img = document.getElementById('portal-shot') as HTMLImageElement | null;
  if (!img) return;
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      void hero.snapshot().then((blob) => {
        if (!blob) return;
        img.src = URL.createObjectURL(blob);
        img.decode().then(
          () => {
            img.hidden = false;
            requestAnimationFrame(() => img.classList.add('is-ready'));
          },
          () => {},
        );
      });
    },
    { rootMargin: '600px 0px' },
  );
  io.observe(section);
}

function stats(): void {
  const join = (parts: [number, string, string][]) =>
    parts
      .filter(([n]) => n > 0)
      .map(([n, one, many]) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`)
      .join(' · ');

  const a = document.getElementById('portal-arrakis-stats');
  if (a) {
    a.textContent = join([
      [lore.arrakis.places.length, 'place', 'places'],
      [lore.arrakis.regions.length, 'region', 'regions'],
      [lore.arrakis.moons.length, 'moon', 'moons'],
    ]);
  }
  const u = document.getElementById('portal-universe-stats');
  if (u) {
    const worlds = lore.bodies.filter((b) => b.kind === 'planet').length;
    u.textContent = join([
      [worlds, 'world', 'worlds'],
      [lore.characters.length, 'character', 'characters'],
      [lore.events.length, 'event', 'events'],
    ]);
  }
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

/** Faint background stars plus every lore system; fold routes radiate from Canopus. */
function starmap(svg: SVGSVGElement | null): void {
  if (!svg || !lore.systems.length) return;
  const defs = el('defs', {});
  const glow = el('radialGradient', { id: 'sm-glow' });
  glow.append(el('stop', { offset: '0', 'stop-color': '#ffd9a0', 'stop-opacity': 1 }), el('stop', { offset: '1', 'stop-color': '#ffd9a0', 'stop-opacity': 0 }));
  defs.append(glow);
  svg.append(defs);

  // Deterministic dust of background stars.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const dust = el('g', { class: 'sm-dust' });
  for (let i = 0; i < 140; i++) {
    dust.append(el('circle', { cx: (rnd() * 2200 - 1100).toFixed(0), cy: (rnd() * 2200 - 1100).toFixed(0), r: (2 + rnd() * 4).toFixed(1), fill: '#ece0c8', opacity: (0.15 + rnd() * 0.35).toFixed(2) }));
  }
  svg.append(dust);

  const canopus = lore.systems.find((s) => s.id === 'canopus') ?? lore.systems[0];
  const routes = el('g', { class: 'sm-routes' });
  for (const id of ['kaitain', 'delta-pavonis', 'ophiuchi-36b', 'junction', 'laoujin', 'thalim']) {
    const s = lore.systems.find((x) => x.id === id);
    if (!s) continue;
    const mx = (canopus.x + s.x) / 2 + (s.y - canopus.y) * 0.18;
    const my = (canopus.y + s.y) / 2 - (s.x - canopus.x) * 0.18;
    routes.append(el('path', { d: `M${canopus.x} ${canopus.y}Q${mx} ${my} ${s.x} ${s.y}`, class: 'sm-route' }));
  }
  svg.append(routes);

  const stars = el('g', { class: 'sm-stars' });
  lore.systems.forEach((s, i) => {
    const big = s.id === canopus.id;
    const g = el('g', { class: big ? 'sm-star sm-star--home' : 'sm-star', style: `--d:${((i * 0.37) % 4).toFixed(2)}s` });
    g.append(
      el('circle', { cx: s.x, cy: s.y, r: big ? 150 : 70, fill: 'url(#sm-glow)', opacity: big ? 0.4 : 0.16 }),
      el('circle', { cx: s.x, cy: s.y, r: big ? 26 : 13, fill: s.color }),
    );
    stars.append(g);
  });
  svg.append(stars);
  // Rings around Canopus (Arrakis's star).
  for (const r of [120, 210]) svg.append(el('circle', { cx: canopus.x, cy: canopus.y, r, class: 'sm-ring' }));
}
