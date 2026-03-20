import type { BaseEntity } from "./types";
import { nameTokens } from "./normalize";

function distance(a: BaseEntity, b: BaseEntity): number {
  if (a.lat == null || b.lat == null || a.lng == null || b.lng == null) return 999;

  const dx = a.lat - b.lat;
  const dy = a.lng - b.lng;
  return Math.sqrt(dx * dx + dy * dy) * 69; // miles approx
}

function distanceScore(d: number): number {
  if (d <= 0.02) return 35;
  if (d <= 0.04) return 30;
  if (d <= 0.06) return 24;
  if (d <= 0.1) return 16;
  if (d <= 0.16) return 8;
  return 0;
}

function nameScore(a: BaseEntity, b: BaseEntity): number {
  const ta = nameTokens(a.name);
  const tb = nameTokens(b.name);

  const overlap = ta.filter((t) => tb.includes(t));

  if (overlap.length === 0) return 0;
  if (overlap.length >= Math.min(ta.length, tb.length)) return 30;
  if (overlap.length >= 2) return 24;
  if (overlap.length === 1) return 12;

  return 0;
}

function categoryScore(a: BaseEntity, b: BaseEntity): number {
  if (!a.category || !b.category) return 0;
  if (a.category === b.category) return 15;
  return 5;
}

export function scoreMatch(a: BaseEntity, b: BaseEntity) {
  const d = distance(a, b);

  const total = distanceScore(d) + nameScore(a, b) + categoryScore(a, b);

  return {
    score: total,
    distance: d,
  };
}
