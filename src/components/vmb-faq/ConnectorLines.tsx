"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { ExplainerStage } from "./types";

interface ConnectorLinesProps {
  stage: ExplainerStage;
  containerRef: React.RefObject<HTMLDivElement | null>;
  sendInviteRef: React.RefObject<HTMLDivElement | null>;
  paymentsRef: React.RefObject<HTMLDivElement | null>;
  clientARef: React.RefObject<HTMLDivElement | null>;
  bookedChairRef: React.RefObject<HTMLDivElement | null>;
}

interface Point {
  x: number;
  y: number;
}

function computePaths(
  container: DOMRect,
  sendInvite: DOMRect,
  payments: DOMRect,
  clientA: DOMRect,
  bookedChair: DOMRect
): {
  path1: string;
  path2: string;
  path3: string;
  pulse1: Point;
  pulse2: Point;
  pulse3: Point;
  width: number;
  height: number;
} {
  const ox = (r: DOMRect) => r.left - container.left;
  const oy = (r: DOMRect) => r.top - container.top;

  const sendInviteRight = ox(sendInvite) + sendInvite.width;
  const sendInviteCenterY = oy(sendInvite) + sendInvite.height / 2;

  const clientALeft = ox(clientA);
  const clientARight = ox(clientA) + clientA.width;
  const clientACenterY = oy(clientA) + clientA.height / 2;

  const bookedChairLeft = ox(bookedChair);
  const bookedChairBottom = oy(bookedChair) + bookedChair.height;
  const bookedChairCenterX = ox(bookedChair) + bookedChair.width / 2;
  const bookedChairCenterY = oy(bookedChair) + bookedChair.height / 2;

  const paymentsRight = ox(payments) + payments.width;
  const paymentsCenterY = oy(payments) + payments.height / 2;

  const upperY = Math.min(sendInviteCenterY, clientACenterY, bookedChairCenterY) - 12;

  const path1 = `M ${sendInviteRight} ${sendInviteCenterY} C ${(sendInviteRight + clientALeft) / 2 + 20} ${upperY}, ${(sendInviteRight + clientALeft) / 2 - 20} ${upperY}, ${clientALeft} ${clientACenterY}`;

  const path2 = `M ${clientARight} ${clientACenterY} C ${(clientARight + bookedChairLeft) / 2 + 24} ${upperY}, ${(clientARight + bookedChairLeft) / 2 - 24} ${upperY}, ${bookedChairLeft} ${bookedChairCenterY}`;

  const lowerY = Math.max(bookedChairBottom, oy(clientA) + clientA.height) + 48;
  const midX = (bookedChairCenterX + paymentsRight) / 2;
  const path3 = `M ${bookedChairCenterX} ${bookedChairBottom} C ${bookedChairCenterX} ${bookedChairBottom + 36}, ${midX} ${lowerY}, ${midX} ${lowerY} C ${paymentsRight + 28} ${paymentsCenterY}, ${paymentsRight + 8} ${paymentsCenterY}, ${paymentsRight} ${paymentsCenterY}`;

  const pulse1 = { x: (sendInviteRight + clientALeft) / 2, y: upperY };
  const pulse2 = { x: (clientARight + bookedChairLeft) / 2, y: upperY };
  const pulse3 = { x: (bookedChairCenterX + paymentsRight) / 2, y: lowerY };

  return {
    path1,
    path2,
    path3,
    pulse1,
    pulse2,
    pulse3,
    width: container.width,
    height: container.height,
  };
}

function getLineState(stage: ExplainerStage): {
  line1: number;
  line2: number;
  line3: number;
  fade1: boolean;
  fade2: boolean;
  fade3: boolean;
  showPulse1: boolean;
  showPulse2: boolean;
  showPulse3: boolean;
} {
  if (stage === "reset") {
    return {
      line1: 0,
      line2: 0,
      line3: 0,
      fade1: true,
      fade2: true,
      fade3: true,
      showPulse1: false,
      showPulse2: false,
      showPulse3: false,
    };
  }
  if (stage === "fadeOut") {
    return {
      line1: 1,
      line2: 1,
      line3: 1,
      fade1: true,
      fade2: true,
      fade3: true,
      showPulse1: false,
      showPulse2: false,
      showPulse3: false,
    };
  }
  const base = {
    fade1: false,
    fade2: false,
    fade3: false,
    showPulse1: false,
    showPulse2: false,
    showPulse3: false,
  };
  const states: Record<
    ExplainerStage,
    { line1: number; line2: number; line3: number } & typeof base
  > = {
    step1Active: { ...base, line1: 0, line2: 0, line3: 0 },
    lineOwnerToA: { ...base, line1: 1, line2: 0, line3: 0, showPulse1: true },
    clientAGlow: { ...base, line1: 1, line2: 0, line3: 0, fade1: true },
    step2Active: { ...base, line1: 1, line2: 1, line3: 0, fade1: true, showPulse2: true },
    appointmentBooked: { ...base, line1: 1, line2: 1, line3: 0, fade1: true, fade2: true },
    step3Active: { ...base, line1: 1, line2: 1, line3: 1, fade1: true, fade2: true, showPulse3: true },
    paymentReceived: {
      ...base,
      line1: 1,
      line2: 1,
      line3: 1,
      fade1: false,
      fade2: false,
      fade3: false,
    },
    insightOverlay: {
      ...base,
      line1: 1,
      line2: 1,
      line3: 1,
      fade1: false,
      fade2: false,
      fade3: false,
    },
    fadeOut: { ...base, line1: 1, line2: 1, line3: 1, fade1: true, fade2: true, fade3: true },
    reset: { ...base, line1: 0, line2: 0, line3: 0 },
  };
  return states[stage];
}

export function ConnectorLines({
  stage,
  containerRef,
  sendInviteRef,
  paymentsRef,
  clientARef,
  bookedChairRef,
}: ConnectorLinesProps) {
  const [paths, setPaths] = useState<{
    path1: string;
    path2: string;
    path3: string;
    pulse1: Point;
    pulse2: Point;
    pulse3: Point;
    width: number;
    height: number;
  } | null>(null);
  useEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      const sendInvite = sendInviteRef.current;
      const payments = paymentsRef.current;
      const clientA = clientARef.current;
      const bookedChair = bookedChairRef.current;

      if (!container || !sendInvite || !payments || !clientA || !bookedChair) return;

      const containerRect = container.getBoundingClientRect();
      const sendInviteRect = sendInvite.getBoundingClientRect();
      const paymentsRect = payments.getBoundingClientRect();
      const clientARect = clientA.getBoundingClientRect();
      const bookedChairRect = bookedChair.getBoundingClientRect();

      setPaths(
        computePaths(
          containerRect,
          sendInviteRect,
          paymentsRect,
          clientARect,
          bookedChairRect
        )
      );
    };

    const t = requestAnimationFrame(() => {
      requestAnimationFrame(measure);
    });

    const container = containerRef.current;
    if (!container) return () => cancelAnimationFrame(t);

    const ro = new ResizeObserver(measure);
    ro.observe(container);

    return () => {
      cancelAnimationFrame(t);
      ro.disconnect();
    };
  }, [
    stage,
    containerRef,
    sendInviteRef,
    paymentsRef,
    clientARef,
    bookedChairRef,
  ]);

  const state = getLineState(stage);

  if (!paths) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${paths.width} ${paths.height}`}
      preserveAspectRatio="none"
      style={{ overflow: "visible" }}
    >
      <defs>
        <filter id="pulse-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <motion.path
        d={paths.path1}
        stroke="rgb(236 72 153)"
        strokeWidth="2.5"
        strokeDasharray="8 8"
        strokeLinecap="round"
        fill="none"
        animate={{
          pathLength: state.line1,
          opacity: state.fade1 ? 0 : state.line1 > 0 ? 1 : 0,
        }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      />
      <motion.path
        d={paths.path2}
        stroke="rgb(236 72 153)"
        strokeWidth="2.5"
        strokeDasharray="8 8"
        strokeLinecap="round"
        fill="none"
        animate={{
          pathLength: state.line2,
          opacity: state.fade2 ? 0 : state.line2 > 0 ? 1 : 0,
        }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      />
      <motion.path
        d={paths.path3}
        stroke="rgb(236 72 153)"
        strokeWidth="2.5"
        strokeDasharray="8 8"
        strokeLinecap="round"
        fill="none"
        animate={{
          pathLength: state.line3,
          opacity: state.fade3 ? 0 : state.line3 > 0 ? 1 : 0,
        }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />

      {state.showPulse1 && (
        <motion.circle
          r="4"
          fill="rgb(236 72 153)"
          filter="url(#pulse-glow)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          cx={paths.pulse1.x}
          cy={paths.pulse1.y}
        />
      )}
      {state.showPulse2 && (
        <motion.circle
          r="4"
          fill="rgb(236 72 153)"
          filter="url(#pulse-glow)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          cx={paths.pulse2.x}
          cy={paths.pulse2.y}
        />
      )}
      {state.showPulse3 && (
        <motion.circle
          r="4"
          fill="rgb(236 72 153)"
          filter="url(#pulse-glow)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          cx={paths.pulse3.x}
          cy={paths.pulse3.y}
        />
      )}
    </svg>
  );
}
