import { useEffect, useRef, useState } from "react";
import { animateReveal } from "@/lib/motion";

/**
 * "One grid, three states" (legacy index.html:4156, "PLATFORM — one grid,
 * three states"): default grid -> a tile expands the shell into a detail
 * panel -> every other tile collapses to just its icon in the left rail.
 * All the STATE 1/2/3 CSS already ships in platform.css/responsive.css —
 * this only owns the state machine (which tile is expanded) and the
 * outside-click / Escape / focus-return behaviour, ported 1:1 from
 * legacy's collapsePlatform()/expandPlatform().
 *
 * Renders only the supporting-modules shell (.platform-shell): Inventory
 * and Logistics are plain links rendered statically by Platform.astro and
 * never enter this state machine (legacy: "no panel here — they're core
 * modules").
 */

interface Image {
  src: string;
  width: number;
  height: number;
}

export interface PlatformModule {
  id: string;
  name: string;
  blurb: string;
  panelText: string;
  benefits: string[];
  icon: string;
  tile: Image;
  preview: Image;
}

interface Props {
  modules: PlatformModule[];
}

export default function PlatformExplorer({ modules }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const panelRefs = useRef<Record<string, HTMLElement | null>>({});

  function open(id: string) {
    setExpandedId(id);
  }

  function collapse(focusId: string | null) {
    setExpandedId(null);
    if (focusId) tileRefs.current[focusId]?.focus();
  }

  // The rail restructure (grid-template-columns) is a plain CSS transition
  // (platform.css) — no JS measurement step, so there's no window where a
  // tile is mid-flight and can misfire an outside-click/no-op (see the
  // 2026-08-27 mistake log entry this replaced).
  useEffect(() => {
    if (expandedId) {
      const panel = panelRefs.current[expandedId];
      if (panel) animateReveal(panel);
    }
  }, [expandedId]);

  useEffect(() => {
    if (!expandedId) return;

    function onDocClick(event: MouseEvent) {
      if (shellRef.current && !shellRef.current.contains(event.target as Node)) {
        collapse(null);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") collapse(expandedId);
    }

    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [expandedId]);

  return (
    <div
      className={expandedId ? "platform-shell is-expanded" : "platform-shell"}
      id="platform-shell"
      ref={shellRef}
    >
      <div className="platform-rail">
        <div className="platform-grid" id="platform-grid" data-anim="stagger" data-anim-stagger="0.05">
          {modules.map((m) => (
            <button
              key={m.id}
              ref={(el) => {
                tileRefs.current[m.id] = el;
              }}
              className="platform-tile"
              type="button"
              data-module={m.id}
              aria-expanded={expandedId === m.id}
              aria-controls={`platform-panel-${m.id}`}
              onClick={() => (expandedId === m.id ? collapse(null) : open(m.id))}
            >
              <span className="platform-tile-body">
                <span className="platform-icon">
                  <svg
                    className="icon"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{ __html: m.icon }}
                  />
                </span>
                <span className="platform-tile-title">{m.name}</span>
                <span className="platform-tile-text">{m.blurb}</span>
                <span className="platform-tile-cta">
                  Explore
                  <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 12h15M13 6l6 6-6 6" />
                  </svg>
                </span>
              </span>
              <span className="platform-tile-media">
                <img src={m.tile.src} width={m.tile.width} height={m.tile.height} alt="" loading="lazy" />
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="platform-stage" id="platform-stage">
        {modules.map((m) => (
          <article
            key={m.id}
            ref={(el) => {
              panelRefs.current[m.id] = el;
            }}
            className="platform-panel"
            id={`platform-panel-${m.id}`}
            role="region"
            aria-label={m.name.toUpperCase()}
            hidden={expandedId !== m.id}
          >
            <button className="platform-close" type="button" aria-label="Close" onClick={() => collapse(m.id)}>
              <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            <div>
              <div className="platform-panel-head">
                <span className="platform-panel-icon">
                  <svg
                    className="icon icon--lg"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{ __html: m.icon }}
                  />
                </span>
                <h3 className="platform-panel-title">{m.name.toUpperCase()}</h3>
              </div>
              <p className="platform-panel-text">{m.panelText}</p>
              <ul className="platform-benefits">
                {m.benefits.map((benefit) => (
                  <li key={benefit}>
                    <svg className="icon icon--xs" viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M8 12.5l2.5 2.5L16 9.5" />
                    </svg>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
              {/* <a className="platform-demo" href="/contact">
                Request a demo
              </a> */}
            </div>
            <aside className="platform-preview">
              {/* lazy + decoding=async matters more here than it looks:
                  there are nine of these 700px previews, one per panel, and
                  every panel is `hidden` until its tile is clicked. Without
                  `loading="lazy"` the browser fetches all nine up front —
                  ~120 KB on a phone for panels most visitors never open. */}
              <img
                className="platform-preview-img"
                src={m.preview.src}
                width={m.preview.width}
                height={m.preview.height}
                alt={`${m.name} module interface`}
                loading="lazy"
                decoding="async"
              />
            </aside>
          </article>
        ))}
      </div>
    </div>
  );
}
