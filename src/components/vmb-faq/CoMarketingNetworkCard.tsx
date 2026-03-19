"use client";

import { motion } from "framer-motion";

const CHIPS = ["Nails", "Hair", "Pedi"];

interface SalonMiniCardProps {
  name: string;
  visible: boolean;
  chipsVisible: boolean;
  isActive: boolean;
  isCompleted: boolean;
  nodeRef?: React.RefObject<HTMLDivElement | null>;
}

function SalonMiniCard({
  name,
  visible,
  chipsVisible,
  isActive,
  isCompleted,
  nodeRef,
}: SalonMiniCardProps) {
  if (!visible) return null;

  return (
    <motion.div
      ref={nodeRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{
        opacity: isCompleted ? 0.85 : 1,
        scale: 1,
        boxShadow: isActive
          ? "0 0 0 2px rgb(236 72 153 / 0.5), 0 4px 12px rgba(236 72 153 / 0.2)"
          : isCompleted
            ? "0 0 0 1px rgb(251 207 232 / 0.6), 0 1px 3px rgba(0,0,0,0.04)"
            : "0 1px 2px 0 rgb(0 0 0 / 0.05)",
      }}
      transition={{ duration: 0.4 }}
      className={`min-w-[100px] w-[100px] shrink-0 rounded-lg border bg-white px-2.5 py-2 shadow-sm ${
        isCompleted ? "border-pink-200" : "border-neutral-200"
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-semibold text-neutral-950">{name}</span>
        {isCompleted && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-pink-400 text-[9px]"
            aria-hidden
          >
            ✓
          </motion.span>
        )}
      </div>
      {chipsVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, delay: 0.1 }}
          className="mt-1.5 flex flex-col gap-1"
        >
          {CHIPS.map((chip) => (
            <span
              key={chip}
              className="block rounded bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600"
            >
              {chip}
            </span>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

interface CoMarketingNetworkCardProps {
  salon1Visible: boolean;
  salon1ChipsVisible: boolean;
  salon1Active: boolean;
  salon1Completed: boolean;
  salon2Visible: boolean;
  salon2ChipsVisible: boolean;
  salon2Active: boolean;
  salon2Completed: boolean;
  salon3Visible: boolean;
  salon3ChipsVisible: boolean;
  salon3Active: boolean;
  salon3Completed: boolean;
  salon1Ref?: React.RefObject<HTMLDivElement | null>;
  salon2Ref?: React.RefObject<HTMLDivElement | null>;
  salon3Ref?: React.RefObject<HTMLDivElement | null>;
}

export function CoMarketingNetworkCard({
  salon1Visible,
  salon1ChipsVisible,
  salon1Active,
  salon1Completed,
  salon2Visible,
  salon2ChipsVisible,
  salon2Active,
  salon2Completed,
  salon3Visible,
  salon3ChipsVisible,
  salon3Active,
  salon3Completed,
  salon1Ref,
  salon2Ref,
  salon3Ref,
}: CoMarketingNetworkCardProps) {
  return (
    <div className="col-span-12 md:col-span-5">
      <div className="h-full rounded-[16px] border border-neutral-200 bg-white p-2.5 shadow-sm">
        <div className="mb-1.5 inline-flex rounded-full border border-neutral-200 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
          Co-Marketing Network
        </div>
        <div className="flex h-[calc(100%-2rem)] flex-row items-start justify-start gap-2.5 rounded-[14px] border border-dashed border-neutral-200 bg-neutral-50/50 p-2.5">
          <SalonMiniCard
            name="BF's Salon"
            visible={salon1Visible}
            chipsVisible={salon1ChipsVisible}
            isActive={salon1Active}
            isCompleted={salon1Completed}
            nodeRef={salon1Ref}
          />
          <SalonMiniCard
            name="Salon B"
            visible={salon2Visible}
            chipsVisible={salon2ChipsVisible}
            isActive={salon2Active}
            isCompleted={salon2Completed}
            nodeRef={salon2Ref}
          />
          <SalonMiniCard
            name="Salon C"
            visible={salon3Visible}
            chipsVisible={salon3ChipsVisible}
            isActive={salon3Active}
            isCompleted={salon3Completed}
            nodeRef={salon3Ref}
          />
        </div>
      </div>
    </div>
  );
}
