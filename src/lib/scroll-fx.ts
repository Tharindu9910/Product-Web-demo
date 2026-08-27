/**
 * Scroll-driven and ambient effects — zero dependencies.
 *
 * These were three separate ScrollTrigger/GSAP systems. None of them needed
 * an engine: two are a linear map from "where is this element in the
 * viewport" to a number, and the third is a fixed loop that CSS can run on
 * its own. Moving them here is what lets the GSAP bundle become a lazy,
 * skippable import rather than a hard dependency of every page load.
 *
 * All three share the single rAF-coalesced scroll driver in lib/motion.ts,
 * so the page has one passive scroll listener rather than one per effect.
 */

import { clamp, isLiteDevice, onScrollFrame, prefersReducedMotion } from "./motion";

/* ------------------------------------------------------------------
   Connected Flow — scroll-scrubbed.

   The record travels the rail exactly as far as the reader has scrolled
   into `.flow-diagram`; scrolling back up un-lights it in the same place.
   `--travel`/`--fade` are the custom properties flow.css already transitions
   on, set small here so each segment responds within a frame or two of the
   scroll rather than visibly lagging behind it. Those CSS transitions are
   also what supplies the smoothing that ScrollTrigger's `scrub: 0.6` used
   to add — which is why dropping scrub costs nothing visually.

   Deliberately still writing `left`/`top` percentages for the travelling
   head rather than a transform: that is what flow.css transitions and what
   its own `max-width: 767px` block flips from one axis to the other. The
   diagram is delicate (see the mistake log) and the win from changing it
   would be marginal — seven absolutely-positioned dots, only while this one
   section is on screen. The real fix applied here is skipping writes whose
   value has not changed, which is most of them on most frames.
   ------------------------------------------------------------------ */

interface Segment {
  fill: HTMLElement;
  glow: HTMLElement;
  head: HTMLElement;
  /** Last written progress, so an unchanged frame writes nothing. */
  last: number;
}

/** Sub-pixel progress changes are invisible; skip the style write. */
const P_EPSILON = 0.004;

function buildFlowScroll(stage: HTMLElement): void {
  const nodes = Array.from(stage.querySelectorAll<HTMLElement>(".flow-node"));
  const segEls = Array.from(stage.querySelectorAll<HTMLElement>(".flow-seg"));
  if (!nodes.length || segEls.length !== nodes.length - 1) return;

  stage.style.setProperty("--travel", "110ms");
  stage.style.setProperty("--fade", "180ms");

  const segments: Segment[] = segEls.map((seg) => ({
    fill: seg.querySelector<HTMLElement>(".flow-seg-fill")!,
    glow: seg.querySelector<HTMLElement>(".flow-seg-glow")!,
    head: seg.querySelector<HTMLElement>(".flow-seg-head")!,
    last: -1,
  }));

  // flow.css's own mobile breakpoint — below it the rail runs top-to-bottom
  // and every fill/glow/head axis flips from X to Y (flow.css §max-width:767px).
  const vertical = window.matchMedia("(max-width: 767px)");

  nodes[0].classList.add("is-lit"); // the record always starts at Sales Order

  if (prefersReducedMotion()) {
    // Resting state is the connected one — no scroll subscription at all.
    nodes.forEach((node) => node.classList.add("is-lit"));
    segments.forEach((seg) => {
      seg.fill.style.transform = vertical.matches
        ? "translateX(-1px) scaleY(1)"
        : "translateY(-1px) scaleX(1)";
      seg.glow.style.opacity = "0";
      seg.head.style.opacity = "0";
    });
    return;
  }

  const trigger = stage.closest<HTMLElement>(".flow-diagram") ?? stage;

  onScrollFrame(() => {
    const box = trigger.getBoundingClientRect();
    const vh = window.innerHeight;

    // Same window ScrollTrigger described as start "top 78%" / end
    // "bottom 55%": progress runs from the element's top reaching 78% of
    // the viewport to its bottom reaching 55% of it.
    const span = vh * 0.23 + box.height;
    const progress = clamp(span > 0 ? (vh * 0.78 - box.top) / span : 0);

    const raw = progress * segments.length;
    const axis = vertical.matches;

    segments.forEach((seg, i) => {
      const p = clamp(raw - i);
      if (Math.abs(p - seg.last) < P_EPSILON) return;
      seg.last = p;

      seg.fill.style.transform = axis
        ? `translateX(-1px) scaleY(${p})`
        : `translateY(-1px) scaleX(${p})`;
      seg.glow.style.transform = axis
        ? `translateX(-6px) scaleY(${p})`
        : `translateY(-6px) scaleX(${p})`;

      const travelling = p > 0 && p < 1;
      seg.glow.style.opacity = travelling ? "1" : "0";
      seg.head.style.opacity = travelling ? "1" : "0";

      if (travelling) {
        if (axis) {
          seg.head.style.top = `${p * 100}%`;
          seg.head.style.removeProperty("left");
        } else {
          seg.head.style.left = `${p * 100}%`;
          seg.head.style.removeProperty("top");
        }
      }

      nodes[i + 1].classList.toggle("is-lit", p >= 1);
    });
  });
}

/* ------------------------------------------------------------------
   Parallax — slow drift on scroll.

   `translate` rather than `transform`, so it composes with any transform
   the section already authored instead of overwriting it. Percentages on
   `translate` resolve against the element's own height, exactly as GSAP's
   `yPercent` did, so the drift distance is unchanged.
   ------------------------------------------------------------------ */

function buildParallax(el: HTMLElement): void {
  const speed = parseFloat(el.dataset.speed ?? "") || 0.15;
  let last = -1;

  onScrollFrame(() => {
    const box = el.getBoundingClientRect();
    const vh = window.innerHeight;

    // ScrollTrigger's "top bottom" → "bottom top": the full pass through.
    const span = vh + box.height;
    const progress = clamp(span > 0 ? (vh - box.top) / span : 0);
    const shift = progress * speed * 100;

    if (Math.abs(shift - last) < 0.05) return;
    last = shift;
    el.style.translate = `0 ${shift.toFixed(2)}%`;
  });
}

/* ------------------------------------------------------------------
   Architecture — ambient core→node pulses.

   Small orange dots travel the spokes on a continuous loop, reading as
   "currently syncing" rather than a static diagram. Spoke endpoints are
   read off the existing `data-anim="draw"` <line> elements (their own
   x2/y2), so nothing needs hand-authored coordinates in the markup.

   Was six infinite GSAP tweens animating the `cx`/`cy` ATTRIBUTES — an
   attribute write per dot per frame, each forcing the SVG to re-render,
   and each dot carries a `drop-shadow` filter that repaints with it. It is
   now one CSS keyframe animation per dot, with the endpoint passed in as a
   custom property; the main thread does nothing at all once it is set up.

   Still paused off-screen and in a background tab — an infinite loop
   nobody is looking at is pure battery cost — but that is now a single
   `animation-play-state` toggle rather than killing and rebuilding tweens.
   ------------------------------------------------------------------ */

const CORE_X = 180;
const CORE_Y = 180;

function buildArchitecturePulses(): void {
  if (prefersReducedMotion() || isLiteDevice()) return;

  const svg = document.querySelector<SVGSVGElement>(".arch-diagram-lines");
  const lines = svg?.querySelectorAll<SVGLineElement>('line[data-anim="draw"]');
  if (!svg || !lines?.length) return;

  Array.from(lines).forEach((line, i) => {
    const x2 = parseFloat(line.getAttribute("x2") ?? String(CORE_X));
    const y2 = parseFloat(line.getAttribute("y2") ?? String(CORE_Y));

    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("r", "3");
    dot.setAttribute("class", "arch-pulse");
    dot.setAttribute("cx", String(CORE_X));
    dot.setAttribute("cy", String(CORE_Y));
    dot.style.setProperty("--pulse-x", `${x2 - CORE_X}px`);
    dot.style.setProperty("--pulse-y", `${y2 - CORE_Y}px`);
    dot.style.animationDelay = `${i * 0.5}s`;
    svg.appendChild(dot);
  });

  svg.classList.add("is-pulsing");

  let inView = false;

  const sync = () => {
    svg.classList.toggle("is-paused", !inView || document.hidden);
  };

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        inView = entries[0].isIntersecting;
        sync();
      },
      { threshold: 0 }
    );
    observer.observe(svg);
  } else {
    inView = true;
  }

  sync();
  document.addEventListener("visibilitychange", sync);
}

/* ------------------------------------------------------------------ */

/** Wired once from Base.astro, on the critical path. */
export function initScrollFx(): void {
  const flowStage = document.querySelector<HTMLElement>(".flow-stage");
  if (flowStage) buildFlowScroll(flowStage);

  if (!prefersReducedMotion()) {
    document
      .querySelectorAll<HTMLElement>('[data-anim="parallax"]')
      .forEach((el) => buildParallax(el));
  }

  buildArchitecturePulses();
}
