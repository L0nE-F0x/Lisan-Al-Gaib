/**
 * Original hand-drawn heraldry for the hub, on a 64x64 stroke grid.
 * These are the project's own designs (not reproductions of any film or game artwork).
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

type Shape =
  | { d: string; fill?: boolean; w?: number }
  | { c: [number, number, number]; fill?: boolean; w?: number };

const f2 = (n: number) => Math.round(n * 100) / 100;

/** Star polygon with alternating radii (lion's mane, gear teeth...). */
function star(cx: number, cy: number, points: number, rOuter: number, rInner: number, rot = -Math.PI / 2): string {
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = rot + (i * Math.PI) / points;
    d += `${i === 0 ? 'M' : 'L'}${f2(cx + Math.cos(a) * r)} ${f2(cy + Math.sin(a) * r)}`;
  }
  return d + 'Z';
}

/** Square-toothed gear outline. */
function gear(cx: number, cy: number, teeth: number, rOuter: number, rInner: number): string {
  let d = '';
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step - Math.PI / 2;
    const pts: [number, number][] = [
      [a - step * 0.5, rInner],
      [a - step * 0.22, rInner],
      [a - step * 0.16, rOuter],
      [a + step * 0.16, rOuter],
      [a + step * 0.22, rInner],
    ];
    for (const [ang, r] of pts) d += `${d ? 'L' : 'M'}${f2(cx + Math.cos(ang) * r)} ${f2(cy + Math.sin(ang) * r)}`;
  }
  return d + 'Z';
}

/** One strand of a vertical helix. */
function helix(phase: number): string {
  let d = '';
  for (let y = 8; y <= 56; y += 2) {
    const x = 32 + Math.sin((y - 8) * 0.2 + phase) * 11;
    d += `${d ? 'L' : 'M'}${f2(x)} ${y}`;
  }
  return d;
}

function helixRungs(): string {
  let d = '';
  for (let y = 11; y <= 54; y += 5) {
    const a = 32 + Math.sin((y - 8) * 0.2) * 11;
    const b = 32 + Math.sin((y - 8) * 0.2 + Math.PI) * 11;
    if (Math.abs(a - b) > 6) d += `M${f2(a)} ${y}L${f2(b)} ${y}`;
  }
  return d;
}

/** Worm mouth: a ring of inward teeth. Also the favicon motif. */
function wormTeeth(cx: number, cy: number, n: number, r0: number, r1: number): string {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const w = Math.PI / n * 0.7;
    d += `M${f2(cx + Math.cos(a - w) * r0)} ${f2(cy + Math.sin(a - w) * r0)}`;
    d += `L${f2(cx + Math.cos(a) * r1)} ${f2(cy + Math.sin(a) * r1)}`;
    d += `L${f2(cx + Math.cos(a + w) * r0)} ${f2(cy + Math.sin(a + w) * r0)}`;
  }
  return d;
}

export const SIGILS: Record<string, { label: string; shapes: Shape[] }> = {
  hawk: {
    label: 'A hawk with raised wings',
    shapes: [
      { d: 'M32 18C29.5 22 28.5 29 29.5 37L32 44L34.5 37C35.5 29 34.5 22 32 18Z' },
      { d: 'M32 18C30.2 16.4 30 12.8 32 11C33.8 12.6 34.6 14.8 33.4 16.8' },
      { d: 'M32 11L29.4 13.6L31.4 14' },
      { d: 'M29.5 26C24 20 16 15 7 14C11 18 13 21 14 25C10 25 8 27 7 29C13 28 18 29 22 31C19 32 17 34 16 36C21 34 25 33 29.5 33' },
      { d: 'M34.5 26C40 20 48 15 57 14C53 18 51 21 50 25C54 25 56 27 57 29C51 28 46 29 42 31C45 32 47 34 48 36C43 34 39 33 34.5 33' },
      { d: 'M30.2 42L27 53L32 49.5L37 53L33.8 42' },
      { d: 'M29.6 37.5L25 41M34.4 37.5L39 41' },
    ],
  },
  griffin: {
    label: 'A griffin head with crest and wing',
    shapes: [
      { d: 'M45 21C41 14 32 13 26 17C22 19.5 17 20.5 11 22.5C15 24.5 18 25 20.5 25C18.5 27.5 18.5 30.5 21 32C22.5 29 24 27.6 26.5 27.4' },
      { d: 'M26.5 27.4C28 34 26 41 20 49H37C41 42 44 33 45 21' },
      { c: [32, 20.5, 1.8], fill: true },
      { d: 'M38.5 15.5L44 7L44.5 16.5M42.5 18L51 12.5L47.5 21' },
      { d: 'M42 30C48 27 53 22 57 14C56.5 22 53 28.5 46.5 33.5' },
      { d: 'M42.5 37C49 35.5 54.5 32 58.5 26C57 33 52 38.5 44 41' },
      { d: 'M22 49L18 55M28 49L26.5 56M34 49L34.5 56' },
    ],
  },
  lion: {
    label: 'A lion face within a sunburst mane',
    shapes: [
      { d: star(32, 33, 14, 27, 20) },
      { d: 'M32 20C25 20 21 25 22 32C23 38 27 43 32 46C37 43 41 38 42 32C43 25 39 20 32 20Z' },
      { d: 'M26.5 26.5C28.5 25.5 30.5 26 32 27.6C33.5 26 35.5 25.5 37.5 26.5' },
      { d: 'M26 31L29.6 31.6M38 31L34.4 31.6' },
      { d: 'M29.8 35.6L32 38.4L34.2 35.6Z', fill: true },
      { d: 'M32 38.4V41M28.8 41.6C30.6 42.6 33.4 42.6 35.2 41.6' },
    ],
  },
  crysknife: {
    label: 'A curved crysknife',
    shapes: [
      { d: 'M33 5C41.5 14.5 42.5 29 35.6 41.5H29.6C34.2 30 34.8 17 33 5Z' },
      { d: 'M33.6 12C36.4 20 36.4 29 33.2 37', w: 1.1 },
      { d: 'M24.5 41.5H40.5' },
      { d: 'M30.2 41.5L30.8 52.5M35 41.5L34.4 52.5' },
      { d: 'M30.5 45.2H34.7M30.7 49H34.5', w: 1.1 },
      { c: [32.6, 56, 3] },
    ],
  },
  'inner-eye': {
    label: 'A veiled eye beneath a hood',
    shapes: [
      { d: 'M13 47C13 27 21 12.5 32 10C43 12.5 51 27 51 47' },
      { d: 'M20 47C20 31 25 19.5 32 17C39 19.5 44 31 44 47' },
      { d: 'M22 36C26 30.5 38 30.5 42 36C38 41.5 26 41.5 22 36Z' },
      { c: [32, 36, 3.6] },
      { c: [32, 36, 1.2], fill: true },
      { d: 'M9 52H55' },
    ],
  },
  navigator: {
    label: 'A four-pointed star crossed by a folded path',
    shapes: [
      { c: [32, 32, 24] },
      { d: 'M32 13L35 29L51 32L35 35L32 51L29 35L13 32L29 29Z' },
      { d: 'M14 47C24 42 40 22 50 17', w: 1.1 },
      { c: [14, 47, 2.2], fill: true },
      { c: [50, 17, 2.2], fill: true },
    ],
  },
  helix: {
    label: 'A twisting double helix',
    shapes: [
      { d: helix(0) },
      { d: helix(Math.PI) },
      { d: helixRungs(), w: 1.1 },
    ],
  },
  gear: {
    label: 'A machine gear around an aperture',
    shapes: [
      { d: gear(32, 32, 10, 25, 20) },
      { c: [32, 32, 11] },
      { d: 'M32 25L38 36H26Z' },
    ],
  },
  worm: {
    label: 'The ringed mouth of a sandworm',
    shapes: [
      { c: [32, 32, 25] },
      { c: [32, 32, 18] },
      { d: wormTeeth(32, 32, 14, 18, 9.5), w: 1.3 },
    ],
  },
};

/** Hub-local mapping from faction id to an original sigil. */
export const FACTION_SIGIL: Record<string, keyof typeof SIGILS> = {
  atreides: 'hawk',
  harkonnen: 'griffin',
  corrino: 'lion',
  fremen: 'crysknife',
  'bene-gesserit': 'inner-eye',
  'spacing-guild': 'navigator',
  'bene-tleilax': 'helix',
  ixians: 'gear',
  'atreides-empire': 'worm',
};

export function sigil(name: string, opts: { size?: number; decorative?: boolean } = {}): SVGSVGElement | null {
  const def = SIGILS[name];
  if (!def) return null;
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', '0 0 64 64');
  const size = String(opts.size ?? 64);
  s.setAttribute('width', size);
  s.setAttribute('height', size);
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.6');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  if (opts.decorative === false) {
    s.setAttribute('role', 'img');
    s.setAttribute('aria-label', def.label);
  } else {
    s.setAttribute('aria-hidden', 'true');
  }
  for (const shape of def.shapes) {
    let el: SVGElement;
    if ('c' in shape) {
      el = document.createElementNS(SVG_NS, 'circle');
      el.setAttribute('cx', String(shape.c[0]));
      el.setAttribute('cy', String(shape.c[1]));
      el.setAttribute('r', String(shape.c[2]));
    } else {
      el = document.createElementNS(SVG_NS, 'path');
      el.setAttribute('d', shape.d);
    }
    if (shape.fill) {
      el.setAttribute('fill', 'currentColor');
      el.setAttribute('stroke', 'none');
    }
    if (shape.w) el.setAttribute('stroke-width', String(shape.w));
    s.appendChild(el);
  }
  return s;
}

/** Serialise a sigil to standalone SVG markup (used by the dev preview script only). */
export function sigilMarkup(name: string, color = '#f0a44a'): string {
  const def = SIGILS[name];
  if (!def) return '';
  const body = def.shapes
    .map((sh) => {
      const paint = sh.fill ? `fill="${color}" stroke="none"` : '';
      const w = sh.w ? `stroke-width="${sh.w}"` : '';
      return 'c' in sh
        ? `<circle cx="${sh.c[0]}" cy="${sh.c[1]}" r="${sh.c[2]}" ${paint} ${w}/>`
        : `<path d="${sh.d}" ${paint} ${w}/>`;
    })
    .join('');
  return `<svg xmlns="${SVG_NS}" viewBox="0 0 64 64" width="256" height="256" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect width="64" height="64" fill="#0a0705"/>${body}</svg>`;
}
