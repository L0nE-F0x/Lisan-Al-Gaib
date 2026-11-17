/**
 * Site shell shared by every page: skip link, header with navigation, sound toggle,
 * mobile menu, film grain, and soft page transitions that are safe with the Back button.
 *
 * Usage (first thing in each page entry):
 *   import '../shared/styles/index.css';
 *   import { mountShell } from '../shared/shell.ts';
 *   mountShell({ page: 'arrakis', mainId: 'main' });
 */
import { audio, type Bed } from './audio.ts';
import { h, icon, ICONS } from './dom.ts';
import { onPrefs, reducedMotion } from './prefs.ts';

export type PageId = 'hub' | 'arrakis' | 'universe';

export const SITE_NAME = 'Lisan al-Gaib';
export const SITE_TAGLINE = 'Imperial Archives';

export const FAN_DISCLAIMER =
  'An unofficial, non-commercial fan project inspired by the novels of Frank Herbert. ' +
  'Dune and related names are trademarks of their respective owners. No affiliation with or endorsement by ' +
  'Herbert Properties LLC, Legendary Entertainment, Warner Bros. or any licensee is implied. ' +
  'All artwork and sound on this site are original or procedurally generated.';

const NAV: { id: PageId; label: string; href: string; transition: string }[] = [
  { id: 'hub', label: 'Archives', href: '/', transition: 'Returning to the Archives' },
  { id: 'arrakis', label: 'Arrakis', href: '/arrakis/', transition: 'Planetary uplink — Arrakis' },
  { id: 'universe', label: 'Known Universe', href: '/universe/', transition: 'Fold-space routing — Known Universe' },
];

export interface ShellOptions {
  page: PageId;
  /** id of the main landmark to target with the skip link. */
  mainId?: string;
  /** Ambient bed for this page. */
  bed?: Bed;
  /** Header starts transparent and turns solid after scrolling (hub). Apps keep it solid. */
  transparentUntilScroll?: boolean;
}

export interface Shell {
  header: HTMLElement;
  /** Slot on the right of the header for page-specific tools (before the sound button). */
  tools: HTMLElement;
  navigate(href: string, label?: string): void;
}

export function mountShell(opts: ShellOptions): Shell {
  document.documentElement.dataset.page = opts.page;

  const skip = h('a', { class: 'skip-link', href: `#${opts.mainId ?? 'main'}` }, 'Skip to content');

  // ---- sound toggle ----
  const soundBtn = h('button', {
    class: 'icon-btn',
    type: 'button',
    'aria-pressed': String(audio.enabled),
    'aria-label': 'Sound',
    title: 'Sound (off by default)',
  });
  const renderSound = (on: boolean) => {
    soundBtn.replaceChildren(icon(on ? ICONS.soundOn : ICONS.soundOff));
    soundBtn.setAttribute('aria-pressed', String(on));
  };
  renderSound(audio.enabled);
  soundBtn.addEventListener('click', () => {
    audio.toggle();
  });
  onPrefs((p) => renderSound(p.sound));
  audio.setBed(opts.bed ?? 'desert');

  // ---- nav ----
  const navId = 'site-nav';
  const nav = h('nav', { class: 'site-nav', id: navId, 'aria-label': 'Primary', 'data-open': 'false' });
  for (const item of NAV) {
    const a = h('a', { href: item.href, 'data-transition': item.transition }, item.label);
    if (item.id === opts.page) a.setAttribute('aria-current', 'page');
    nav.appendChild(a);
  }

  const menuBtn = h('button', {
    class: 'icon-btn menu-btn',
    type: 'button',
    'aria-controls': navId,
    'aria-expanded': 'false',
    'aria-label': 'Menu',
  }, icon(ICONS.menu));
  const setMenu = (open: boolean) => {
    nav.dataset.open = String(open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.replaceChildren(icon(open ? ICONS.close : ICONS.menu));
  };
  menuBtn.addEventListener('click', () => setMenu(nav.dataset.open !== 'true'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.dataset.open === 'true') {
      setMenu(false);
      menuBtn.focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (nav.dataset.open === 'true' && !nav.contains(e.target as Node) && !menuBtn.contains(e.target as Node)) setMenu(false);
  });

  const tools = h('div', { class: 'site-header__tools' });
  const brand = h(
    'a',
    { class: 'brand', href: '/', 'aria-label': `${SITE_NAME} — home` },
    h('span', { class: 'brand__name' }, SITE_NAME),
    h('span', { class: 'brand__tag' }, SITE_TAGLINE),
  );
  const header = h('header', { class: 'site-header', 'data-solid': String(!opts.transparentUntilScroll) }, brand, nav, tools);
  tools.append(soundBtn, menuBtn);

  // ---- transition overlay ----
  const transText = h('div', { class: 'page-transition__text' });
  const transition = h('div', { class: 'page-transition', 'aria-hidden': 'true', 'data-active': 'false' }, transText);

  // ---- film grain (tiny generated tile; no animation) ----
  const grain = h('div', { class: 'fx-grain', 'aria-hidden': 'true' });
  grain.style.setProperty('--grain-url', `url(${grainTile()})`);

  document.body.prepend(skip, header);
  document.body.append(grain, transition);

  if (opts.transparentUntilScroll) {
    const update = () => (header.dataset.solid = String(window.scrollY > 40));
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  // Reset the overlay when the page is restored from the back/forward cache.
  window.addEventListener('pageshow', () => {
    transition.dataset.active = 'false';
  });

  const navigate = (href: string, label?: string) => {
    if (reducedMotion()) {
      location.href = href;
      return;
    }
    transText.textContent = label ?? 'Routing';
    transition.dataset.active = 'true';
    audio.sfx('whoosh');
    window.setTimeout(() => (location.href = href), 340);
  };

  // Soft transitions for internal page links; modifier clicks keep native behaviour.
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    const samePage = url.pathname === location.pathname;
    if (samePage) return; // hash / query on same page: let the browser handle it
    e.preventDefault();
    setMenu(false);
    navigate(url.href, a.dataset.transition);
  });

  return { header, tools, navigate };
}

/** 128x128 monochrome noise tile as a data URL, generated once per page load. */
function grainTile(): string {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

/** Lightweight toast for transient announcements (also read by screen readers). */
let toastRegion: HTMLElement | null = null;
export function toast(content: string | Node, ms = 4500): void {
  if (!toastRegion) {
    toastRegion = h('div', { class: 'toast-region', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(toastRegion);
  }
  const t = h('div', { class: 'toast panel' }, content);
  toastRegion.appendChild(t);
  window.setTimeout(() => t.remove(), ms);
  while (toastRegion.children.length > 3) toastRegion.firstElementChild?.remove();
}
