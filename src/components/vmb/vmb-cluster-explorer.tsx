"use client";

import { useState } from "react";
import { useClusters } from "@/hooks/useClusters";
import ViewToggle, { type ViewMode } from "@/components/vmb/view-toggle";
import ClusterList from "@/components/vmb/cluster-list";
import type { BaseEntity } from "@/lib/cluster/types";

type Props = {
  data: BaseEntity[];
};

export default function VmbClusterExplorer({ data }: Props) {
  const [mode, setMode] = useState<ViewMode>("shops");

  const clusters = useClusters(data);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">Cluster engine (phase 1–2)</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Shop clusters as primary rows; techs and raw records as attached evidence. Toggle views below.
      </p>

      <div className="mt-4">
        <ViewToggle mode={mode} setMode={setMode} />

        {mode === "shops" ? <ClusterList clusters={clusters} /> : null}

        {mode === "techs" ? (
          <div className="space-y-1 rounded-lg border border-neutral-200 bg-white p-3 text-sm">
            {data
              .filter((d) => d.type === "dora_person")
              .map((d) => (
                <div key={d.id} className="text-neutral-800">
                  {d.name}
                  {d.category ? <span className="ml-2 text-xs text-neutral-500">({d.category})</span> : null}
                </div>
              ))}
            {!data.some((d) => d.type === "dora_person") ? (
              <p className="text-neutral-500">No DORA person rows in this payload.</p>
            ) : null}
          </div>
        ) : null}

        {mode === "raw" ? (
          <pre className="max-h-[min(480px,60vh)] overflow-auto rounded-lg border border-neutral-200 bg-white p-3 text-xs text-neutral-800">
            {JSON.stringify(data, null, 2)}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
