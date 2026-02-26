"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  mode?: "dark" | "light";
  loop?: boolean;
  words?: string[];
  finalWord?: string;
  brandLine?: string;
  speed?: "fast" | "normal" | "slow";
  className?: string;
};

export default function BeUnforgettable({
  mode = "dark",
  loop = true,
  words = ["BOLD", "CONFIDENT", "PRESENT", "INTENTIONAL", "REMEMBERED"],
  finalWord = "UNFORGETTABLE",
  brandLine = "Ven Me Baby!",
  speed = "normal",
  className = "",
}: Props) {
  const [key, setKey] = useState(0);
  const timerRef = useRef<number | null>(null);

  const timing = useMemo(() => {
    if (speed === "fast") return { perWord: 0.42, gap: 0.05, pause: 0.26, brandDelay: 0.35, loopGap: 0.85 };
    if (speed === "slow") return { perWord: 0.8, gap: 0.09, pause: 0.5, brandDelay: 0.6, loopGap: 1.45 };
    return { perWord: 0.55, gap: 0.06, pause: 0.35, brandDelay: 0.45, loopGap: 1.1 };
  }, [speed]);

  const totalSeconds = useMemo(() => {
    const n = words.length;
    const wordsBlock = n > 0 ? n * timing.perWord + (n - 1) * timing.gap : 0;
    const finalAnim = Math.max(0.9, timing.perWord);
    const brandAnim = 0.85;
    return wordsBlock + timing.pause + finalAnim + timing.brandDelay + brandAnim + (loop ? timing.loopGap : 0);
  }, [words.length, timing, loop]);

  useEffect(() => {
    if (!loop) return;

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setKey((k) => k + 1), totalSeconds * 1000);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [key, loop, totalSeconds]);

  const isLight = mode === "light";

  return (
    <div
      className={[
        "overflow-hidden rounded-3xl border shadow-sm",
        isLight ? "border-neutral-200 bg-white text-neutral-900" : "border-white/10 bg-neutral-950 text-white",
        className,
      ].join(" ")}
    >
      <style>{`
        @keyframes rollAnswer {
          0%   { transform: translateY(140%); opacity: 0; }
          14%  { opacity: 1; }
          30%  { transform: translateY(0%); opacity: 1; }
          62%  { transform: translateY(0%); opacity: 1; }
          100% { transform: translateY(-140%); opacity: 0; }
        }
        @keyframes rollAndLock {
          0%   { transform: translateY(140%); opacity: 0; }
          16%  { opacity: 1; }
          34%  { transform: translateY(0%); opacity: 1; }
          100% { transform: translateY(0%); opacity: 1; }
        }
        @keyframes brandIn {
          0%   { transform: translateY(140%); opacity: 0; }
          30%  { opacity: 1; }
          60%  { transform: translateY(0%); opacity: 1; }
          100% { transform: translateY(0%); opacity: 1; }
        }
      `}</style>

      <div className="p-6 md:p-10">
        <div className="mt-4 flex w-full items-end gap-3" key={key}>
          <div
            style={{
              fontFamily: 'ui-serif, Georgia, "Times New Roman", Times, serif',
              fontWeight: 600,
              letterSpacing: "0.05em",
              fontSize: "clamp(28px, 5vw, 54px)",
              lineHeight: 1,
            }}
          >
            BE
          </div>
          <div className="relative min-w-0 flex-1 overflow-hidden" style={{ height: "clamp(42px, 6vw, 64px)" }}>
            {words.map((w, i) => {
              const delay = i * (timing.perWord + timing.gap);
              return (
                <div
                  key={w + i}
                  className="absolute bottom-0 left-0 right-0 text-left"
                  style={{
                    fontFamily: 'ui-serif, Georgia, "Times New Roman", Times, serif',
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                    fontSize: "clamp(28px, 5vw, 54px)",
                    lineHeight: 1,
                    transform: "translateY(140%)",
                    opacity: 0,
                    animation: `rollAnswer ${timing.perWord}s cubic-bezier(.2,.9,.2,1) ${delay}s 1 both`,
                  }}
                >
                  {w}
                </div>
              );
            })}

            {(() => {
              const wordsBlock = words.length > 0 ? words.length * timing.perWord + (words.length - 1) * timing.gap : 0;
              const t = wordsBlock + timing.pause;
              return (
                <div
                  className="absolute bottom-0 left-0 right-0 text-left"
                  style={{
                    fontFamily: 'ui-serif, Georgia, "Times New Roman", Times, serif',
                    fontWeight: 700,
                    letterSpacing: "0.03em",
                    fontSize: "clamp(28px, 5vw, 54px)",
                    lineHeight: 1,
                    transform: "translateY(140%)",
                    opacity: 0,
                    animation: `rollAndLock ${Math.max(0.9, timing.perWord)}s cubic-bezier(.2,.9,.2,1) ${t}s 1 both`,
                  }}
                >
                  {finalWord}
                </div>
              );
            })()}
          </div>
        </div>

        <div className="relative mt-4 grid place-items-center overflow-hidden" style={{ height: 44 }} key={"brand-" + key}>
          {(() => {
            const n = words.length;
            const wordsBlock = n > 0 ? n * timing.perWord + (n - 1) * timing.gap : 0;
            const t = wordsBlock + timing.pause + timing.brandDelay;
            return (
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  textAlign: "center",
                  fontFamily: '"Lucida Calligraphy","Zapfino","Snell Roundhand","Brush Script MT",cursive',
                  fontSize: "clamp(22px, 3.6vw, 36px)",
                  transform: "translateY(140%)",
                  opacity: 0,
                  animation: `brandIn 0.85s cubic-bezier(.2,.9,.2,1) ${t}s 1 both`,
                }}
              >
                {brandLine}
              </span>
            );
          })()}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            className={[
              "rounded-xl border px-4 py-2 text-sm font-semibold",
              isLight ? "border-neutral-200 bg-white hover:bg-neutral-50" : "border-white/15 bg-white/5 hover:bg-white/10",
            ].join(" ")}
            onClick={() => setKey((k) => k + 1)}
            type="button"
          >
            Replay
          </button>
        </div>
      </div>
    </div>
  );
}
