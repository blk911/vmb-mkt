"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface ConnectorLinesPhase2Props {
  step: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  serviceValueRef: React.RefObject<HTMLDivElement | null>;
  clientARef: React.RefObject<HTMLDivElement | null>;
  clientDRef: React.RefObject<HTMLDivElement | null>;
  rightCardRef: React.RefObject<HTMLDivElement | null>;
  bookAppointmentRef: React.RefObject<HTMLDivElement | null>;
  paymentsRef: React.RefObject<HTMLDivElement | null>;
}

interface Point {
  x: number;
  y: number;
}

function computePathsPhase2(
  container: DOMRect,
  serviceValue: DOMRect,
  clientA: DOMRect,
  rightCard: DOMRect,
  bookAppointment: DOMRect,
  payments: DOMRect,
  clientD: DOMRect | null
): {
  path0: string;
  path1: string;
  path2: string;
  path3: string;
  pulse: Point;
  width: number;
  height: number;
} {
  const ox = (r: DOMRect) => r.left - container.left;
  const oy = (r: DOMRect) => r.top - container.top;

  const serviceValueRight = ox(serviceValue) + serviceValue.width;
  const serviceValueCenterY = oy(serviceValue) + serviceValue.height / 2;
  const clientARight = ox(clientA) + clientA.width;
  const clientACenterY = oy(clientA) + clientA.height / 2;
  const clientABottom = oy(clientA) + clientA.height;
  const clientACenterX = ox(clientA) + clientA.width / 2;
  const clientALeft = ox(clientA);

  const rightCardLeft = ox(rightCard);
  const rightCardCenterY = oy(rightCard) + rightCard.height / 2;

  const bookAppCenterX = ox(bookAppointment) + bookAppointment.width / 2;
  const bookAppBottom = oy(bookAppointment) + bookAppointment.height;

  const paymentsRight = ox(payments) + payments.width;
  const paymentsCenterY = oy(payments) + payments.height / 2;

  const upperY = Math.min(clientACenterY, rightCardCenterY) - 12;

  const serviceToAY = Math.min(serviceValueCenterY, clientACenterY) - 12;
  const path0 = `M ${serviceValueRight} ${serviceValueCenterY} C ${(serviceValueRight + clientALeft) / 2 + 20} ${serviceToAY}, ${(serviceValueRight + clientALeft) / 2 - 20} ${serviceToAY}, ${clientALeft} ${clientACenterY}`;

  const path1 = `M ${clientARight} ${clientACenterY} C ${(clientARight + rightCardLeft) / 2 + 24} ${upperY}, ${(clientARight + rightCardLeft) / 2 - 24} ${upperY}, ${rightCardLeft} ${rightCardCenterY}`;

  const lowerY = Math.max(bookAppBottom, clientABottom) + 48;
  const midX = (bookAppCenterX + paymentsRight) / 2;
  const path2 = `M ${bookAppCenterX} ${bookAppBottom} C ${bookAppCenterX} ${bookAppBottom + 36}, ${midX} ${lowerY}, ${midX} ${lowerY} C ${paymentsRight + 28} ${paymentsCenterY}, ${paymentsRight + 8} ${paymentsCenterY}, ${paymentsRight} ${paymentsCenterY}`;

  const dCenterX = clientD ? ox(clientD) + clientD.width / 2 : clientACenterX;
  const dTop = clientD ? oy(clientD) : clientABottom + 20;
  const midY = (clientABottom + dTop) / 2;
  const path3 = `M ${clientACenterX} ${clientABottom} C ${clientACenterX} ${midY}, ${dCenterX} ${midY}, ${dCenterX} ${dTop}`;

  const pulse = { x: (clientARight + rightCardLeft) / 2, y: upperY };

  return { path0, path1, path2, path3, pulse, width: container.width, height: container.height };
}

function getLineState(step: number): {
  line0: number;
  line1: number;
  line2: number;
  line3: number;
  fade0: boolean;
  fade1: boolean;
  fade2: boolean;
  fade3: boolean;
  showPulse: boolean;
} {
  if (step === 0) return { line0: 0, line1: 0, line2: 0, line3: 0, fade0: false, fade1: false, fade2: false, fade3: false, showPulse: false };
  if (step === 1) return { line0: 1, line1: 0, line2: 0, line3: 0, fade0: false, fade1: false, fade2: false, fade3: false, showPulse: false };
  if (step === 2) return { line0: 1, line1: 0, line2: 0, line3: 0, fade0: true, fade1: false, fade2: false, fade3: false, showPulse: false };
  if (step === 3) return { line0: 1, line1: 1, line2: 0, line3: 0, fade0: true, fade1: false, fade2: false, fade3: false, showPulse: true };
  if (step === 4) return { line0: 1, line1: 1, line2: 0, line3: 0, fade0: true, fade1: false, fade2: false, fade3: false, showPulse: false };
  if (step === 5) return { line0: 1, line1: 1, line2: 1, line3: 0, fade0: true, fade1: false, fade2: false, fade3: false, showPulse: false };
  if (step === 6) return { line0: 1, line1: 1, line2: 1, line3: 0, fade0: true, fade1: false, fade2: false, fade3: false, showPulse: false };
  if (step === 7) return { line0: 0, line1: 0, line2: 0, line3: 1, fade0: true, fade1: true, fade2: true, fade3: false, showPulse: false };
  if (step === 8) return { line0: 0, line1: 0, line2: 0, line3: 0, fade0: true, fade1: true, fade2: true, fade3: true, showPulse: false };
  if (step === 9) return { line0: 0, line1: 0, line2: 0, line3: 0, fade0: true, fade1: true, fade2: true, fade3: true, showPulse: false };
  return { line0: 0, line1: 0, line2: 0, line3: 0, fade0: true, fade1: true, fade2: true, fade3: true, showPulse: false };
}

export function ConnectorLinesPhase2({
  step,
  containerRef,
  serviceValueRef,
  clientARef,
  clientDRef,
  rightCardRef,
  bookAppointmentRef,
  paymentsRef,
}: ConnectorLinesPhase2Props) {
  const [pathData, setPathData] = useState<{
    path0: string;
    path1: string;
    path2: string;
    path3: string;
    pulse: Point;
    width: number;
    height: number;
  } | null>(null);

  const showPath2 = step >= 3 && step <= 4;
  const showPath3 = step === 5;

  useEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      const serviceValue = serviceValueRef.current;
      const clientA = clientARef.current;
      const clientD = clientDRef.current;
      const rightCard = rightCardRef.current;
      const bookAppointment = bookAppointmentRef.current;
      const payments = paymentsRef.current;

      if (!container || !serviceValue || !clientA || !rightCard || !payments) return;

      const containerRect = container.getBoundingClientRect();
      const serviceValueRect = serviceValue.getBoundingClientRect();
      const clientARect = clientA.getBoundingClientRect();
      const rightCardRect = rightCard.getBoundingClientRect();
      const paymentsRect = payments.getBoundingClientRect();
      const bookAppRect = bookAppointment?.getBoundingClientRect?.()
        ? (bookAppointment.getBoundingClientRect() as DOMRect)
        : ({
            left: rightCardRect.left + rightCardRect.width / 2 - 25,
            top: rightCardRect.bottom + 25,
            width: 50,
            height: 50,
          } as DOMRect);
      const clientDRect = clientD?.getBoundingClientRect?.() ?? null;

      setPathData(
        computePathsPhase2(containerRect, serviceValueRect, clientARect, rightCardRect, bookAppRect, paymentsRect, clientDRect)
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
  }, [step, containerRef, serviceValueRef, clientARef, clientDRef, rightCardRef, bookAppointmentRef, paymentsRef, showPath2, showPath3]);

  const state = getLineState(step);

  if (!pathData) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${pathData.width} ${pathData.height}`}
      preserveAspectRatio="none"
      style={{ overflow: "visible" }}
    >
      <defs>
        <filter id="pulse-glow-p2">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <motion.path
        d={pathData.path0}
        stroke="rgb(236 72 153)"
        strokeWidth="2.5"
        strokeDasharray="8 8"
        strokeLinecap="round"
        fill="none"
        animate={{
          pathLength: state.line0,
          opacity: state.fade0 ? 0 : state.line0 > 0 ? 1 : 0,
        }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      />
      <motion.path
        d={pathData.path1}
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
        d={pathData.path2}
        stroke="rgb(236 72 153)"
        strokeWidth="2.5"
        strokeDasharray="8 8"
        strokeLinecap="round"
        fill="none"
        animate={{
          pathLength: state.line2,
          opacity: state.fade2 ? 0 : state.line2 > 0 ? 1 : 0,
        }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
      <motion.path
        d={pathData.path3}
        stroke="rgb(236 72 153)"
        strokeWidth="2.5"
        strokeDasharray="8 8"
        strokeLinecap="round"
        fill="none"
        animate={{
          pathLength: state.line3,
          opacity: state.fade3 ? 0 : state.line3 > 0 ? 1 : 0,
        }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      />

      {state.showPulse && (
        <motion.circle
          r="4"
          fill="rgb(236 72 153)"
          filter="url(#pulse-glow-p2)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          cx={pathData.pulse.x}
          cy={pathData.pulse.y}
        />
      )}
    </svg>
  );
}
