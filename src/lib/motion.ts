/**
 * Shared motion primitives — zero dependencies, safe on the critical path.
 *
 * Everything in this file must stay free of GSAP. That is the whole point:
 * a phone on a weak connection should get working nav, reveals and marquee
 * without first downloading a 158 KB animation engine. GSAP still exists,
 * in lib/animations.ts, but it is now lazily imported and only for the few
 * signature moments that genuinely need it.
 *
 * If you are about to `import { gsap } from "gsap"` here: don't. Put it in
 * lib/animations.ts behind `loadEnhancements()` instead.
 */

export const prefersReducedMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

type ExtendedNavigator = Navigator & {
  connection?: NetworkInformation;
  deviceMemory?: number;
};

/**
 * "Lite" devices get the reveals and nothing else — no scrubbing, no
 * looping ambience, and no GSAP downloaded at all.
 *
 * Any one network signal is decisive on its own, because the cost there is
 * bytes the user is explicitly trying not to spend. The hardware signals
 * are deliberately ANDed: `hardwareConcurrency <= 4` alone matches plenty
 * of perfectly capable mid-range phones, and `deviceMemory` is absent on
 * Safari entirely, so either one alone would misfire constantly. Both at
 * once is a real low-end device.
 *
 * Absent APIs fall back to the capable values — never punish a browser for
 * not telling us about itself.
 */
let liteCache: boolean | null = null;
export function isLiteDevice(): boolean {
  if (liteCache !== null) return liteCache;

  const nav = navigator as ExtendedNavigator;
  const conn = nav.connection;

  const slowNetwork = conn?.saveData === true || /^(slow-)?2g$/.test(conn?.effectiveType ?? "");
  const weakCpu = (nav.hardwareConcurrency ?? 8) <= 4;
  const lowMemory = (nav.deviceMemory ?? 8) <= 4;

  liteCache = slowNetwork || (weakCpu && lowMemory);
  return liteCache;
}

/** Coarse pointers are phones and tablets: halve the marquee's frame budget. */
export const isCoarsePointer = (): boolean =>
  window.matchMedia("(pointer: coarse)").matches;

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
};

/**
 * Run after the page has finished loading AND the main thread is free.
 * Used to keep every non-essential import off the critical path — images
 * and fonts get the network to themselves until the page is usable.
 */
export function whenIdle(fn: () => void, timeout = 2500): void {
  const schedule = () => {
    const ric = (window as IdleWindow).requestIdleCallback;
    if (ric) ric(fn, { timeout });
    else window.setTimeout(fn, 200);
  };

  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });
}

/* ------------------------------------------------------------------
   One shared scroll driver.

   Previously every scroll-driven effect was its own ScrollTrigger, and
   the ~90 reveal triggers meant ScrollTrigger re-measured a lot of DOM
   on every refresh. Now: a single passive listener, rAF-coalesced, and
   subscribers just read their own numbers. Adding an effect costs one
   closure, not one listener.
   ------------------------------------------------------------------ */

type ScrollHandler = () => void;

const handlers = new Set<ScrollHandler>();
let queued = false;

function flush() {
  queued = false;
  handlers.forEach((handler) => handler());
}

function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(flush);
}

/**
 * Subscribe to rAF-coalesced scroll/resize. Runs `handler` once up front so
 * a subscriber never has to duplicate its own initial-position logic.
 * Returns an unsubscribe function.
 */
export function onScrollFrame(handler: ScrollHandler): () => void {
  if (handlers.size === 0) {
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
  }
  handlers.add(handler);
  handler();

  return () => {
    handlers.delete(handler);
    if (handlers.size === 0) {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    }
  };
}

/** Clamp helper — replaces gsap.utils.clamp for the scrub maths. */
export const clamp = (value: number, min = 0, max = 1): number =>
  value < min ? min : value > max ? max : value;

/* ------------------------------------------------------------------
   Click-driven helpers, previously GSAP tweens in lib/animations.ts.
   Both are now CSS, so importing them from a React island or from
   Nav.astro's inline script no longer drags the engine along.
   ------------------------------------------------------------------ */

/**
 * Fade + rise for content that appears on click rather than on scroll (a
 * freshly opened platform panel, a newly selected industry tab). The class
 * is removed and re-added so a rapid second call restarts cleanly, which
 * is what the old `fromTo` bought us.
 */
export function animateReveal(el: HTMLElement): void {
  if (prefersReducedMotion()) return;
  el.classList.remove("is-revealing");
  void el.offsetWidth; // force a reflow so the animation restarts
  el.classList.add("is-revealing");
}

/**
 * Mobile nav open/close.
 *
 * Deliberately a no-op now: `.nav-links` / `.nav-links.is-open` already
 * carry the opacity+visibility end states in responsive.css, and that file
 * now transitions between them. Kept as an exported function so Nav.astro's
 * call site stays unchanged, and because the 2026-08-27 mistake-log entry
 * is specifically about this handler firing on desktop — a CSS transition
 * scoped inside the `max-width: 1023px` block cannot leak the way the old
 * GSAP inline `autoAlpha` styles did.
 */
export function animateNavToggle(): void {
  /* handled entirely by CSS — see base/responsive.css */
}
