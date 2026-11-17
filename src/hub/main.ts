/**
 * Hub (landing page) entry. Static content lives in /index.html so it paints instantly
 * and works without JavaScript; this module enhances it.
 */
import '../shared/styles/index.css';
import './hub.css';
import { FAN_DISCLAIMER, mountShell } from '../shared/shell.ts';
import { initHero } from './hero.ts';
import { initCountdown } from './countdown.ts';
import { initBooks } from './books.ts';
import { initPowers } from './powers.ts';
import { initWorm } from './worm.ts';
import { initPortals } from './portals.ts';

mountShell({ page: 'hub', bed: 'desert', transparentUntilScroll: true });

const disclaimer = document.getElementById('fan-disclaimer');
if (disclaimer) disclaimer.textContent = FAN_DISCLAIMER;

const hero = initHero();
const countdown = document.getElementById('countdown');
if (countdown) initCountdown(countdown);

const safely = (name: string, fn: () => void) => {
  try {
    fn();
  } catch (err) {
    console.error(`[hub] ${name} failed`, err);
  }
};

safely('books', () => initBooks(document.getElementById('books-mount')!));
safely('powers', () => initPowers(document.getElementById('powers-mount')!));

/** Initialise below-the-fold modules only when they approach the viewport. */
function whenNear(el: Element | null, fn: () => void, margin = '400px 0px'): void {
  if (!el) return;
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        safely(el.id || 'section', fn);
      }
    },
    { rootMargin: margin },
  );
  io.observe(el);
}

const worm = document.getElementById('shai-hulud');
whenNear(worm, () => initWorm(worm!));
const archives = document.getElementById('archives');
whenNear(archives, () => initPortals(archives!, hero), '900px 0px');

// Scroll reveals (content is visible by default without JS or with reduced motion).
const revealIO = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('is-in');
        revealIO.unobserve(e.target);
      }
    }
  },
  { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
);
document.querySelectorAll('.reveal').forEach((el) => revealIO.observe(el));
document.documentElement.classList.add('hub-ready');
