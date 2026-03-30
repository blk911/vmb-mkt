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

      <div className="relative min-h-[440px] overflow-hidden bg-white px-3 py-8 md:min-h-[560px] md:px-10 md:py-12">
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
    <div className="mx-auto max-w-6xl">
      <header className="mb-10 text-center md:mb-12">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 md:text-sm md:tracking-[0.14em]">
          {slide.eyebrow}
        </p>
        <h2 className="mt-3 text-3xl font-semibold leading-[1.15] tracking-tight text-neutral-900 md:mt-4 md:text-4xl lg:text-[2.5rem]">
          {slide.headline}
        </h2>
      </header>

      <div className="flex flex-col gap-14 md:flex-row md:items-start md:justify-center md:gap-16 lg:gap-24 xl:gap-28">
        <figure className="flex min-w-0 flex-1 flex-col items-center text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500 md:text-sm md:tracking-[0.2em]">
            Salon Owner
          </span>
          <div
            className="mt-8 flex min-h-[11rem] w-full max-w-[min(20rem,88vw)] items-center justify-center md:mt-10 md:min-h-[13rem] lg:min-h-[15rem] lg:max-w-[22rem]"
            aria-hidden
          >
            <span className="select-none text-[5.5rem] leading-none text-neutral-200 md:text-7xl lg:text-8xl">◆</span>
          </div>
          <figcaption className="mt-8 max-w-[min(22rem,92vw)] text-base leading-relaxed text-neutral-600 md:mt-10 md:text-lg md:leading-snug">
            Grounded, local presence — one place in the client&apos;s wider routine.
          </figcaption>
        </figure>

        <figure className="flex min-w-0 flex-1 flex-col items-center text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500 md:text-sm md:tracking-[0.2em]">
            Client
          </span>
          <div
            className="mt-8 flex min-h-[11rem] w-full max-w-[min(22rem,88vw)] items-center justify-center md:mt-10 md:min-h-[13rem] lg:min-h-[15rem] lg:max-w-[24rem]"
            aria-hidden
          >
            <span className="select-none text-[5.5rem] leading-none text-neutral-200 md:text-7xl lg:text-8xl">○</span>
          </div>
          <div
            className={`mt-6 flex max-w-[min(22rem,92vw)] flex-wrap justify-center gap-2.5 transition-all duration-500 ease-out md:gap-3 ${
              showOptions ? "opacity-100 translate-y-0" : "pointer-events-none max-h-0 opacity-0 -translate-y-1 overflow-hidden"
            }`}
            aria-hidden={!showOptions}
          >
            {PERSONAL_CARE_OPTIONS.map((label) => (
              <span
                key={label}
                className="rounded-full bg-neutral-100/90 px-3 py-1.5 text-xs font-medium tracking-wide text-neutral-800 md:px-3.5 md:py-2 md:text-sm"
              >
                {label}
              </span>
            ))}
          </div>
          <figcaption className="mt-8 max-w-[min(22rem,92vw)] text-base leading-relaxed text-neutral-600 md:mt-10 md:text-lg md:leading-snug">
            Many choices compete for attention — not only the salon.
          </figcaption>
        </figure>
      </div>

      <div
        className={`mx-auto mt-12 max-w-3xl text-center transition-all duration-500 ease-out md:mt-16 ${
          showCaptions
            ? "opacity-100 translate-y-0"
            : "pointer-events-none max-h-0 overflow-hidden opacity-0"
        }`}
      >
        <p className="text-lg font-medium leading-snug text-neutral-900 md:text-xl lg:text-[1.35rem]">{CAPTION_PRIMARY}</p>
        <p className="mt-4 text-base leading-relaxed text-neutral-600 md:mt-5 md:text-[1.05rem]">{CAPTION_SECONDARY}</p>
      </div>
    </div>
  );
}
