"use client";

import { useCallback, useMemo, useState } from "react";

const PERSONAL_CARE_OPTIONS = [
  "Hair",
  "Brows",
  "Lips",
  "Lashes",
  "Nails",
  "Wax",
  "Mani / Pedi",
  "Massage",
] as const;

type SlideDef = {
  id: number;
  eyebrow: string;
  headline: string;
  maxRevealStep: number;
};

const SLIDES: SlideDef[] = [
  {
    id: 1,
    eyebrow: "Current Reality",
    headline: "Today, the salon is often just one option.",
    maxRevealStep: 2,
  },
];

const CAPTION_PRIMARY =
  "The salon is only one option in a client's broader personal-care world.";
const CAPTION_SECONDARY =
  "Without a network layer, the relationship remains passive, fragile, and easily interrupted.";

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
  const atEndReveal = revealStep >= slide.maxRevealStep;
  const atLastSlide = slideIndex >= totalSlides - 1;
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

      <div className="relative min-h-[320px] overflow-hidden rounded-xl border border-neutral-100 bg-white/90 px-4 py-8 shadow-inner md:min-h-[380px] md:px-10 md:py-10">
        {slide.id === 1 ? (
          <SlideOneCurrentReality revealStep={revealStep} slide={slide} />
        ) : null}
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
          {nextDisabled ? "End of presentation — more slides coming soon." : "Next advances each reveal, then future slides."}
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

function SlideOneCurrentReality({
  revealStep,
  slide,
}: {
  revealStep: number;
  slide: SlideDef;
}) {
  const showOptions = revealStep >= 1;
  const showCaptions = revealStep >= 2;

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8 text-center md:mb-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">{slide.eyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl">{slide.headline}</h2>
      </header>

      <div className="flex flex-col gap-8 md:flex-row md:items-stretch md:justify-center md:gap-10 lg:gap-14">
        <figure className="flex flex-1 flex-col items-center rounded-2xl border border-neutral-200/90 bg-gradient-to-b from-neutral-50 to-white px-6 py-8 text-center shadow-sm md:py-10">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Salon Owner</span>
          <div
            className="mt-5 flex h-36 w-full max-w-[200px] items-center justify-center rounded-xl border border-neutral-200 bg-neutral-100/80 md:h-40"
            aria-hidden
          >
            <span className="text-4xl text-neutral-300">◆</span>
          </div>
          <figcaption className="mt-4 max-w-[220px] text-xs leading-relaxed text-neutral-600">
            Grounded, local presence — one place in the client&apos;s wider routine.
          </figcaption>
        </figure>

        <figure className="flex flex-1 flex-col items-center rounded-2xl border border-neutral-200/90 bg-gradient-to-b from-white to-neutral-50/90 px-6 py-8 text-center shadow-sm md:py-10">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Client</span>
          <div
            className="mt-5 flex h-36 w-full max-w-[240px] items-center justify-center rounded-xl border border-neutral-200 bg-white md:h-40"
            aria-hidden
          >
            <span className="text-4xl text-neutral-300">○</span>
          </div>
          <div
            className={`mt-4 flex max-w-[280px] flex-wrap justify-center gap-2 transition-all duration-500 ease-out ${
              showOptions ? "opacity-100 translate-y-0" : "pointer-events-none max-h-0 opacity-0 -translate-y-1 overflow-hidden"
            }`}
            aria-hidden={!showOptions}
          >
            {PERSONAL_CARE_OPTIONS.map((label) => (
              <span
                key={label}
                className="rounded-full border border-neutral-200/90 bg-white/95 px-2.5 py-1 text-[10px] font-medium tracking-wide text-neutral-700 shadow-sm"
              >
                {label}
              </span>
            ))}
          </div>
          <figcaption className="mt-4 max-w-[240px] text-xs leading-relaxed text-neutral-600">
            Many choices compete for attention — not only the salon.
          </figcaption>
        </figure>
      </div>

      <div
        className={`mx-auto mt-10 max-w-2xl text-center transition-all duration-500 ease-out ${
          showCaptions
            ? "opacity-100 translate-y-0"
            : "pointer-events-none max-h-0 overflow-hidden opacity-0"
        }`}
      >
        <p className="text-base font-medium leading-snug text-neutral-900 md:text-lg">{CAPTION_PRIMARY}</p>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600 md:text-[15px]">{CAPTION_SECONDARY}</p>
      </div>
    </div>
  );
}
