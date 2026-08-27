/**
 * Scroll reveals — one IntersectionObserver, zero dependencies.
 *
 * Replaces the per-element `ScrollTrigger` that `buildTween()` used to
 * create for every `[data-anim]` node. The homepage has ~60 of them and the
 * site ~90; each was a live trigger that ScrollTrigger re-measured on every
 * refresh and consulted on every scroll tick. All of them were fire-once
 * reveals, which is exactly what IntersectionObserver does natively, off
 * the main thread, for free.
 *
 * The motion itself lives in `styles/base/animation.css`. This file only:
 *   - copies the data-* modifiers onto custom properties the CSS reads
 *   - measures SVG path lengths for `draw`
 *   - adds `.is-in` when an element crosses the threshold, then unobserves
 *
 * Markup contract is unchanged — see the table in lib/animations.ts.
 *
 *   data-anim="fade-up|fade-in|scale-in|clip|stagger|draw"
 *   data-anim-delay="0.2"      seconds
 *   data-anim-duration="1.2"   seconds
 *   data-anim-stagger="0.08"   seconds between staggered children
 *   data-anim-start="top 70%"  viewport position that triggers it
 *
 * `parallax` is not handled here: it is scroll-scrubbed rather than
 * fire-once, and lives in lib/scroll-fx.ts.
 */

import { prefersReducedMotion } from "./motion";

/** Kinds this module owns. Anything else is left alone. */
const REVEAL_KINDS = new Set(["fade-up", "fade-in", "scale-in", "clip", "stagger", "draw"]);

/** Matches GSAP's old defaults, in seconds. */
const DEFAULT_DURATION = 0.9;
const DEFAULT_STAGGER = 0.08;

/**
 * Extra duration the old tweens added per kind, so timings stay identical
 * to the GSAP implementation rather than merely similar.
 */
const DURATION_BONUS: Record<string, number> = { clip: 0.2, draw: 0.4 };

/** `top 82%` was `DEFAULT_START`; as a bottom root margin that is -18%. */
const DEFAULT_ROOT_MARGIN = "0px 0px -18% 0px";

const seconds = (raw: string | undefined, fallback: number): number => {
  const parsed = raw ? parseFloat(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Translate a ScrollTrigger-style start string into an IO root margin.
 * Only the `top NN%` form was ever used, and only in the docs — but the
 * attribute is part of the documented markup contract, so it keeps working.
 */
function rootMarginFor(start: string | undefined): string {
  if (!start) return DEFAULT_ROOT_MARGIN;
  const match = /^top\s+(\d+(?:\.\d+)?)%$/.exec(start.trim());
  if (!match) return DEFAULT_ROOT_MARGIN;
  const bottom = 100 - parseFloat(match[1]);
  return `0px 0px ${-bottom}% 0px`;
}

/** Sample count for `screenLength()`. Straight lines need 1; curves want more. */
const SCREEN_SAMPLES = 32;

/**
 * Rendered length of a path, in CSS pixels.
 *
 * `vector-effect: non-scaling-stroke` lifts the whole stroke — dash pattern
 * included — out of the path's own user space and into the rendered one, so
 * `getTotalLength()` (user units) is the wrong number to hand
 * `stroke-dasharray`. Architecture's diagram is the well-behaved case: a
 * square `viewBox="0 0 360 360"`, uniform scale, no `vector-effect`, so the
 * two spaces agree and the measured length draws the line exactly.
 *
 * Inventory's `.flow-fan` is the case that broke. Its `viewBox="0 0 100 100"`
 * is stretched by `preserveAspectRatio="none"` into a 56x404 box, so the
 * outer `M0 11 L100 50` diagonal is 107 user units but renders 167px long —
 * and with the dash pattern living in rendered space, a 107px dash on a 167px
 * line stopped 60px short of the hub. The lines never reached the core, at
 * any viewport width.
 *
 * `pathLength` looks like the declarative fix and is not: Chromium accepts
 * the attribute (`path.pathLength.baseVal` reads back) but ignores its
 * normalisation while `non-scaling-stroke` is in effect — verified against a
 * real render, identical pixels with and without it.
 *
 * Sampled rather than solved analytically so this holds if a fan ever gets a
 * curve; every drawn stroke in the build today is a straight two-point line.
 */
function screenLength(geometry: SVGGeometryElement): number {
  const ctm = geometry.getScreenCTM();
  if (!ctm) return 0; // not rendered (the fans are display:none below 1024px)
  const total = geometry.getTotalLength();
  let length = 0;
  let previous: DOMPoint | null = null;
  for (let i = 0; i <= SCREEN_SAMPLES; i++) {
    const point = geometry.getPointAtLength((total * i) / SCREEN_SAMPLES).matrixTransform(ctm);
    if (previous) length += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }
  return length;
}

/**
 * `getTotalLength()` is a layout read, and there are 13 drawn strokes on
 * the inventory page alone. Batched into one pass so the reads coalesce
 * instead of interleaving with the custom-property writes below.
 */
function measureStrokes(elements: HTMLElement[]): void {
  const lengths = elements.map((el) => {
    const geometry = el as unknown as SVGGeometryElement;
    if (typeof geometry.getTotalLength !== "function") return 0;
    return getComputedStyle(el).vectorEffect === "non-scaling-stroke"
      ? screenLength(geometry)
      : geometry.getTotalLength();
  });
  elements.forEach((el, i) => {
    if (lengths[i]) el.style.setProperty("--draw-length", String(lengths[i]));
  });
}

/**
 * A rendered-space `--draw-length` goes stale when the box it was measured
 * in changes size — too short, and the gap this whole function exists to
 * close reopens at the end of an already-finished line. User-space lengths
 * are immune, so only the scaled strokes are re-measured, and only on
 * resize; there are seven of them on one page.
 */
function watchScaledStrokes(strokes: HTMLElement[]): void {
  const scaled = strokes.filter(
    (el) => getComputedStyle(el).vectorEffect === "non-scaling-stroke"
  );
  if (!scaled.length) return;

  let frame = 0;
  window.addEventListener(
    "resize",
    () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => measureStrokes(scaled));
    },
    { passive: true }
  );
}

export function initReveals(): void {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-anim]")).filter((el) =>
    REVEAL_KINDS.has(el.dataset.anim ?? "")
  );
  if (!nodes.length) return;

  // Under reduced motion Base.astro never sets `.js-ready`, so no
  // pre-animation state was ever applied and everything is already
  // visible. Nothing to do, and nothing to observe.
  if (prefersReducedMotion()) return;

  // No IntersectionObserver (very old browsers): show everything rather
  // than leaving the page permanently blank.
  if (!("IntersectionObserver" in window)) {
    nodes.forEach((el) => el.classList.add("is-in"));
    return;
  }

  const strokes: HTMLElement[] = [];

  for (const el of nodes) {
    const kind = el.dataset.anim!;
    const delay = seconds(el.dataset.animDelay, 0);
    const duration = seconds(el.dataset.animDuration, DEFAULT_DURATION) + (DURATION_BONUS[kind] ?? 0);

    // Written explicitly on every element, including the zero case: these
    // are inherited custom properties, so an unset delay on a nested
    // [data-anim] would otherwise pick up its ancestor's and fire late.
    el.style.setProperty("--anim-delay", `${delay * 1000}ms`);
    el.style.setProperty("--anim-duration", `${duration * 1000}ms`);

    if (kind === "stagger") {
      const step = seconds(el.dataset.animStagger, DEFAULT_STAGGER);
      el.style.setProperty("--anim-stagger", `${step * 1000}ms`);
    }

    if (kind === "draw") strokes.push(el);
  }

  if (strokes.length) {
    measureStrokes(strokes);
    watchScaledStrokes(strokes);
  }

  /**
   * What to actually watch for each element.
   *
   * `display: contents` elements generate no box at all, so they never
   * intersect anything and an observer on them would never fire — leaving
   * their children stuck at `opacity: 0` forever. `.pain-grid` is exactly
   * that (pain.css: it stays `contents` so its four cards place directly
   * into `.pain-diagram`'s grid, while data-anim="stagger" still targets
   * the wrapper). Watch the nearest ancestor that does generate a box, and
   * keep marking the original element so the CSS selectors still match.
   *
   * All the computed-style reads happen here, after every write above, so
   * this costs one layout flush at startup rather than one per element.
   */
  const watched = new Map<Element, HTMLElement[]>();

  for (const el of nodes) {
    let target: HTMLElement = el;
    while (getComputedStyle(target).display === "contents" && target.parentElement) {
      target = target.parentElement;
    }
    const group = watched.get(target);
    if (group) group.push(el);
    else watched.set(target, [el]);
  }

  // One observer per distinct start position. In practice that is exactly
  // one, since no markup overrides data-anim-start — but grouping keeps the
  // attribute honest without regressing to an observer per element.
  const observers = new Map<string, IntersectionObserver>();

  const observerFor = (margin: string): IntersectionObserver => {
    let observer = observers.get(margin);
    if (!observer) {
      observer = new IntersectionObserver(
        (entries, self) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            watched.get(entry.target)?.forEach((el) => el.classList.add("is-in"));
            self.unobserve(entry.target); // fire-once, same as `once: true`
          }
        },
        { rootMargin: margin, threshold: 0 }
      );
      observers.set(margin, observer);
    }
    return observer;
  };

  for (const [target, group] of watched) {
    observerFor(rootMarginFor(group[0].dataset.animStart)).observe(target);
  }
}

/**
 * Reveal a subtree that was hidden when `initReveals()` ran.
 *
 * The industry tab panels are `hidden` until clicked, so their staggered
 * children were never observed — the same trap the 2026-08-25 mistake-log
 * entry describes for ScrollTrigger measuring a `display: none` element as
 * zero-size. Islands call this after unhiding a panel.
 */
export function revealNow(root: HTMLElement): void {
  if (prefersReducedMotion()) return;
  const targets = root.matches("[data-anim]") ? [root] : [];
  targets.push(...Array.from(root.querySelectorAll<HTMLElement>("[data-anim]")));
  targets.forEach((el) => el.classList.add("is-in"));
}
