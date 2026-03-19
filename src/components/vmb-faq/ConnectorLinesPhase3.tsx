"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const STEPS_PER_SALON = 6;
const TOTAL_SALON_STEPS = STEPS_PER_SALON * 3;

interface ConnectorLinesPhase3Props {
  step: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  joinVMBRef: React.RefObject<HTMLDivElement | null>;
  activateClientsRef: React.RefObject<HTMLDivElement | null>;
  coMarketingPlanRef: React.RefObject<HTMLDivElement | null>;
  coMktShareRef: React.RefObject<HTMLDivElement | null>;
  salon1Ref: React.RefObject<HTMLDivElement | null>;
  salon2Ref: React.RefObject<HTMLDivElement | null>;
  salon3Ref: React.RefObject<HTMLDivElement | null>;
}

interface Point {
  x: number;
  y: number;
}

interface Paths {
  coMktToSalon1: string;
  coMktToSalon2: string;
  coMktToSalon3: string;
  salon1ToJoin: string;
  salon2ToJoin: string;
  salon3ToJoin: string;
  joinToActivate: string;
  activateToCoMkt: string;
  width: number;
  height: number;
}

function rightCenter(r: DOMRect, c: DOMRect): Point {
  return {
    x: r.right - c.left,
    y: r.top - c.top + r.height / 2,
  };
}

function leftCenter(r: DOMRect, c: DOMRect): Point {
  return {
    x: r.left - c.left,
    y: r.top - c.top + r.height / 2,
  };
}

function bottomCenter(r: DOMRect, c: DOMRect): Point {
  return {
    x: r.left - c.left + r.width / 2,
    y: r.bottom - c.top,
  };
}

function topCenter(r: DOMRect, c: DOMRect): Point {
  return {
    x: r.left - c.left + r.width / 2,
    y: r.top - c.top,
  };
}

function curvedPath(start: Point, end: Point): string {
  const curveLift = Math.min(start.y, end.y) - 14;
  const cp1x = (start.x + end.x) / 2 + 18;
  const cp2x = (start.x + end.x) / 2 - 18;
  return `M ${start.x} ${start.y} C ${cp1x} ${curveLift}, ${cp2x} ${curveLift}, ${end.x} ${end.y}`;
}

function computePaths(
  container: DOMRect,
  joinVMB: DOMRect,
  activate: DOMRect,
  coMarketingPlan: DOMRect,
  coMkt: DOMRect,
  salon1: DOMRect | null,
  salon2: DOMRect | null,
  salon3: DOMRect | null
): Paths | null {
  const coPlanStart = rightCenter(coMarketingPlan, container);
  const coMktEnd = rightCenter(coMkt, container);
  const joinRecv = leftCenter(joinVMB, container);
  const joinSend = bottomCenter(joinVMB, container);
  const activateRecv = topCenter(activate, container);
  const activateSend = leftCenter(activate, container);

  // Return path should dip down first, then rise into Co-Mkt Share.
  const returnDipY = Math.max(activateSend.y, coMktEnd.y) + 52;
  const returnMidX = (activateSend.x + coMktEnd.x) / 2;
  const activateToCoMkt = `M ${activateSend.x} ${activateSend.y} C ${activateSend.x - 22} ${returnDipY}, ${returnMidX} ${returnDipY}, ${coMktEnd.x} ${coMktEnd.y}`;

  const buildCoPlanToSalon = (salon: DOMRect): string =>
    curvedPath(coPlanStart, leftCenter(salon, container));

  const buildSalonToJoin = (salon: DOMRect): string =>
    curvedPath(rightCenter(salon, container), joinRecv);

  const joinToActivate = `M ${joinSend.x} ${joinSend.y} L ${activateRecv.x} ${activateRecv.y}`;

  return {
    coMktToSalon1: salon1 ? buildCoPlanToSalon(salon1) : "",
    coMktToSalon2: salon2 ? buildCoPlanToSalon(salon2) : "",
    coMktToSalon3: salon3 ? buildCoPlanToSalon(salon3) : "",
    salon1ToJoin: salon1 ? buildSalonToJoin(salon1) : "",
    salon2ToJoin: salon2 ? buildSalonToJoin(salon2) : "",
    salon3ToJoin: salon3 ? buildSalonToJoin(salon3) : "",
    joinToActivate,
    activateToCoMkt,
    width: container.width,
    height: container.height,
  };
}

/**
 * Sequence: Co-Marketing Plan → salon → Join VMB → Activate Clients → Co-Mkt Share
 * One active salon at a time. Connectors visible during subSteps 1-4, removed at hold (subStep 5).
 */
function getLineVisibility(step: number): {
  coMktToSalon1: number;
  coMktToSalon2: number;
  coMktToSalon3: number;
  salon1ToJoin: number;
  salon2ToJoin: number;
  salon3ToJoin: number;
  joinToActivate: number;
  activateToCoMkt: number;
} {
  const subStep = step < TOTAL_SALON_STEPS ? step % STEPS_PER_SALON : -1;
  const activeIndex = step < TOTAL_SALON_STEPS ? Math.floor(step / STEPS_PER_SALON) : -1;

  const showCoMktTo1 = activeIndex === 0 && subStep >= 1 && subStep <= 5 ? 1 : 0;
  const showCoMktTo2 = activeIndex === 1 && subStep >= 1 && subStep <= 5 ? 1 : 0;
  const showCoMktTo3 = activeIndex === 2 && subStep >= 1 && subStep <= 5 ? 1 : 0;

  const showSalon1ToJoin = activeIndex === 0 && subStep >= 2 && subStep <= 5 ? 1 : 0;
  const showSalon2ToJoin = activeIndex === 1 && subStep >= 2 && subStep <= 5 ? 1 : 0;
  const showSalon3ToJoin = activeIndex === 2 && subStep >= 2 && subStep <= 5 ? 1 : 0;

  const showJoinToActivate = activeIndex >= 0 && subStep >= 2 && subStep <= 5 ? 1 : 0;
  const showActivateToCoMkt = activeIndex >= 0 && subStep >= 4 && subStep <= 5 ? 1 : 0;

  return {
    coMktToSalon1: showCoMktTo1,
    coMktToSalon2: showCoMktTo2,
    coMktToSalon3: showCoMktTo3,
    salon1ToJoin: showSalon1ToJoin,
    salon2ToJoin: showSalon2ToJoin,
    salon3ToJoin: showSalon3ToJoin,
    joinToActivate: showJoinToActivate,
    activateToCoMkt: showActivateToCoMkt,
  };
}

export function ConnectorLinesPhase3({
  step,
  containerRef,
  joinVMBRef,
  activateClientsRef,
  coMarketingPlanRef,
  coMktShareRef,
  salon1Ref,
  salon2Ref,
  salon3Ref,
}: ConnectorLinesPhase3Props) {
  const [paths, setPaths] = useState<Paths | null>(null);

  useEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      const joinVMB = joinVMBRef.current;
      const activate = activateClientsRef.current;
      const coPlan = coMarketingPlanRef.current;
      const coMkt = coMktShareRef.current;
      const s1 = salon1Ref.current;
      const s2 = salon2Ref.current;
      const s3 = salon3Ref.current;

      if (!container || !joinVMB || !activate || !coPlan || !coMkt) return;

      const containerRect = container.getBoundingClientRect();
      const joinRect = joinVMB.getBoundingClientRect();
      const activateRect = activate.getBoundingClientRect();
      const coPlanRect = coPlan.getBoundingClientRect();
      const coMktRect = coMkt.getBoundingClientRect();
      const salon1Rect = s1?.getBoundingClientRect() ?? null;
      const salon2Rect = s2?.getBoundingClientRect() ?? null;
      const salon3Rect = s3?.getBoundingClientRect() ?? null;

      setPaths(
        computePaths(
          containerRect,
          joinRect,
          activateRect,
          coPlanRect,
          coMktRect,
          salon1Rect,
          salon2Rect,
          salon3Rect
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
    step,
    containerRef,
    joinVMBRef,
    activateClientsRef,
    coMarketingPlanRef,
    coMktShareRef,
    salon1Ref,
    salon2Ref,
    salon3Ref,
  ]);

  if (!paths) return null;

  const vis = getLineVisibility(step);
  const strokeProps = {
    stroke: "rgb(236 72 153)",
    strokeWidth: "2.5",
    strokeDasharray: "8 8",
    strokeLinecap: "round" as const,
    fill: "none",
  };

  const pathEl = (d: string, pathLength: number) => (
    <motion.path
      d={d}
      {...strokeProps}
      animate={{
        pathLength,
        opacity: pathLength > 0 ? 1 : 0,
      }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    />
  );

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${paths.width} ${paths.height}`}
      preserveAspectRatio="none"
      style={{ overflow: "visible" }}
    >
      {paths.coMktToSalon1 && pathEl(paths.coMktToSalon1, vis.coMktToSalon1)}
      {paths.coMktToSalon2 && pathEl(paths.coMktToSalon2, vis.coMktToSalon2)}
      {paths.coMktToSalon3 && pathEl(paths.coMktToSalon3, vis.coMktToSalon3)}
      {paths.salon1ToJoin && pathEl(paths.salon1ToJoin, vis.salon1ToJoin)}
      {paths.salon2ToJoin && pathEl(paths.salon2ToJoin, vis.salon2ToJoin)}
      {paths.salon3ToJoin && pathEl(paths.salon3ToJoin, vis.salon3ToJoin)}
      {paths.joinToActivate && pathEl(paths.joinToActivate, vis.joinToActivate)}
      {paths.activateToCoMkt && pathEl(paths.activateToCoMkt, vis.activateToCoMkt)}
    </svg>
  );
}
