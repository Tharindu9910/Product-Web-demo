/**
 * Trust marquee — horizontal scroller with centre-proximity zoom and a live
 * caption naming whichever logo is nearest the middle.
 *
 * Zero dependencies (it was always a rAF loop, never a GSAP tween), so it
 * stays on the critical path and starts with the page instead of waiting
 * for an engine to download.
 *
 * ── Why this was rewritten ──────────────────────────────────────────────
 * The original frame loop called `getBoundingClientRect()` on every logo in
 * the track and then immediately wrote `transform`, `zIndex`, `--t` and a
 * `filter` back onto that same element — a read after a write, per element,
 * per frame. With ~30 logos after cloning that is ~30 forced synchronous
 * layouts every single frame, for as long as the section is on screen. It
 * also repainted every logo's `filter` each frame even when the value had
 * not visibly changed. This was the main cause of the reported scroll lag.
 *
 * The rewrite keeps the maths and the look identical, but:
 *   - every geometry read happens once per measure (init + resize), never
 *     inside the frame loop, so a frame is now pure writes;
 *   - each logo's rest state is written once, not re-written every frame;
 *   - `--t`, `zIndex` and `filter` only get written when the quantised value
 *     actually changes, which for the ~80% of logos sitting far from centre
 *     means never;
 *   - phones and low-end devices run the proximity pass at ~30fps rather
 *     than 60, which is indistinguishable at this speed and halves the cost;
 *   - reduced motion skips the loop entirely instead of running the whole
 *     per-frame pass with the offset frozen.
 */

import { isCoarsePointer, isLiteDevice, prefersReducedMotion } from "./motion";

interface MarqueeOptions {
  /** px/second, matches legacy's TRUST_SPEED. */
  speed?: number;
  /** Names whatever logo is nearest centre. Omit for a plain scroller. */
  caption?: HTMLElement | null;
  /** How close to dead-centre (0-1, cosine-eased) before it's "featured". */
  captionThreshold?: number;
}

interface LogoState {
  el: HTMLElement;
  disc: HTMLElement | null;
  name: string;
  /** Centre of this logo in the track's own untransformed space. */
  centre: number;
  /** Last written proximity, quantised — the write-skipping key. */
  lastT: number;
}

/** Proximity is only visible to ~2 decimals; below this, skip the write. */
const T_EPSILON = 0.01;

export function marquee(
  viewport: HTMLElement,
  track: HTMLElement,
  options: MarqueeOptions = {}
): () => void {
  const speed = options.speed ?? 42;
  const caption = options.caption ?? null;
  const captionThreshold = options.captionThreshold ?? 0.6;

  const reduced = prefersReducedMotion();
  const hoverCapable = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const originals = Array.from(track.children) as HTMLElement[];
  if (!originals.length) return () => {};

  let zoom = 1.7;
  let logos: LogoState[] = [];
  let setWidth = 0;
  let viewportLeft = 0;
  let viewportCentre = 0;
  let range = 1;

  /**
   * Clone until the track is wide enough that the loop's seam never enters
   * view. The original re-read `track.scrollWidth` on every iteration of the
   * while loop — up to 40 forced layouts at startup. The count is simple
   * arithmetic once the originals have been measured once.
   */
  function fill() {
    track.querySelectorAll("[data-clone]").forEach((node) => node.remove());

    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const originalsWidth = originals.reduce((width, el) => width + el.offsetWidth + gap, 0);
    if (originalsWidth <= 0) return;

    // Enough copies to cover the viewport twice over on top of the originals.
    const needed = Math.ceil((viewport.offsetWidth * 2) / originalsWidth);
    const copies = Math.min(Math.max(needed, 1), 8);

    const batch = document.createDocumentFragment();
    for (let i = 0; i < copies; i += 1) {
      for (const original of originals) {
        const clone = original.cloneNode(true) as HTMLElement;
        clone.dataset.clone = "1";
        clone.setAttribute("aria-hidden", "true");
        batch.appendChild(clone);
      }
    }
    track.appendChild(batch);
  }

  /**
   * Every geometry read for the whole animation happens here. Positions are
   * stored relative to the viewport's own left edge and to the track's
   * current transform, so the frame loop can derive a screen position with
   * pure arithmetic.
   */
  function measure() {
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    zoom = parseFloat(getComputedStyle(viewport).getPropertyValue("--trust-zoom")) || 1.7;
    setWidth = originals.reduce((width, el) => width + el.offsetWidth + gap, 0);

    const viewportBox = viewport.getBoundingClientRect();
    viewportLeft = viewportBox.left;
    viewportCentre = viewportBox.width / 2;
    range = viewportBox.width / 3.6;

    logos = (Array.from(track.children) as HTMLElement[]).map((el) => {
      const box = el.getBoundingClientRect();
      return {
        el,
        disc: el.firstElementChild as HTMLElement | null,
        name: el.getAttribute("data-name") ?? "",
        // Subtract the transform currently on the track so `centre` is in
        // untransformed track space and stays valid as `offset` changes.
        centre: box.left + box.width / 2 - viewportLeft - offset,
        lastT: -1,
      };
    });
  }

  /** Rest state, written once per measure rather than every frame. */
  function paintRest() {
    for (const logo of logos) {
      logo.el.style.transform = "";
      logo.el.style.zIndex = "10";
      logo.el.style.setProperty("--t", "0");
      if (logo.disc) logo.disc.style.filter = "saturate(0.55) brightness(0.82)";
      logo.lastT = 0;
    }
  }

  function paint(logo: LogoState, t: number) {
    if (Math.abs(t - logo.lastT) < T_EPSILON) return;
    logo.lastT = t;

    logo.el.style.transform = `translateY(${-10 * t}px) scale(${1 + (zoom - 1) * t})`;
    logo.el.style.zIndex = String(10 + Math.round(t * 100));
    logo.el.style.setProperty("--t", t.toFixed(3));

    if (logo.disc) {
      logo.disc.style.filter = `saturate(${0.55 + 0.45 * t}) brightness(${0.82 + 0.22 * t})`;
    }
  }

  let offset = -1;

  // Gentle slow-down while pointing at it — only where hover means something.
  let speedMul = 1;
  let targetMul = 1;
  const onEnter = () => {
    targetMul = 0.15;
  };
  const onLeave = () => {
    targetMul = 1;
  };

  let featured = "";
  let captionTimer = 0;

  function updateCaption(best: LogoState | null, bestT: number) {
    if (!caption || !best || bestT <= captionThreshold) return;
    if (best.name === featured) return;
    featured = best.name;
    caption.style.opacity = "0";
    window.clearTimeout(captionTimer);
    captionTimer = window.setTimeout(() => {
      caption.textContent = featured;
      caption.style.opacity = "1";
    }, 140);
  }

  // Phones and low-end hardware get half the frame budget. At 42 px/second
  // the difference is not perceptible, and it halves the loop's cost.
  const frameInterval = isCoarsePointer() || isLiteDevice() ? 1000 / 30 : 0;

  let running = false;
  let frameId = 0;
  let last = 0;
  let lastPaint = 0;

  function frame(now: number) {
    if (!running) return;
    frameId = window.requestAnimationFrame(frame);

    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;

    speedMul += (targetMul - speedMul) * Math.min(1, dt * 6);

    offset += speed * speedMul * dt;
    if (offset >= 0) offset -= setWidth;

    // The one unavoidable write per frame: the track's own scroll position.
    track.style.transform = `translate3d(${offset}px, 0, 0)`;

    if (frameInterval && now - lastPaint < frameInterval) return;
    lastPaint = now;

    let best: LogoState | null = null;
    let bestT = 0;

    for (const logo of logos) {
      const distance = Math.abs(viewportCentre - (logo.centre + offset));

      // Far from centre: collapse straight to rest. `paint` skips the write
      // entirely when the logo is already resting, which is the common case.
      if (distance >= range) {
        paint(logo, 0);
        continue;
      }

      let t = 1 - distance / range;
      t = 0.5 - 0.5 * Math.cos(t * Math.PI); // smooth cosine falloff
      paint(logo, t);

      if (t > bestT) {
        bestT = t;
        best = logo;
      }
    }

    updateCaption(best, bestT);
  }

  function start() {
    if (running || reduced) return;
    running = true;
    last = 0;
    lastPaint = 0;
    frameId = window.requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    window.cancelAnimationFrame(frameId);
  }

  let resizeTimer = 0;
  const onResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      fill();
      measure();
      paintRest();
    }, 150);
  };

  fill();
  measure();
  paintRest();

  // Reduced motion: park the track at its resting offset and stop. The old
  // version still ran the entire per-frame proximity pass with the offset
  // frozen, which is all of the cost and none of the motion.
  if (reduced) {
    track.style.transform = `translate3d(${offset}px, 0, 0)`;
    return () => {};
  }

  window.addEventListener("resize", onResize, { passive: true });

  if (hoverCapable) {
    viewport.addEventListener("pointerenter", onEnter);
    viewport.addEventListener("pointerleave", onLeave);
  }

  // Never run while off screen or in a background tab.
  let inView = false;
  let observer: IntersectionObserver | null = null;

  const onVisibility = () => {
    if (document.hidden) stop();
    else if (inView) start();
  };

  if ("IntersectionObserver" in window) {
    observer = new IntersectionObserver(
      (entries) => {
        inView = entries[0].isIntersecting;
        if (inView && !document.hidden) start();
        else stop();
      },
      { threshold: 0 }
    );
    observer.observe(viewport);
  } else {
    inView = true;
    start();
  }

  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    stop();
    window.clearTimeout(resizeTimer);
    window.clearTimeout(captionTimer);
    observer?.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("resize", onResize);
    if (hoverCapable) {
      viewport.removeEventListener("pointerenter", onEnter);
      viewport.removeEventListener("pointerleave", onLeave);
    }
  };
}
