"use client";

import { motion } from "framer-motion";

interface RightCardPhase3Props {
  joinVMBActive: boolean;
  activateClientsActive: boolean;
  showActivateClients: boolean;
  joinVMBRef: React.RefObject<HTMLDivElement | null>;
  activateClientsRef: React.RefObject<HTMLDivElement | null>;
}

export function RightCardPhase3({
  joinVMBActive,
  activateClientsActive,
  showActivateClients,
  joinVMBRef,
  activateClientsRef,
}: RightCardPhase3Props) {
  return (
    <div className="col-span-12 md:col-span-4">
      <div className="h-full rounded-[16px] border border-neutral-200 bg-white p-2.5 shadow-sm">
        <div className="mb-1.5 inline-flex rounded-full border border-neutral-200 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
          VMB
        </div>

        <motion.div
          className="relative flex h-[calc(100%-2rem)] flex-col items-center justify-start gap-0 overflow-hidden rounded-[14px] border border-neutral-200 bg-neutral-50 pt-1.5"
          animate={{
            boxShadow: joinVMBActive || activateClientsActive
              ? "inset 0 0 0 1px rgb(236 72 153 / 0.25), 0 0 16px rgba(236 72 153 / 0.06)"
              : "none",
          }}
          transition={{ duration: 0.4 }}
        >
          <motion.div
            ref={joinVMBRef}
            className="rounded-[14px] border border-neutral-200 bg-white px-3.5 py-2.5 text-center shadow-sm"
            animate={{
              boxShadow: joinVMBActive
                ? "0 0 0 2px rgb(236 72 153 / 0.25), 0 4px 12px rgba(236 72 153 / 0.1)"
                : "0 1px 2px 0 rgb(0 0 0 / 0.05)",
            }}
            transition={{ duration: 0.4 }}
          >
            <div className="text-xs font-semibold text-neutral-950">
              Join VMB
            </div>
          </motion.div>

          {showActivateClients && (
            <>
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 8 }}
                transition={{ duration: 0.3 }}
                className="mt-2 flex shrink-0 items-center justify-center"
              >
                <div className="h-2 w-px bg-neutral-300" />
              </motion.div>
              <motion.div
                ref={activateClientsRef}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  boxShadow: activateClientsActive
                    ? "0 0 0 2px rgb(236 72 153 / 0.25), 0 4px 12px rgba(236 72 153 / 0.1)"
                    : "0 1px 2px 0 rgb(0 0 0 / 0.05)",
                }}
                transition={{ duration: 0.35 }}
                className="mt-2 rounded-[14px] border border-neutral-200 bg-white px-3.5 py-2 text-center shadow-sm"
              >
                <div className="text-xs font-semibold text-neutral-950">
                  Activate Clients
                </div>
              </motion.div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
