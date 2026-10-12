"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import styles from "./TargetsUI.module.css";

type FilterMode = "automatic" | "open" | "closed";

export default function CollapsibleFilters({
  children,
  summary,
}: {
  children: ReactNode;
  summary: ReactNode;
}) {
  const [mode, setMode] = useState<FilterMode>("automatic");
  const [stickyTop, setStickyTop] = useState(8);
  const cardRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const bodyId = useId();
  const titleId = useId();
  const expanded = mode !== "closed";

  useEffect(() => {
    const navigation = document.querySelector<HTMLElement>("[data-app-navigation]");
    if (!navigation) return;

    const measure = () => setStickyTop(navigation.getBoundingClientRect().height + 8);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(navigation);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // An explicit Open keeps the card open until Close, including while scrolling.
    if (mode !== "automatic") return;

    let previousY = Math.max(0, window.scrollY);
    let downwardTravel = 0;
    const onScroll = () => {
      const y = Math.max(0, window.scrollY);
      const delta = y - previousY;
      previousY = y;

      // Never hide a focused field or dismiss an active native select/picker.
      if (delta <= 0 || bodyRef.current?.contains(document.activeElement)) {
        downwardTravel = 0;
        return;
      }

      downwardTravel += delta;
      if (downwardTravel >= 48 && cardRef.current && cardRef.current.getBoundingClientRect().top <= stickyTop + 1) {
        setMode("closed");
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [mode, stickyTop]);

  return (
    <section
      ref={cardRef}
      className={styles.toolbar}
      aria-labelledby={titleId}
      style={{ "--target-toolbar-top": `${stickyTop}px` } as CSSProperties}
    >
      <div className={styles.toolbarHeader}>
        <div className={styles.toolbarHeading}>
          <h2 id={titleId} className={styles.toolbarTitle}>Filters</h2>
          <div className={styles.toolbarSummary}>{summary}</div>
        </div>
        <button
          type="button"
          className={`${styles.btn} ${styles.toolbarToggle}`}
          aria-expanded={expanded}
          aria-controls={bodyId}
          aria-label={expanded ? "Close filters" : "Open filters"}
          onClick={() => setMode(expanded ? "closed" : "open")}
        >
          {expanded ? "Close" : "Open"}
          <span aria-hidden="true">{expanded ? "⌃" : "⌄"}</span>
        </button>
      </div>
      {/* Keep controls mounted so closing never resets values or list selections. */}
      <div ref={bodyRef} id={bodyId} className={styles.toolbarBody} hidden={!expanded}>
        {children}
      </div>
    </section>
  );
}
