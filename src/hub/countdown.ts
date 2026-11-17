/**
 * Live countdown chip to Dune: Part Three (18 December 2026, viewer's local midnight).
 * Visual text ticks every second; the screen-reader text only changes once a day, so it
 * never chatters. After release it reads "Now in theatres".
 */
import { h } from '../shared/dom.ts';

const RELEASE = new Date(2026, 11, 18, 0, 0, 0);
const FILM = 'Dune: Part Three';

const pad = (n: number) => String(n).padStart(2, '0');

export function initCountdown(el: HTMLElement): void {
  const dot = h('span', { class: 'chip__dot', 'aria-hidden': 'true' });
  const label = h('span', { class: 'countdown__film' }, FILM);
  const time = h('span', { class: 'countdown__time', 'aria-hidden': 'true' });
  const spoken = h('span', { class: 'sr-only' });
  el.replaceChildren(dot, label, time, spoken);
  el.classList.add('chip', 'countdown');
  el.hidden = false;

  let lastSpoken = '';
  let timer = 0;

  const tick = () => {
    const ms = RELEASE.getTime() - Date.now();
    let visual: string;
    let sr: string;
    if (ms <= 0) {
      el.dataset.state = 'released';
      visual = 'Now in theatres';
      sr = `${FILM} is now in theatres.`;
      window.clearInterval(timer);
    } else {
      const s = Math.floor(ms / 1000);
      const d = Math.floor(s / 86400);
      const hh = Math.floor((s % 86400) / 3600);
      const mm = Math.floor((s % 3600) / 60);
      const ss = s % 60;
      visual = `${d}d ${pad(hh)}:${pad(mm)}:${pad(ss)}`;
      sr =
        d > 0
          ? `${FILM} opens in theatres in ${d} day${d === 1 ? '' : 's'}, on 18 December 2026.`
          : `${FILM} opens in theatres today.`;
    }
    time.textContent = visual;
    if (sr !== lastSpoken) {
      spoken.textContent = sr;
      lastSpoken = sr;
    }
  };

  const run = () => {
    window.clearInterval(timer);
    tick();
    if (RELEASE.getTime() > Date.now()) timer = window.setInterval(tick, 1000);
  };
  // No ticking in background tabs.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) window.clearInterval(timer);
    else run();
  });
  run();
}
