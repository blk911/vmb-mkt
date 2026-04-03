"use client";

import React from "react";

const nodes = [
  { id: "A", x: 15, y: 40 },
  { id: "B", x: 35, y: 20 },
  { id: "C", x: 50, y: 45 },
  { id: "D", x: 30, y: 60 },
  { id: "E", x: 55, y: 65 },
  { id: "F", x: 70, y: 40 },
  { id: "G", x: 60, y: 20 },
  { id: "H", x: 80, y: 60 },
] as const;

const connections = [
  ["A", "B"],
  ["A", "C"],
  ["B", "C"],
  ["B", "G"],
  ["C", "D"],
  ["C", "E"],
  ["D", "E"],
  ["E", "F"],
  ["F", "G"],
  ["F", "H"],
  ["E", "H"],
  ["C", "F"],
] as const;

export default function ClientNetworkVisual() {
  const getNode = (id: string) => nodes.find((n) => n.id === id)!;

  return (
    <div className="relative h-[260px] w-full overflow-hidden rounded-2xl bg-gradient-to-r from-blue-50 via-white to-blue-50">
      {/* Glow background */}
      <div className="absolute inset-0 bg-blue-200 opacity-40 blur-2xl" />

      {/* SVG Network */}
      <svg className="absolute inset-0 h-full w-full">
        {connections.map(([a, b], i) => {
          const n1 = getNode(a);
          const n2 = getNode(b);
          return (
            <line
              key={i}
              x1={`${n1.x}%`}
              y1={`${n1.y}%`}
              x2={`${n2.x}%`}
              y2={`${n2.y}%`}
              stroke="rgba(59,130,246,0.35)"
              strokeWidth="1.5"
              className="animate-pulse"
            />
          );
        })}
      </svg>

      {/* Nodes */}
      {nodes.map((node) => (
        <div
          key={node.id}
          className="absolute rounded-full border bg-white px-3 py-1 text-sm shadow-md"
          style={{
            left: `${node.x}%`,
            top: `${node.y}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          Client {node.id}
        </div>
      ))}

      {/* Salon (disconnected) */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 rounded-xl border bg-white px-4 py-2 shadow-lg">
        <div className="font-semibold">Your Salon</div>
        <div className="text-xs text-gray-500">Outside the flow</div>
      </div>
    </div>
  );
}
