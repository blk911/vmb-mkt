"use client";

import { useCallback, useMemo, useState } from "react";

/** Slide 1 — client’s wider world (right of Client). */
const CLIENT_WORLD_LABELS = ["Friend", "Family", "Work", "Social", "Routine", "Events"] as const;

/** Slide 2 — salon-side services (left of Salon). */
const SALON_SERVICE_LABELS = [
  "Hair",
  "Spa / Skin",
  "Nails",
  "Wax",
  "Brows",
  "Lashes",
  "Massage",
  "Mani / Pedi",
  "Color",
  "Extensions",
] as const;

type SlideVariant = "client_world" | "salon_services";

type SlideDef = {
  id: number;
  variant: SlideVariant;
  eyebrow: string;
  headline: string;
  /** Small label in the diagram area (story beat). */
  slideTag: string;
  salonSubtext: string;
  clientSubtext: string;
  footer: string;
  maxRevealStep: number;
};

const SLIDES: SlideDef[] = [
  {
    id: 1,
    variant: "client_world",
    eyebrow: "Current Reality",
    headline: "A salon owner serves a client. The relationship is linear — the next move belongs to the client.",
    slideTag: "Slide 1 · Linear relationship",
    salonSubtext: "offers service",
    clientSubtext: "chooses where to go",
    footer:
      "The salon may serve the client, but the client’s next move belongs to a wider personal world outside the salon.",
    maxRevealStep: 2,
  },
  {
    id: 2,
    variant: "salon_services",
    eyebrow: "Same relationship, different lens",
    headline:
      "The client stays in focus. On the salon side, many service options appear — yet the salon is still only one path among the client’s choices.",
    slideTag: "Slide 2 · Salon is just an option",
    salonSubtext: "offers service",
    clientSubtext: "static decision maker",
    footer:
      "The salon may offer many services, but it is still one option competing for the client’s attention and next action.",
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
            : "Next advances each build step, then the next slide."}
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
  const emphasizePath = revealStep >= 1;
  const showSatellites = revealStep >= 2;
  const showFooter = revealStep >= 2;

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

      <div className="flex flex-col items-stretch gap-8 lg:flex-row lg:items-center lg:justify-center lg:gap-6 xl:gap-10">
        {slide.variant === "salon_services" ? (
          <SatelliteCluster
            align="left"
            labels={SALON_SERVICE_LABELS}
            visible={showSatellites}
            anchor="salon"
          />
        ) : (
          <div className="hidden min-w-0 shrink-0 lg:block lg:w-[min(2rem,4vw)]" aria-hidden />
        )}

        <div className="flex min-w-0 flex-col items-center justify-center gap-5 md:gap-6 lg:flex-row lg:gap-2 xl:gap-4">
          <SubjectNode roleLabel="Salon" title="Salon Owner" subtext={slide.salonSubtext} />
          <RelationshipConnector emphasized={emphasizePath} />
          <SubjectNode roleLabel="Client" title="Client" subtext={slide.clientSubtext} />
        </div>

        {slide.variant === "client_world" ? (
          <SatelliteCluster
            align="right"
            labels={CLIENT_WORLD_LABELS}
            visible={showSatellites}
            anchor="client"
          />
        ) : (
          <div className="hidden min-w-0 shrink-0 lg:block lg:w-[min(2rem,4vw)]" aria-hidden />
        )}
      </div>

      <div
        className={`mx-auto mt-10 max-w-3xl text-center transition-all duration-500 ease-out md:mt-12 ${
          showFooter ? "opacity-100 translate-y-0" : "pointer-events-none max-h-0 overflow-hidden opacity-0"
        }`}
      >
        <p className="text-sm font-medium leading-relaxed text-neutral-800 md:text-base">{slide.footer}</p>
      </div>
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

function SatelliteCluster({
  align,
  labels,
  visible,
  anchor,
}: {
  align: "left" | "right";
  labels: readonly string[];
  visible: boolean;
  anchor: "salon" | "client";
}) {
  const slideFrom = align === "left" ? "-translate-x-1 opacity-0" : "translate-x-1 opacity-0";

  return (
    <div
      className={`flex w-full min-w-0 flex-1 flex-col justify-center lg:max-w-[13.5rem] xl:max-w-[15rem] ${
        align === "left" ? "lg:items-end" : "lg:items-start"
      }`}
    >
      <div
        className={`w-full transition-all duration-500 ease-out ${
          visible ? "translate-x-0 opacity-100" : `pointer-events-none max-h-0 overflow-hidden ${slideFrom}`
        }`}
        aria-hidden={!visible}
      >
        <p className="mb-2 text-[9px] font-medium uppercase tracking-wider text-neutral-400">
          {anchor === "salon" ? "Salon-side options" : "Client’s world"}
        </p>
        <ul
          className={`space-y-1.5 ${
            align === "left"
              ? "border-r border-neutral-200/80 pr-3 text-right md:pr-4"
              : "border-l border-neutral-200/80 pl-3 md:pl-4"
          }`}
        >
          {labels.map((label) => (
            <li
              key={label}
              className="rounded-md border border-neutral-200/70 bg-neutral-50 px-2.5 py-1 text-left text-[11px] font-medium text-neutral-800 md:text-xs"
            >
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
