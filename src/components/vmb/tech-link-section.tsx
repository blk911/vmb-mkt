"use client";

import type { BaseEntity, Cluster } from "@/lib/cluster/types";
import { linkTechsToShop } from "@/lib/linking/tech-shop-linker";

const GROUP_ORDER = ["confirmed", "likely", "candidate", "weak"] as const;

export default function TechLinkSection({
  cluster,
  allEntities,
}: {
  cluster: Cluster;
  allEntities: BaseEntity[];
}) {
  const links = linkTechsToShop(cluster, allEntities);

  const grouped = {
    confirmed: links.filter((l) => l.level === "confirmed"),
    likely: links.filter((l) => l.level === "likely"),
    candidate: links.filter((l) => l.level === "candidate"),
    weak: links.filter((l) => l.level === "weak"),
  };

  if (!links.length) {
    return (
      <p className="text-sm text-neutral-600">
        No DORA person rows in the payload — add tech entities to score shop relationships.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500">
        Scored relationships (0–100); not hard assignments — use levels to prioritize review.
      </p>
      {GROUP_ORDER.map((group) => {
        const rows = grouped[group];
        if (!rows.length) return null;

        return (
          <div key={group}>
            <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-800">{group}</div>

            <div className="space-y-2">
              {rows.map((l) => (
                <div key={l.tech.id} className="rounded-lg border border-neutral-200 bg-neutral-50/80 p-2.5">
                  <div className="font-medium text-neutral-900">{l.tech.name}</div>
                  <div className="mt-0.5 text-xs text-neutral-500">
                    score {l.score} · {l.notes.length ? l.notes.join(", ") : "—"} · N{l.signals.nameMatch} P
                    {l.signals.proximity} C{l.signals.categoryMatch} L{l.signals.locationSupport}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
