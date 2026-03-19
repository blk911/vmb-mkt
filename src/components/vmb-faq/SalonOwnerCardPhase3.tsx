"use client";

import { motion } from "framer-motion";

interface SalonOwnerCardPhase3Props {
  coMarketingPlanRef?: React.RefObject<HTMLDivElement | null>;
  coMarketingPlanActive?: boolean;
  coMktShareRef?: React.RefObject<HTMLDivElement | null>;
  coMktShareActive?: boolean;
}

export function SalonOwnerCardPhase3({ coMarketingPlanRef, coMarketingPlanActive, coMktShareRef, coMktShareActive }: SalonOwnerCardPhase3Props) {
  return (
    <div className="col-span-12 md:col-span-3">
      <div className="h-full rounded-[16px] border border-neutral-200 bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-xs font-semibold text-white">
            MN
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-neutral-950">
              Marie&apos;s Nails
            </h3>
            <p className="text-[10px] text-neutral-500">VMB Salon</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <motion.div
            ref={coMarketingPlanRef}
            className="rounded-lg border border-neutral-200 bg-neutral-50/50 px-2.5 py-1.5"
            animate={{
              boxShadow: coMarketingPlanActive
                ? "0 0 0 2px rgb(236 72 153 / 0.3), 0 2px 6px rgba(236 72 153 / 0.08)"
                : "none",
            }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-[9px] uppercase tracking-[0.14em] text-neutral-500">
              VMB Salon
            </div>
            <div className="mt-0.5 text-xs font-medium text-neutral-900">
              Co-Marketing Plan
            </div>
          </motion.div>

          <motion.div
            ref={coMktShareRef}
            className="rounded-lg border border-neutral-200 bg-neutral-50/50 px-2.5 py-1.5"
            animate={{
              boxShadow: coMktShareActive
                ? "0 0 0 2px rgb(236 72 153 / 0.3), 0 2px 6px rgba(236 72 153 / 0.08)"
                : "none",
            }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-[9px] uppercase tracking-[0.14em] text-neutral-500">
              Co-Mkt Share
            </div>
            <div className="mt-0.5 text-xs font-medium text-neutral-900">
              Salon Owner
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
