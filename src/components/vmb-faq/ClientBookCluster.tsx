"use client";

import { motion } from "framer-motion";

interface ClientBookClusterProps {
  clientAHighlighted: boolean;
  clientARef: React.RefObject<HTMLDivElement | null>;
  clientDRef?: React.RefObject<HTMLDivElement | null>;
  showClientD?: boolean;
  showNewVMBLabel?: boolean;
  dPulse?: boolean;
}

const CLIENTS = ["A", "B", "C"];

export function ClientBookCluster({
  clientAHighlighted,
  clientARef,
  clientDRef,
  showClientD = false,
  showNewVMBLabel = false,
  dPulse = false,
}: ClientBookClusterProps) {
  return (
    <div className="col-span-12 md:col-span-5">
      <div className="h-full rounded-[16px] border border-neutral-200 bg-white p-3 shadow-sm">
        <div className="mb-2 inline-flex rounded-full border border-neutral-200 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
          Client Book
        </div>

        <div className="flex h-[calc(100%-2rem)] items-start justify-center pt-2 rounded-[14px] border border-dashed border-neutral-200 bg-neutral-50">
          <div className="flex flex-col items-center gap-3">
            <div className="grid grid-cols-3 gap-3">
              {CLIENTS.map((client, index) => {
                const isA = index === 0;
                const highlighted = isA && clientAHighlighted;
                return (
                  <motion.div
                    key={client}
                    ref={isA ? clientARef : undefined}
                    animate={{
                      scale: highlighted ? 1.02 : 1,
                      boxShadow: highlighted
                        ? "0 0 0 2px rgb(236 72 153 / 0.4), 0 4px 12px rgba(236 72 153 / 0.15)"
                        : "0 1px 2px 0 rgb(0 0 0 / 0.05)",
                    }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className={`flex h-14 w-14 items-center justify-center rounded-lg border text-xs font-semibold ${
                      highlighted
                        ? "border-pink-200 bg-pink-50 text-pink-700"
                        : "border-neutral-200 bg-white text-neutral-700"
                    }`}
                  >
                    {client}
                  </motion.div>
                );
              })}
            </div>

            {showClientD && (
              <div className="relative flex flex-col items-center gap-1">
                <motion.div
                  ref={clientDRef}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{
                    opacity: 1,
                    scale: dPulse ? 1.1 : 1,
                    boxShadow: dPulse
                      ? [
                          "0 0 0 2px rgb(236 72 153 / 0.4), 0 4px 12px rgba(236 72 153 / 0.15)",
                          "0 0 0 3px rgb(236 72 153 / 0.6), 0 0 20px rgba(236 72 153 / 0.3)",
                          "0 0 0 2px rgb(236 72 153 / 0.4), 0 4px 12px rgba(236 72 153 / 0.15)",
                        ]
                      : [
                          "0 0 0 2px rgb(245 158 11 / 0.5), 0 4px 16px rgba(245 158 11 / 0.25)",
                          "0 0 0 2px rgb(236 72 153 / 0.4), 0 4px 12px rgba(236 72 153 / 0.15)",
                          "0 1px 2px 0 rgb(0 0 0 / 0.05)",
                        ],
                    borderColor: dPulse
                      ? "rgb(236 72 153 / 0.5)"
                      : ["rgb(245 158 11 / 0.6)", "rgb(236 72 153 / 0.5)", "rgb(229 229 229)"],
                    backgroundColor: dPulse
                      ? "rgb(253 242 248)"
                      : ["rgb(254 243 199)", "rgb(253 242 248)", "rgb(255 255 255)"],
                    color: dPulse ? "rgb(190 24 93)" : ["rgb(180 83 9)", "rgb(190 24 93)", "rgb(64 64 64)"],
                  }}
                  transition={
                    dPulse
                      ? { boxShadow: { duration: 0.5, times: [0, 0.3, 1] } }
                      : {
                          opacity: { duration: 0.4 },
                          scale: { duration: 0.4 },
                          boxShadow: { delay: 0.3, duration: 0.6 },
                          borderColor: { times: [0, 0.45, 1], duration: 0.9 },
                          backgroundColor: { times: [0, 0.45, 1], duration: 0.9 },
                          color: { times: [0, 0.45, 1], duration: 0.9 },
                        }
                  }
                  className={`flex h-14 w-14 items-center justify-center rounded-lg border text-xs font-semibold transition-all duration-300 ${dPulse ? "scale-110 ring-2 ring-pink-400" : ""}`}
                >
                  D
                </motion.div>
                {showNewVMBLabel && (
                  <motion.span
                    initial={{ opacity: 0, y: 2 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: 0.15 }}
                    className="text-[9px] font-medium text-pink-600"
                  >
                    New VMB Client
                  </motion.span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
