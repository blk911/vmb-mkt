"use client";

import { motion } from "framer-motion";

interface InsightOverlayProps {
  visible: boolean;
  text?: string;
}

export function InsightOverlay({ visible, text = "Client activation unlocks hidden revenue" }: InsightOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex justify-center"
    >
      <div className="rounded-lg border border-neutral-200 bg-white px-[25px] py-[17px] shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
        <p className="text-lg font-semibold tracking-tight text-neutral-700">
          {text}
        </p>
      </div>
    </motion.div>
  );
}
