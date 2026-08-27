/**
 * Client boot — the single entry point Base.astro loads.
 *
 * Owns the load order and, more importantly, the decision about what a
 * given device is asked to download at all. Everything imported statically
 * here is zero-dependency and adds up to a couple of KB; GSAP is behind a
 * dynamic import that many visitors will never trigger.
 *
 * Order of business:
 *   1. reveals + marquee + scroll effects, immediately — these are the
 *      motion the page actually needs to look right, and none of them
 *      costs a network request beyond this bundle;
 *   2. GSAP's two signature moments, only if the device can afford them,
 *      and only once the page has finished loading and the main thread
 *      has gone quiet.
 */

import { initReveals } from "./reveal";
import { initScrollFx } from "./scroll-fx";
import { marquee } from "./marquee";
import { isLiteDevice, prefersReducedMotion, whenIdle } from "./motion";

function initMarquee(): void {
  const viewport = document.getElementById("trust-marquee");
  const track = document.getElementById("trust-track");
  if (viewport && track) {
    marquee(viewport, track, { caption: document.getElementById("trust-caption") });
  }
}

/**
 * Load the GSAP layer — or decide not to.
 *
 * Skipped entirely when the user asked for less motion, and when the
 * device or connection says this is a bad trade. On a phone with Save-Data
 * on, or a 2G-class connection, or a genuinely low-end handset, the site
 * never fetches an animation engine at all: the reveals, marquee, flow
 * scrub and hero entrance are all still there, because none of them needs
 * one any more.
 *
 * The desktop case fires early rather than at idle, because the hero
 * scramble is an *entrance* — arriving two seconds late would mean
 * scrambling a headline the reader has already finished reading. The
 * scramble's own `document.fonts.ready` race (lib/animations.ts) keeps it
 * bounded from there.
 */
function initEnhancements(): void {
  if (prefersReducedMotion() || isLiteDevice()) return;

  const load = () => {
    import("./animations")
      .then((mod) => mod.initEnhancements())
      .catch(() => {
        /* Nothing to recover: every effect in that module is additive,
           and the page is complete and correct without it. */
      });
  };

  // Only fetch the engine if this page actually has something for it to do.
  // Without this check every page loaded 68 KB of GSAP at idle — including
  // /about, /contact, /why-us and all six module pages, none of which has a
  // comparison canvas, and none of which scrambles anything on a phone.
  const heroScramble =
    document.querySelector(".hero-title .h-line") !== null &&
    window.matchMedia("(min-width: 768px)").matches;
  const hasComparison = document.querySelector(".cmp-canvas") !== null;

  if (!heroScramble && !hasComparison) return;

  // The hero case fires now rather than at idle; the comparison is below
  // the fold, so it can wait for a quiet main thread.
  if (heroScramble) load();
  else whenIdle(load);
}

export function boot(): void {
  initReveals();
  initMarquee();
  initScrollFx();
  initEnhancements();
}
