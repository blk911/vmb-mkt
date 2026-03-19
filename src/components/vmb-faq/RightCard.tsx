"use client";

import { motion } from "framer-motion";

interface RightCardProps {
  active: boolean;
  rightCardRef: React.RefObject<HTMLDivElement | null>;
  variant: "appointment" | "newClient";
  newClientState?: "friendJoins" | "bookAppointment";
  showBookAppointment?: boolean;
  bookAppointmentRef?: React.RefObject<HTMLDivElement | null>;
  bookAppointmentHighlighted?: boolean;
}

const VARIANTS = {
  appointment: {
    label: "Appointment Booked",
    innerLabel: "Service",
    innerText: "Booked Chair",
  },
  newClient: {
    label: "New Client",
    friendJoins: { innerLabel: "", innerText: "Friend Joins" },
    bookAppointment: { innerLabel: "Service", innerText: "Book Appointment" },
  },
};

export function RightCard({
  active,
  rightCardRef,
  variant,
  newClientState = "friendJoins",
  showBookAppointment = false,
  bookAppointmentRef,
  bookAppointmentHighlighted = false,
}: RightCardProps) {
  const label = variant === "appointment" ? VARIANTS.appointment.label : VARIANTS.newClient.label;
  const friendJoinsContent = VARIANTS.newClient.friendJoins;
  const bookAppointmentContent = VARIANTS.newClient.bookAppointment;

  if (variant === "appointment") {
    const innerContent = VARIANTS.appointment;
    return (
      <div className="col-span-12 md:col-span-4">
        <div className="h-full rounded-[16px] border border-neutral-200 bg-white p-3 shadow-sm">
          <div className="mb-2 inline-flex rounded-full border border-neutral-200 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
            {label}
          </div>

          <motion.div
            className="relative flex h-[calc(100%-2rem)] items-start justify-center pt-2 overflow-hidden rounded-[14px] border border-neutral-200 bg-neutral-50"
            animate={{
              boxShadow: active
                ? "inset 0 0 0 1px rgb(236 72 153 / 0.25), 0 0 16px rgba(236 72 153 / 0.06)"
                : "none",
            }}
            transition={{ duration: 0.4 }}
          >
            <motion.div
              ref={rightCardRef}
              className="rounded-[14px] border border-neutral-200 bg-white px-4 py-3 text-center shadow-sm"
              animate={{
                boxShadow: active
                  ? "0 0 0 2px rgb(236 72 153 / 0.25), 0 4px 12px rgba(236 72 153 / 0.1)"
                  : "0 1px 2px 0 rgb(0 0 0 / 0.05)",
              }}
              transition={{ duration: 0.4 }}
            >
              <div className="text-[9px] uppercase tracking-[0.14em] text-neutral-500">
                {innerContent.innerLabel}
              </div>
              <div className="mt-1 text-xs font-semibold text-neutral-950">
                {innerContent.innerText}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  const bookAppointmentActive = showBookAppointment && bookAppointmentHighlighted;

  return (
    <div className="col-span-12 md:col-span-4">
      <div className="h-full rounded-[16px] border border-neutral-200 bg-white p-3 shadow-sm">
        <div className="mb-2 inline-flex rounded-full border border-neutral-200 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
          {label}
        </div>

        <motion.div
          className="relative flex h-[calc(100%-2rem)] flex-col items-center justify-start gap-0 overflow-hidden rounded-[14px] border border-neutral-200 bg-neutral-50 pt-2"
          animate={{
            boxShadow: active
              ? "inset 0 0 0 1px rgb(236 72 153 / 0.25), 0 0 16px rgba(236 72 153 / 0.06)"
              : "none",
          }}
          transition={{ duration: 0.4 }}
        >
          <motion.div
            ref={rightCardRef}
            className="rounded-[14px] border border-neutral-200 bg-white px-4 py-3 text-center shadow-sm"
            animate={{
              boxShadow: active && !bookAppointmentHighlighted
                ? "0 0 0 2px rgb(236 72 153 / 0.25), 0 4px 12px rgba(236 72 153 / 0.1)"
                : "0 1px 2px 0 rgb(0 0 0 / 0.05)",
            }}
            transition={{ duration: 0.4 }}
          >
            <div className="text-xs font-semibold text-neutral-950">
              {friendJoinsContent.innerText}
            </div>
          </motion.div>

          {showBookAppointment && (
            <>
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 26 }}
                transition={{ duration: 0.3 }}
                className="mt-3 flex shrink-0 items-center justify-center"
              >
                <div className="h-6 w-px bg-neutral-300" />
              </motion.div>
              <motion.div
                ref={bookAppointmentRef}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  boxShadow: bookAppointmentActive
                    ? "0 0 0 2px rgb(236 72 153 / 0.25), 0 4px 12px rgba(236 72 153 / 0.1)"
                    : "0 1px 2px 0 rgb(0 0 0 / 0.05)",
                }}
                transition={{ duration: 0.35 }}
                className="mt-[25px] rounded-[14px] border border-neutral-200 bg-white px-4 py-2.5 text-center shadow-sm"
              >
                <div className="text-[9px] uppercase tracking-[0.14em] text-neutral-500">
                  {bookAppointmentContent.innerLabel}
                </div>
                <div className="mt-0.5 text-xs font-semibold text-neutral-950">
                  {bookAppointmentContent.innerText}
                </div>
              </motion.div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
