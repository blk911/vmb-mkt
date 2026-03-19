"use client";

import { motion } from "framer-motion";

interface SalonOwnerCardProps {
  sendInviteActive: boolean;
  paymentsActive: boolean;
  sendInviteRef: React.RefObject<HTMLDivElement | null>;
  paymentsRef: React.RefObject<HTMLDivElement | null>;
}

export function SalonOwnerCard({
  sendInviteActive,
  paymentsActive,
  sendInviteRef,
  paymentsRef,
}: SalonOwnerCardProps) {
  return (
    <div className="col-span-12 md:col-span-3">
      <div className="h-full rounded-[16px] border border-neutral-200 bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-xs font-semibold text-white">
            SW
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-neutral-950">
              Maria&apos;s Nails
            </h3>
            <p className="text-[10px] text-neutral-500">Salon Owner</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <motion.div
            ref={sendInviteRef}
            className="rounded-lg border border-neutral-200 bg-neutral-50/50 px-2.5 py-1.5"
            animate={{
              boxShadow: sendInviteActive
                ? "0 0 0 2px rgb(236 72 153 / 0.3), 0 2px 6px rgba(236 72 153 / 0.08)"
                : "none",
              borderColor: sendInviteActive ? "rgb(236 72 153 / 0.4)" : "rgb(229 229 229)",
            }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-[9px] uppercase tracking-[0.14em] text-neutral-500">
              Send Invite
            </div>
            <div className="mt-0.5 text-xs font-medium text-neutral-900">
              VMB invitation
            </div>
          </motion.div>

          <motion.div
            ref={paymentsRef}
            className="rounded-lg border border-neutral-200 bg-neutral-50/50 px-2.5 py-1.5"
            animate={{
              boxShadow: paymentsActive
                ? "0 0 0 2px rgb(236 72 153 / 0.3), 0 2px 6px rgba(236 72 153 / 0.08)"
                : "none",
              borderColor: paymentsActive ? "rgb(236 72 153 / 0.4)" : "rgb(229 229 229)",
            }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-[9px] uppercase tracking-[0.14em] text-neutral-500">
              Payments
            </div>
            <div className="mt-0.5 text-xs font-medium text-neutral-900">
              Payment received
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
