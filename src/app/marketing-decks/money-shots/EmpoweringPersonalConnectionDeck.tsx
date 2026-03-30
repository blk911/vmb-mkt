"use client";

import { useCallback, useMemo, useState } from "react";

/** Slide 2 — client’s wider world (right of Client). */
const CLIENT_WORLD_LABELS = ["Friend", "Family", "Work", "Social", "Routine", "Events"] as const;

type SlideKind = "linear" | "client_world";

type SlideDef = {
  id: number;
  kind: SlideKind;
  eyebrow: string;
  headline: string;
  /** Small label in the diagram area (story beat). */
  slideTag: string;
  salonSubtext: string;
  clientSubtext: string;
  /** Shown on final reveal step for this slide (Slide 1 has no footer). */
  footer: string | null;
  maxRevealStep: number;
};

/**
 * Slide 1 = linear Salon → Client baseline + emphasis only.
 * Slide 2 = same base + client-world cluster (reserved Slide 3 = salon services — not in array yet).
 */
const SLIDES: SlideDef[] = [
  {
    id: 1,
    kind: "linear",
    eyebrow: "Current Reality",
    headline: "A salon owner serves a client. The relationship is linear — the next move belongs to the client.",
    slideTag: "Slide 1 · Linear relationship",
    salonSubtext: "offers service",
    clientSubtext: "chooses where to go",
    footer: null,
    /** Single build step so one Next advances to Slide 2 (was 2 steps and first Next only advanced reveal, not slide). */
    maxRevealStep: 0,
  },
  {
    id: 2,
    kind: "client_world",
    eyebrow: "Current Reality",
    headline:
      "The same Salon → Client line — now the client’s wider world comes into view: friend, family, work, and life beyond the visit.",
    slideTag: "Slide 2 · Client’s world",
    salonSubtext: "offers service",
    clientSubtext: "chooses where to go",
    footer:
      "The salon may serve the client, but the client’s next move belongs to a wider personal world outside the salon.",
    maxRevealStep: 2,
  },
];

export default function EmpoweringPersonalConnectionDeck() {
  const [slideIndex, setSlideIndex] = useState(0);
  const [revealStep, setRevealStep] = useState(0);

  const slide = SLIDES[slideIndex]!;
  const totalSlides = SLIDES.length;

  const handleNext = useCallback(() => {
    if (revealStep < slide.maxRevealStep) {
      setRevealStep((s) => s + 1);
      return;
    }
    if (slideIndex < totalSlides - 1) {
      setSlideIndex((i) => i + 1);
      setRevealStep(0);
    }
  }, [revealStep, slide.maxRevealStep, slideIndex, totalSlides]);

  const handleBack = useCallback(() => {
    if (revealStep > 0) {
      setRevealStep((s) => s - 1);
      return;
    }
    if (slideIndex > 0) {
      const prev = SLIDES[slideIndex - 1]!;
      setSlideIndex((i) => i - 1);
      setRevealStep(prev.maxRevealStep);
    }
  }, [revealStep, slideIndex]);

  const revealDots = useMemo(() => {
    const n = slide.maxRevealStep + 1;
    return Array.from({ length: n }, (_, i) => i);
  }, [slide.maxRevealStep]);

  const atStart = slideIndex === 0 && revealStep === 0;
  const atLastSlide = slideIndex >= totalSlides - 1;
  const atEndReveal = revealStep >= slide.maxRevealStep;
  const nextDisabled = atEndReveal && atLastSlide;

  return (
    <div className="rounded-2xl border border-neutral-200/90 bg-gradient-to-b from-white to-neutral-50/80 p-6 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] md:p-8">
      <div className="mb-6 flex flex-col gap-1 border-b border-neutral-200/80 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Empowering Personal Connection
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Slide {slideIndex + 1} of {totalSlides}
          </p>
        </div>
        <div className="flex items-center gap-1.5" aria-label="Reveal progress">
          {revealDots.map((i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i <= revealStep ? "w-5 bg-neutral-800" : "w-1.5 bg-neutral-300"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="relative min-h-[420px] overflow-hidden bg-white px-3 py-6 md:min-h-[520px] md:px-8 md:py-10">
        <RelationshipSlideCanvas slide={slide} revealStep={revealStep} />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200/80 pt-5">
        <button
          type="button"
          onClick={handleBack}
          disabled={atStart}
          aria-label="Previous step or slide"
          className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Back
        </button>
        <p className="text-center text-[11px] text-neutral-500 md:flex-1">
          {nextDisabled
            ? "End of this sequence — more slides coming later."
            : atEndReveal && !atLastSlide
              ? "Next goes to the next slide."
              : "Next advances each build step."}
        </p>
        <button
          type="button"
          onClick={handleNext}
          disabled={nextDisabled}
          aria-label="Next reveal or slide"
          className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function RelationshipSlideCanvas({ slide, revealStep }: { slide: SlideDef; revealStep: number }) {
  const isLinear = slide.kind === "linear";
  /** Linear slide: one frame with emphasized path (no separate reveal step). Client slide: emphasize from step 1. */
  const emphasizePath = slide.kind === "linear" ? true : revealStep >= 1;
  /** On Slide 2, cluster is part of the slide (not gated on step 2). Entering at revealStep 0 must still show it — see handleNext reset. */
  const showClientWorldCluster = slide.kind === "client_world";
  const showFooter = slide.kind === "client_world" && revealStep >= 2 && Boolean(slide.footer);

  return (
    <div className="mx-auto max-w-5xl">
      <p className="absolute right-4 top-4 max-w-[11rem] text-right text-[10px] font-medium uppercase tracking-wide text-neutral-400 md:right-8 md:max-w-none md:text-[11px]">
        {slide.slideTag}
      </p>

      <header className="mb-8 pr-24 text-left md:mb-10 md:pr-32">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500 md:text-sm">{slide.eyebrow}</p>
        <h2 className="mt-2 text-xl font-semibold leading-snug tracking-tight text-neutral-900 md:text-2xl lg:text-[1.65rem]">
          {slide.headline}
        </h2>
      </header>

      <div className="flex flex-col items-stretch gap-8 lg:flex-row lg:items-center lg:justify-center lg:gap-0">
        <div className="hidden min-w-0 shrink-0 lg:block lg:w-[min(1rem,3vw)]" aria-hidden />

        <div className="flex min-w-0 shrink-0 flex-col items-center justify-center gap-5 md:gap-6 lg:flex-row lg:gap-2 xl:gap-4">
          <SubjectNode roleLabel="Salon" title="Salon Owner" subtext={slide.salonSubtext} />
          <RelationshipConnector emphasized={emphasizePath} />
          <SubjectNode roleLabel="Client" title="Client" subtext={slide.clientSubtext} />
        </div>

        {isLinear ? (
          <div className="hidden w-full max-w-[9.5rem] shrink-0 lg:block lg:min-h-0" aria-hidden />
        ) : (
          <ClientWorldCluster visible={showClientWorldCluster} />
        )}
      </div>

      {slide.footer ? (
        <div
          className={`mx-auto mt-10 max-w-3xl text-center transition-all duration-500 ease-out md:mt-12 ${
            showFooter ? "opacity-100 translate-y-0" : "pointer-events-none max-h-0 overflow-hidden opacity-0"
          }`}
        >
          <p className="text-sm font-medium leading-relaxed text-neutral-800 md:text-base">{slide.footer}</p>
        </div>
      ) : null}
    </div>
  );
}

function SubjectNode({
  roleLabel,
  title,
  subtext,
}: {
  roleLabel: string;
  title: string;
  subtext: string;
}) {
  return (
    <div className="w-full max-w-[200px] shrink-0 rounded-xl bg-neutral-800 px-4 py-4 text-center shadow-md md:max-w-[220px] md:px-5 md:py-4">
      <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-neutral-400">{roleLabel}</p>
      <p className="mt-2 text-base font-semibold leading-tight text-white md:text-lg">{title}</p>
      <p className="mt-1.5 text-[11px] leading-snug text-neutral-400 md:text-xs">{subtext}</p>
    </div>
  );
}

function RelationshipConnector({ emphasized }: { emphasized: boolean }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center px-1 py-3 lg:px-2 lg:py-0"
      aria-hidden
    >
      <div className="flex items-center">
        <div
          className={`h-px origin-center rounded-full transition-all duration-300 md:w-14 lg:w-20 ${
            emphasized ? "w-12 bg-neutral-900" : "w-10 bg-neutral-400"
          }`}
        />
        <span
          className={`inline-block -translate-x-px text-lg leading-none transition-all duration-300 md:text-xl ${
            emphasized ? "scale-110 text-neutral-900" : "text-neutral-500"
          }`}
        >
          →
        </span>
      </div>
    </div>
  );
}

/**
 * Secondary cluster — smaller, lighter, offset from Client; does not share flex-grow with the main axis.
 */
function ClientWorldCluster({ visible }: { visible: boolean }) {
  return (
    <div className="mt-6 flex w-full shrink-0 flex-col justify-center self-center sm:pl-2 lg:mt-0 lg:ml-12 lg:w-auto lg:max-w-[9.5rem] xl:ml-16 xl:max-w-[10rem]">
      <div
        className={`transition-all duration-500 ease-out ${
          visible ? "translate-x-0 opacity-100" : "pointer-events-none max-h-0 translate-x-1 overflow-hidden opacity-0"
        }`}
        aria-hidden={!visible}
      >
        <p className="mb-1.5 text-[8px] font-medium uppercase tracking-[0.12em] text-neutral-400 md:text-[9px]">
          Client’s world
        </p>
        <ul className="space-y-2 border-l border-neutral-200/50 pl-2.5 md:space-y-2.5 md:pl-3">
          {CLIENT_WORLD_LABELS.map((label, i) => (
            <li
              key={label}
              className={`max-w-[8.5rem] rounded-md border border-neutral-200/40 bg-transparent px-1.5 py-0.5 text-[9px] font-normal leading-tight text-neutral-500 md:max-w-[9rem] md:text-[10px] ${
                i % 2 === 1 ? "ml-1.5 md:ml-2" : ""
              }`}
            >
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
