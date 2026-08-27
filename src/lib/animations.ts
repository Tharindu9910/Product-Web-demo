/**
 * GSAP layer — LAZY. Nothing in this file is on the critical path.
 *
 * ── Read this before adding anything here ───────────────────────────────
 * This module used to be the whole animation system: 158 KB of GSAP +
 * ScrollTrigger + Flip + ScrambleText, imported synchronously by
 * Base.astro AND by Nav.astro AND by two React islands, i.e. downloaded
 * and parsed on every page load on every device before a single reveal
 * could run.
 *
 * It is now the opposite: the default path uses no GSAP at all, and this
 * module is dynamically imported only when a device can afford the two
 * effects that genuinely need an engine. Everything else moved to
 * zero-dependency modules and CSS:
 *
 *   scroll reveals (data-anim)    lib/reveal.ts   + base/animation.css
 *   trust marquee                 lib/marquee.ts
 *   flow scrub, parallax, pulses  lib/scroll-fx.ts + sections/architecture.css
 *   hero entrance                 sections/hero.css
 *   nav open/close                base/responsive.css
 *   island click reveals          lib/motion.ts   + base/animation.css
 *
 * So: a new effect belongs in one of those, not here. Add to this file only
 * if it truly cannot be expressed without GSAP — and remember that whatever
 * you add will not run at all on low-end devices or slow connections.
 *
 * ── Markup contract (unchanged, handled by lib/reveal.ts) ───────────────
 *
 *   <div data-anim="fade-up">                    slides up + fades in
 *   <div data-anim="fade-in">                    fades only
 *   <div data-anim="scale-in">                   scales up from 96%
 *   <div data-anim="clip">                       wipes in from bottom
 *   <div data-anim="stagger">                    children animate in sequence
 *   <svg><path data-anim="draw" /></svg>         line draws itself
 *   <div data-anim="parallax" data-speed="0.2">  slow drift on scroll
 *
 *   data-anim-delay="0.2"      seconds
 *   data-anim-duration="1.2"   seconds
 *   data-anim-start="top 70%"  trigger position
 *   data-anim-stagger="0.08"   gap between staggered children
 */

import { gsap } from "gsap";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";

gsap.registerPlugin(ScrambleTextPlugin);

const EASE = "power3.out";

/**
 * Hero H1 — the headline arrives as unresolved data and settles into a
 * sentence, rather than the generic masked-line-reveal every other
 * marketing site uses. Only the H1 scrambles; the eyebrow, lede, CTAs,
 * proof row and image are a CSS entrance now (sections/hero.css) and have
 * already played by the time this runs.
 *
 * Markup is plain text in `.h-line` spans (Hero.astro), not SplitText
 * fragments — ScrambleText overwrites a target's textContent outright, so
 * it needs an untouched text node, and this also means the served
 * HTML/SEO/no-JS text is never at the mercy of a runtime split.
 *
 * Layout-shift guard: a scrambled run isn't a fixed anagram of the source
 * string — ScrambleText re-randomises the *arrangement* every frame, so
 * even with a character pool matched to the source (poolFrom) a mid-tween
 * frame can render fractionally wider and wrap a `.h-line` to a second
 * row, shoving the rest of the hero down and back. `.is-scrambling` forces
 * `white-space: nowrap` (hero.css) for exactly the tween's duration so a
 * line can never change row count while scrambling; the `.hero-title`
 * min-height lock below is a second, redundant guard against the same
 * failure mode, not the fix on its own.
 */
function buildHero(): void {
  // Desktop only, and only where motion is welcome. Matches the old
  // matchMedia branches: below 768px the hero entrance is CSS and the
  // headline never scrambled anyway.
  if (!window.matchMedia("(min-width: 768px)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const title = document.querySelector<HTMLElement>(".hero-title");
  const lines = title ? Array.from(title.querySelectorAll<HTMLElement>(".h-line")) : [];
  if (!title || !lines.length) return;

  // Cache the real strings before ScrambleText ever touches textContent.
  lines.forEach((el) => (el.dataset.text = (el.textContent ?? "").trim()));

  function poolFrom(str: string): string {
    const unique = Array.from(new Set(str.replace(/[^A-Za-z]/g, "").split("")));
    return unique.length >= 6 ? unique.join("") : "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  }

  function scrambleTo(tl: gsap.core.Timeline, el: HTMLElement, duration: number, speed: number, position: number) {
    const text = el.dataset.text ?? "";
    tl.to(
      el,
      {
        duration,
        ease: "none",
        scrambleText: { text, chars: poolFrom(text), speed, revealDelay: duration * 0.2, tweenLength: false },
        onStart: () => el.classList.add("is-scrambling"),
        onComplete: () => el.classList.remove("is-scrambling"),
      },
      position
    );
  }

  // Text on screen is already correct either way — this only decides when
  // the scramble starts, so a stalled font load can never stall it.
  Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 600))]).then(() => {
    // Lock the box BEFORE any mutation: zero layout shift regardless of
    // how the scrambled glyph run wraps mid-tween.
    title.style.minHeight = `${title.offsetHeight}px`;

    const tl = gsap.timeline({
      defaults: { ease: EASE },
      onComplete: () => (title.style.minHeight = ""),
    });

    scrambleTo(tl, lines[0], 0.7, 0.42, 0.05);
    if (lines[1]) scrambleTo(tl, lines[1], 0.7, 0.42, 0.32);
    if (lines[2]) scrambleTo(tl, lines[2], 0.7, 0.42, 0.59);
  });
}

/**
 * Comparison — the WITHOUT panel's scattered documents start bunched at the
 * canvas centre and fly apart into their authored --x/--y positions (CSS
 * already owns those; this only adds a translation on top, so it composes
 * safely with the existing `transform: rotate(var(--r))`). As they land,
 * every record ID visible on the page (WH-4471, SO-9021, DN-773, INV-2208,
 * plus the WITH panel's SO-9021 pill) scrambles into its real value — same
 * string that's already in the DOM, never invented. Reads as "one order,
 * scattered across systems" resolving into "one order, one record."
 *
 * Triggered by IntersectionObserver rather than ScrollTrigger: it is a
 * fire-once entrance, which is all IO does, and it lets this module drop
 * the ScrollTrigger import (~45 KB) entirely.
 */
function buildComparisonScatter(): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.querySelector<HTMLElement>(".cmp-canvas");
  const stage = document.querySelector<HTMLElement>(".cmp-stage");
  const layout = document.querySelector<HTMLElement>(".cmp-layout");
  if (!canvas || !stage || !layout || !("IntersectionObserver" in window)) return;

  const pieces = Array.from(canvas.querySelectorAll<HTMLElement>(".cmp-note, .cmp-doc, .cmp-chat"));
  const idPattern = /[A-Z]{2,4}-\d{3,4}/;
  const idEls = Array.from(
    document.querySelectorAll<HTMLElement>(".cmp-note-band span, .cmp-doc-title, .cmp-dark-pill--so")
  ).filter((el) => idPattern.test(el.textContent ?? ""));

  const observer = new IntersectionObserver(
    (entries, self) => {
      if (!entries[0].isIntersecting) return;
      self.disconnect();

      const canvasBox = stage.getBoundingClientRect();
      const centre = {
        x: canvasBox.left + canvasBox.width / 2,
        y: canvasBox.top + canvasBox.height / 2,
      };

      // Measure every piece's own offset from the canvas centre before any
      // tween starts — fromTo accepts per-target functions, which is what
      // lets one staggered call animate N different start points.
      const offsets = pieces.map((el) => {
        const box = el.getBoundingClientRect();
        return {
          x: centre.x - (box.left + box.width / 2),
          y: centre.y - (box.top + box.height / 2),
        };
      });

      gsap.fromTo(
        pieces,
        {
          x: (i: number) => offsets[i].x,
          y: (i: number) => offsets[i].y,
          scale: 0.72,
          opacity: 0,
        },
        {
          x: 0,
          y: 0,
          scale: 1,
          opacity: 1,
          duration: 0.7,
          ease: EASE,
          stagger: { each: 0.08, from: "random" },
          // Drop the inline transform GSAP leaves behind once it has
          // landed, so nothing keeps a compositor layer for a finished
          // one-shot and the authored CSS rotate is the only transform
          // left standing.
          clearProps: "x,y,scale",
        }
      );

      const scrambleTl = gsap.timeline({ delay: 0.3 });
      idEls.forEach((el, i) => {
        scrambleTl.to(
          el,
          {
            duration: 0.9,
            scrambleText: {
              chars: "upperCase",
              speed: 0.5,
              revealDelay: 0.2,
              text: el.textContent ?? "",
            },
          },
          i * 0.07
        );
      });
    },
    { rootMargin: "0px 0px -30% 0px", threshold: 0 }
  );

  observer.observe(layout);
}

/**
 * Entry point for the lazy chunk. Called by lib/boot.ts, never directly —
 * boot.ts owns the "should this device load GSAP at all" decision.
 */
export function initEnhancements(): void {
  buildHero();
  buildComparisonScatter();
}
