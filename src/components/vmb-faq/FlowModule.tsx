"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { StepMonitor } from "./StepMonitor";
import { SalonOwnerCard } from "./SalonOwnerCard";
import { SalonOwnerCardPhase2 } from "./SalonOwnerCardPhase2";
import { ClientBookCluster } from "./ClientBookCluster";
import { RightCard } from "./RightCard";
import { ConnectorLines } from "./ConnectorLines";
import { ConnectorLinesPhase2 } from "./ConnectorLinesPhase2";
import { InsightOverlay } from "./InsightOverlay";
import { EXPLAINER_STAGES, type ExplainerStage } from "./types";

const PHASE1_DURATIONS_MS: Record<ExplainerStage, number> = {
  step1Active: 900,
  lineOwnerToA: 1000,
  clientAGlow: 1100,
  pauseBeforeStep2: 350,
  step2Active: 900,
  appointmentBooked: 1100,
  step3Active: 900,
  paymentReceived: 1200,
  insightOverlay: 3000,
  fadeOut: 800,
  reset: 600,
};

interface FlowModuleProps {
  title: string;
  phase?: "phase1" | "phase2";
  resultNote?: string;
}

export function FlowModule({
  title,
  phase = "phase1",
  resultNote,
}: FlowModuleProps) {
  const [stageIndex, setStageIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [showD, setShowD] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const sendInviteRef = useRef<HTMLDivElement>(null);
  const paymentsRef = useRef<HTMLDivElement>(null);
  const serviceValueRef = useRef<HTMLDivElement>(null);
  const clientARef = useRef<HTMLDivElement>(null);
  const clientDRef = useRef<HTMLDivElement>(null);
  const rightCardRef = useRef<HTMLDivElement>(null);
  const bookAppointmentRef = useRef<HTMLDivElement>(null);

  const stage = EXPLAINER_STAGES[stageIndex];

  useEffect(() => {
    if (phase === "phase1") {
      const duration = PHASE1_DURATIONS_MS[stage as ExplainerStage];
      const t = setTimeout(() => {
        setStageIndex((prev) => (prev + 1) % EXPLAINER_STAGES.length);
      }, duration);
      return () => clearTimeout(t);
    }
  }, [stageIndex, phase, stage]);

  useEffect(() => {
    if (phase !== "phase2") return;
    let t: ReturnType<typeof setTimeout>;

    if (step === 0) {
      t = setTimeout(() => setStep(1), 600);
    } else if (step === 1) {
      t = setTimeout(() => setStep(2), 700);
    } else if (step === 2) {
      t = setTimeout(() => setStep(3), 450);
    } else if (step === 3) {
      t = setTimeout(() => setStep(4), 700);
    } else if (step === 4) {
      t = setTimeout(() => setStep(5), 800); // Book appointment reveal
    } else if (step === 5) {
      t = setTimeout(() => {
        setStep(6);
      }, 1000); // Book → Payment draw
    } else if (step === 6) {
      t = setTimeout(() => {
        setShowD(true);
        setStep(7);
      }, 1000); // Payment landed hold, then A → D + D reveal
    } else if (step === 7) {
      t = setTimeout(() => setStep(8), 1200); // A → D draw
    } else if (step === 8) {
      t = setTimeout(() => setStep(9), 500); // D flash
    } else if (step === 9) {
      t = setTimeout(() => {
        setShowD(false);
        setStep(0);
      }, 2000); // D + New VMB Client hold 2s, then repeat
    }

    return () => clearTimeout(t);
  }, [phase, step]);

  if (phase === "phase2") {
    const clientAHighlighted = step >= 0;
    const newClientActive = step >= 3;
    const showBookAppointment = step >= 4;
    const bookAppointmentHighlighted = step >= 5;
    const paymentsActive = step >= 5 && step <= 6;
    const showInviteLabel = step >= 1 && step <= 3;
    const showNewVMBLabel = step >= 7 && step <= 9;
    const dPulse = step === 8;

    return (
      <div className="relative w-full overflow-hidden rounded-[24px] border border-neutral-200 bg-neutral-50 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
        <div className="pointer-events-none absolute inset-0 rounded-[24px] bg-[radial-gradient(circle_at_top_left,rgba(0,0,0,0.02),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(0,0,0,0.02),transparent_24%)]" />

        <div className="relative p-3 md:p-4">
          <h2 className="mb-3 text-lg font-semibold tracking-tight text-neutral-950">
            {title}
          </h2>

          <StepMonitor phase="phase2" step={step} />

          <div className="mt-3 overflow-hidden rounded-[18px] border border-neutral-200/60 bg-white/50">
            <motion.div
              ref={containerRef}
            className="relative grid h-[275px] grid-cols-12 gap-2 overflow-hidden"
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <SalonOwnerCardPhase2
                paymentsActive={paymentsActive}
                paymentsRef={paymentsRef}
                serviceValueRef={serviceValueRef}
              />
              <ClientBookCluster
                clientAHighlighted={clientAHighlighted}
                clientARef={clientARef}
                clientDRef={clientDRef}
                showClientD={showD}
                showNewVMBLabel={showNewVMBLabel}
                dPulse={dPulse}
              />
              <RightCard
                active={newClientActive}
                rightCardRef={rightCardRef}
                variant="newClient"
                showBookAppointment={showBookAppointment}
                bookAppointmentRef={bookAppointmentRef}
                bookAppointmentHighlighted={bookAppointmentHighlighted}
              />

              <ConnectorLinesPhase2
                step={step}
                containerRef={containerRef}
                serviceValueRef={serviceValueRef}
                clientARef={clientARef}
                clientDRef={clientDRef}
                rightCardRef={rightCardRef}
                bookAppointmentRef={bookAppointmentRef}
                paymentsRef={paymentsRef}
              />

              {showInviteLabel && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute left-1/2 top-[35%] -translate-x-1/2 rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-[10px] font-medium text-pink-700 shadow-sm"
                >
                  Invite a Friend
                </motion.div>
              )}
            </motion.div>

            <div className="flex min-h-11 items-center justify-center border-t border-neutral-200/50 bg-neutral-50/80 py-[5px]">
              <InsightOverlay
                visible={step === 9}
                text={resultNote ?? "Clients who care are clients who share"}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const p1Stage = stage as ExplainerStage;
  const sendInviteActive = ["step1Active", "lineOwnerToA", "clientAGlow"].includes(p1Stage);
  const paymentsActive = ["paymentReceived", "insightOverlay", "fadeOut"].includes(p1Stage);
  const clientAHighlighted = ["clientAGlow", "pauseBeforeStep2", "step2Active", "appointmentBooked", "step3Active", "paymentReceived", "insightOverlay", "fadeOut"].includes(p1Stage);
  const appointmentActive = ["appointmentBooked", "step3Active", "paymentReceived", "insightOverlay", "fadeOut"].includes(p1Stage);

  return (
    <div className="relative w-full overflow-hidden rounded-[24px] border border-neutral-200 bg-neutral-50 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div className="pointer-events-none absolute inset-0 rounded-[24px] bg-[radial-gradient(circle_at_top_left,rgba(0,0,0,0.02),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(0,0,0,0.02),transparent_24%)]" />

      <div className="relative p-3 md:p-4">
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-neutral-950">
          {title}
        </h2>

        <StepMonitor stage={p1Stage} />

        <div className="mt-3 overflow-hidden rounded-[18px] border border-neutral-200/60 bg-white/50">
          <motion.div
            ref={containerRef}
            className="relative grid h-[250px] grid-cols-12 gap-2 overflow-hidden"
            animate={{ opacity: p1Stage === "fadeOut" ? 0 : 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <SalonOwnerCard
              sendInviteActive={sendInviteActive}
              paymentsActive={paymentsActive}
              sendInviteRef={sendInviteRef}
              paymentsRef={paymentsRef}
            />
            <ClientBookCluster
              clientAHighlighted={clientAHighlighted}
              clientARef={clientARef}
            />
            <RightCard
              active={appointmentActive}
              rightCardRef={rightCardRef}
              variant="appointment"
            />

            <ConnectorLines
              stage={p1Stage}
              containerRef={containerRef}
              sendInviteRef={sendInviteRef}
              paymentsRef={paymentsRef}
              clientARef={clientARef}
              bookedChairRef={rightCardRef}
            />
          </motion.div>

          <div className="flex min-h-11 items-center justify-center border-t border-neutral-200/50 bg-neutral-50/80 py-[5px]">
            <InsightOverlay
              visible={p1Stage === "insightOverlay"}
              text={resultNote ?? "Client activation unlocks hidden revenue"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
