import type { Cluster } from "@/lib/cluster/types";

export default function ClusterRow({ c }: { c: Cluster }) {
  return (
    <div className="mb-2 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="font-semibold text-neutral-900">{c.displayName}</div>

      <div className="text-sm text-neutral-500">
        {c.status.toUpperCase()} · Score {c.confidence}
      </div>

      <div className="mt-1 text-xs text-neutral-600">
        Google: {c.google.length} · DORA Shops: {c.doraShops.length} · Techs: {c.doraPeople.length}
      </div>

      {c.reasons.length ? (
        <ul className="mt-2 list-inside list-disc text-[11px] text-neutral-500">
          {c.reasons.slice(0, 5).map((r, i) => (
            <li key={i} className="break-all">
              {r}
            </li>
          ))}
          {c.reasons.length > 5 ? <li>…+{c.reasons.length - 5} more</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
