import { useLayoutEffect, useRef, useState } from "react";
import { moduleIcon } from "@/lib/module-icons";
import { animateReveal } from "@/lib/motion";
import { withBase } from "@/lib/base";

/**
 * ARIA tabs, ported from legacy's selectTab() (index.html:4213 "INDUSTRY —
 * tabs with arrow-key navigation"): roving tabindex, click or Left/Right/
 * Home/End to switch, only the selected tab in the Tab order.
 */

interface Image {
  src: string;
  width: number;
  height: number;
}

interface IndustryClient {
  name: string;
  place: string;
}

export interface Industry {
  id: string;
  name: string;
  image: Image;
  stack: string[];
  changes: string[];
  clients?: IndustryClient[];
  cta: string;
}

interface Props {
  industries: Industry[];
}

export default function IndustryTabs({ industries }: Props) {
  const [selected, setSelected] = useState(industries[0]?.id);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const colRefs = useRef<Record<string, HTMLElement | null>>({});
  const mounted = useRef(false);

  function selectTab(id: string, moveFocus: boolean) {
    setSelected(id);
    if (moveFocus) tabRefs.current[id]?.focus();
  }

  // The first panel's entrance is already handled by its scroll-triggered
  // data-anim="stagger" — skip this on mount so it doesn't double-animate,
  // and only crossfade the content on an actual tab switch.
  useLayoutEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const cols = colRefs.current[selected];
    if (cols) animateReveal(cols);
  }, [selected]);

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: Industry | undefined;
    if (event.key === "ArrowRight") next = industries[(index + 1) % industries.length];
    else if (event.key === "ArrowLeft") next = industries[(index - 1 + industries.length) % industries.length];
    else if (event.key === "Home") next = industries[0];
    else if (event.key === "End") next = industries[industries.length - 1];
    if (next) {
      event.preventDefault();
      selectTab(next.id, true);
    }
  }

  return (
    <>
      <div className="ind-tablist" role="tablist" aria-label="Built for how you actually operate.">
        {industries.map((ind, i) => (
          <button
            key={ind.id}
            ref={(el) => {
              tabRefs.current[ind.id] = el;
            }}
            className="ind-tab"
            type="button"
            role="tab"
            id={`tab-${ind.id}`}
            aria-controls={`panel-${ind.id}`}
            aria-selected={selected === ind.id}
            tabIndex={selected === ind.id ? undefined : -1}
            onClick={() => selectTab(ind.id, false)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {ind.name.toUpperCase()}
          </button>
        ))}
      </div>

      {industries.map((ind, i) => (
        <div
          key={ind.id}
          className="ind-panel"
          role="tabpanel"
          id={`panel-${ind.id}`}
          aria-labelledby={`tab-${ind.id}`}
          tabIndex={0}
          hidden={selected !== ind.id}
        >
          <img
            className="ind-panel-art"
            src={ind.image.src}
            width={ind.image.width}
            height={ind.image.height}
            alt=""
            aria-hidden="true"
            loading="lazy"
          />
          <div
            className="ind-cols"
            ref={(el) => {
              colRefs.current[ind.id] = el;
            }}
            data-anim={i === 0 ? "stagger" : undefined}
            data-anim-stagger="0.08"
          >
            <div>
              <h3 className="ind-col-title">Recommended stack</h3>
              <div className="ind-stack">
                {ind.stack.map((name) => (
                  <p className="ind-module" key={name}>
                    <svg
                      className="icon"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      dangerouslySetInnerHTML={{ __html: moduleIcon[name] }}
                    />
                    {name}
                  </p>
                ))}
              </div>
            </div>
            <div>
              <h3 className="ind-col-title">What changes</h3>
              <ul className="ind-changes">
                {ind.changes.map((change) => (
                  <li key={change}>
                    <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M8 12.5l2.5 2.5L16 9.5" />
                    </svg>
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="ind-col-title">Who already runs this</h3>
              {ind.clients ? (
                <div className="ind-clients">
                  {ind.clients.map((client) => (
                    <div className="ind-client" key={client.name}>
                      <span className="ind-client-logo">LOGO</span>
                      <span>
                        <span className="ind-client-name">{client.name}</span>
                        <br />
                        <span className="ind-client-place">{client.place}</span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="ind-placeholder">PENDING</div>
              )}
            </div>
          </div>
          <div className="ind-cta">
            <a href={withBase("/contact")}>{ind.cta}</a>
          </div>
        </div>
      ))}
    </>
  );
}
