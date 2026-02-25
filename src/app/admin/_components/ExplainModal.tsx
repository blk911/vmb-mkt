"use client";

import { useEffect, useState } from "react";

export function ExplainModal({
  open,
  cityKey,
  onClose,
}: {
  open: boolean;
  cityKey: string | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !cityKey) return;
    setData(null);
    setErr(null);
    fetch(`/api/admin/dora/truth/explain/city/${encodeURIComponent(cityKey)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setData(j))
      .catch((e) => setErr(String(e)));
  }, [open, cityKey]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-6">
      <div className="w-full max-w-5xl rounded-xl bg-white p-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-semibold">Explain</div>
          <button className="rounded-md border px-3 py-1" onClick={onClose}>
            Close
          </button>
        </div>

        {!data && !err && <div className="mt-4 text-sm opacity-70">Loading...</div>}
        {err && <div className="mt-4 text-sm text-red-600">{err}</div>}
        {data?.ok && (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border p-3">
              <div className="font-medium">{data.city.cityLabel}</div>
              <div className="text-xs opacity-70">
                reg={data.city.regCount} • tech={data.city.techCount} • tech/reg={data.city.techPerReg} • addresses={data.city.addrCount} • cand={data.city.candCount}
              </div>
              {Array.isArray(data.city.reasons) && data.city.reasons.length > 0 && (
                <div className="mt-2 text-xs">
                  <div className="font-semibold">Reasons</div>
                  <ul className="list-disc pl-5">
                    {data.city.reasons.map((x: string, i: number) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="rounded-lg border p-3">
              <div className="font-semibold">Top contributing addresses</div>
              <div className="mt-2 max-h-[420px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-left border-b">
                      <th className="py-2 pr-3">AddressKey</th>
                      <th className="py-2 pr-3">ZIP</th>
                      <th className="py-2 pr-3">REG</th>
                      <th className="py-2 pr-3">TECH</th>
                      <th className="py-2 pr-3">SEG</th>
                      <th className="py-2 pr-3">Brand</th>
                      <th className="py-2 pr-3">Cand</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topAddresses.map((r: any) => (
                      <tr key={r.addressId} className="border-b">
                        <td className="py-2 pr-3">{r.addressKey}</td>
                        <td className="py-2 pr-3">{r.zip5}</td>
                        <td className="py-2 pr-3">{r.regCount}</td>
                        <td className="py-2 pr-3">{r.techCount}</td>
                        <td className="py-2 pr-3">{r.seg}</td>
                        <td className="py-2 pr-3">{r.brandKey || ""}</td>
                        <td className="py-2 pr-3">{r.cand}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 text-xs opacity-70">Showing top 50 addresses by TECH.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
