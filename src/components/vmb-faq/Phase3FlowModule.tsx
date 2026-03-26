"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { SalonOwnerCardPhase3 } from "./SalonOwnerCardPhase3";
import { CoMarketingNetworkCard } from "./CoMarketingNetworkCard";
import { RightCardPhase3 } from "./RightCardPhase3";
import { ConnectorLinesPhase3 } from "./ConnectorLinesPhase3";
import { StepMonitor } from "./StepMonitor";
import { InsightOverlay } from "./InsightOverlay";

interface Phase3FlowModuleProps {
  title: string;
}

const STEPS_PER_SALON = 6;
const TOTAL_SALON_STEPS = STEPS_PER_SALON * 3;
const CLOSING_STEP = TOTAL_SALON_STEPS;
const HOLD_STEP = TOTAL_SALON_STEPS + 1;
const RESET_STEP = TOTAL_SALON_STEPS + 2;

/** Extra ms per beat so connector “line” phases read less rushed on FAQ graphic 3 */
const PHASE3_LINE_PACE_EXTRA_MS = 333;

function getNextStepDelay(step: number): number {
  let base: number;
  if (step === RESET_STEP) base = 600;
  else if (step === HOLD_STEP) base = 3500;
  else if (step === CLOSING_STEP) base = 800;
  else if (step % STEPS_PER_SALON === 0) base = 500; // salon lights + chips
  else if (step % STEPS_PER_SALON === 1) base = 550; // Co-Marketing Plan → salon
  else if (step % STEPS_PER_SALON === 2) base = 220; // salon → Join VMB
  else if (step % STEPS_PER_SALON === 3) base = 320; // Join VMB ↓ Activate Clients (immediate next beat)
  else if (step % STEPS_PER_SALON === 4) base = 550; // Activate Clients → Co-Mkt Share
  else base = 900; // hold, clear connectors
  return base + PHASE3_LINE_PACE_EXTRA_MS;
}

export function Phase3FlowModule({ title }: Phase3FlowModuleProps) {
  const [step, setStep] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const joinVMBRef = useRef<HTMLDivElement>(null);
  const activateClientsRef = useRef<HTMLDivElement>(null);
  const coMarketingPlanRef = useRef<HTMLDivElement>(null);
  const coMktShareRef = useRef<HTMLDivElement>(null);
  const salon1Ref = useRef<HTMLDivElement>(null);
  const salon2Ref = useRef<HTMLDivElement>(null);
  const salon3Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      if (step === RESET_STEP) {
        setStep(0);
      } else {
        setStep((s) => s + 1);
      }
    }, getNextStepDelay(step));
    return () => clearTimeout(t);
  }, [step]);

  const activeSalonIndex = step < TOTAL_SALON_STEPS ? Math.floor(step / STEPS_PER_SALON) : -1;
  const subStep = step < TOTAL_SALON_STEPS ? step % STEPS_PER_SALON : -1;

  const salon1Visible = step >= 0;
  const salon1ChipsVisible = step >= 0;
  const salon1Active = activeSalonIndex === 0 && subStep >= 0 && subStep <= 4;
  const salon1Completed = step > 5;

  const salon2Visible = step >= 6;
  const salon2ChipsVisible = step >= 6;
  const salon2Active = activeSalonIndex === 1 && subStep >= 0 && subStep <= 4;
  const salon2Completed = step > 11;

  const salon3Visible = step >= 12;
  const salon3ChipsVisible = step >= 12;
  const salon3Active = activeSalonIndex === 2 && subStep >= 0 && subStep <= 4;
  const salon3Completed = step > 17;

  const joinVMBActive = activeSalonIndex >= 0 && subStep >= 2 && subStep <= 5;
  const showActivateClients = step >= 2;
  const activateClientsActive = activeSalonIndex >= 0 && subStep >= 3 && subStep <= 5;
  const coMarketingPlanActive = activeSalonIndex >= 0 && subStep === 1;
  const coMktShareActive = activeSalonIndex >= 0 && subStep === 4;

  const showClosingLine = step >= CLOSING_STEP;

  return (
    <div className="relative w-full overflow-hidden rounded-[24px] border border-neutral-200 bg-neutral-50 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div className="pointer-events-none absolute inset-0 rounded-[24px] bg-[radial-gradient(circle_at_top_left,rgba(0,0,0,0.02),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(0,0,0,0.02),transparent_24%)]" />

      <div className="relative p-2.5 md:p-3">
        <h2 className="mb-2 text-lg font-semibold tracking-tight text-neutral-950">
          {title}
        </h2>

        <div className="origin-top scale-[0.95]">
          <StepMonitor phase="phase3" step={step} />
        </div>

        <div className="mt-2 overflow-hidden rounded-[18px] border border-neutral-200/60 bg-white/50">
          <motion.div
            ref={containerRef}
            className="relative grid h-[248px] grid-cols-12 gap-1.5 overflow-hidden"
          >
            <SalonOwnerCardPhase3
              coMarketingPlanRef={coMarketingPlanRef}
              coMarketingPlanActive={coMarketingPlanActive}
              coMktShareRef={coMktShareRef}
              coMktShareActive={coMktShareActive}
            />
            <CoMarketingNetworkCard
              salon1Visible={salon1Visible}
              salon1ChipsVisible={salon1ChipsVisible}
              salon1Active={salon1Active}
              salon1Completed={salon1Completed}
              salon2Visible={salon2Visible}
              salon2ChipsVisible={salon2ChipsVisible}
              salon2Active={salon2Active}
              salon2Completed={salon2Completed}
              salon3Visible={salon3Visible}
              salon3ChipsVisible={salon3ChipsVisible}
              salon3Active={salon3Active}
              salon3Completed={salon3Completed}
              salon1Ref={salon1Ref}
              salon2Ref={salon2Ref}
              salon3Ref={salon3Ref}
            />
            <RightCardPhase3
              joinVMBActive={joinVMBActive}
              activateClientsActive={activateClientsActive}
              showActivateClients={showActivateClients}
              joinVMBRef={joinVMBRef}
              activateClientsRef={activateClientsRef}
            />

            <ConnectorLinesPhase3
              step={step}
              containerRef={containerRef}
              joinVMBRef={joinVMBRef}
              activateClientsRef={activateClientsRef}
              coMarketingPlanRef={coMarketingPlanRef}
              coMktShareRef={coMktShareRef}
              salon1Ref={salon1Ref}
              salon2Ref={salon2Ref}
              salon3Ref={salon3Ref}
            />
          </motion.div>

          <div className="flex min-h-11 items-center justify-center border-t border-neutral-200/50 bg-neutral-50/80 py-[5px]">
            <InsightOverlay
              visible={showClosingLine}
              text="One strong salon can grow a network"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
