"use client";

import { motion } from "framer-motion";
import type { ExplainerStage } from "./types";

const PHASE1_STEPS = [
  { id: 1, text: "Owner sends VMB invitation to a loyal client" },
  { id: 2, text: "Client accepts and books appointment" },
  { id: 3, text: "Salon receives payment and confirms appointment" },
];

const PHASE2_STEPS = [
  { id: 1, text: "Client enjoys the appointment" },
  { id: 2, text: "She invites a friend through VMB" },
  { id: 3, text: "New client joins and books" },
];

const PHASE3_STEPS = [
  { id: 1, text: "Marie shares VMB with a trusted salon connection" },
  { id: 2, text: "New salon joins and activates clients" },
  { id: 3, text: "Co-marketing network expands again" },
];

const STAGE_TO_ACTIVE_STEP: Record<ExplainerStage, number> = {
  step1Active: 1,
  lineOwnerToA: 1,
  clientAGlow: 1,
  step2Active: 2,
  appointmentBooked: 2,
  step3Active: 3,
  paymentReceived: 3,
  insightOverlay: 3,
  fadeOut: 3,
  reset: 3,
};

function getPhase2ActiveStep(step: number): number {
  if (step <= 1) return 1;
  if (step === 2) return 2;
  return 3;
}

function isPhase2Complete(step: number): boolean {
  return step === 7;
}

const STEPS_PER_SALON_P3 = 6;
const TOTAL_SALON_STEPS_P3 = STEPS_PER_SALON_P3 * 3;
const CLOSING_STEP_P3 = TOTAL_SALON_STEPS_P3;

function getPhase3ActiveStep(step: number): number {
  if (step < STEPS_PER_SALON_P3) return 1;
  if (step < STEPS_PER_SALON_P3 * 2) return 2;
  if (step < CLOSING_STEP_P3) return 3;
  return 3;
}

function isPhase3Complete(step: number): boolean {
  return step >= CLOSING_STEP_P3;
}

interface StepMonitorProps {
  stage?: ExplainerStage;
  phase?: "phase1" | "phase2" | "phase3";
  step?: number;
}

export function StepMonitor({ stage, phase = "phase1", step: phaseStep }: StepMonitorProps) {
  const steps =
    phase === "phase2"
      ? PHASE2_STEPS
      : phase === "phase3"
        ? PHASE3_STEPS
        : PHASE1_STEPS;
  const activeStep =
    phase === "phase2" && phaseStep !== undefined
      ? getPhase2ActiveStep(phaseStep)
      : phase === "phase3" && phaseStep !== undefined
        ? getPhase3ActiveStep(phaseStep)
        : STAGE_TO_ACTIVE_STEP[stage as ExplainerStage];
  const isComplete =
    phase === "phase2"
      ? phaseStep !== undefined && isPhase2Complete(phaseStep)
      : phase === "phase3"
        ? phaseStep !== undefined && isPhase3Complete(phaseStep)
        : stage === "fadeOut" || stage === "reset" || stage === "insightOverlay";

  return (
    <div className="rounded-[12px] border border-neutral-200 bg-white px-2.5 py-2 shadow-sm">
      <div className="space-y-1">
        {steps.map((step) => {
          const isActive = !isComplete && activeStep === step.id;
          const isCompleted = isComplete || activeStep > step.id;
          const isUpcoming = !isComplete && activeStep < step.id;

          return (
            <motion.div
              key={step.id}
              className="flex items-center gap-2"
              animate={{
                opacity: isUpcoming ? 0.6 : 1,
              }}
              transition={{ duration: 0.2 }}
            >
              <div
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-medium ${
                  isActive
                    ? "bg-pink-100 text-pink-700 ring-1 ring-pink-200"
                    : isCompleted
                      ? "bg-neutral-100 text-neutral-500"
                      : "bg-neutral-50 text-neutral-400"
                }`}
              >
                {isCompleted && !isActive ? "✓" : step.id}
              </div>
              <span
                className={`text-[11px] ${
                  isActive
                    ? "font-medium text-neutral-950"
                    : isCompleted
                      ? "text-neutral-500"
                      : "text-neutral-400"
                }`}
              >
                {step.text}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
