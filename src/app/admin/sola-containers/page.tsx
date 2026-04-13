"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminTopNav } from "@/components/admin/AdminTopNav";
import { SolaContainerSeedButton } from "@/components/admin/sola-containers/SolaContainerSeedButton";
import { SolaContainerTable } from "@/components/admin/sola-containers/SolaContainerTable";
import { SolaTenantImportForm } from "@/components/admin/sola-containers/SolaTenantImportForm";
import { SolaTenantTable } from "@/components/admin/sola-containers/SolaTenantTable";
import type { SolaContainer, SolaTenantRecord } from "@/lib/sola-containers/types";

type ContainersResponse = {
  ok: boolean;
  error?: string;
  containers?: SolaContainer[];
  inserted?: number;
  skipped?: number;
  total?: number;
  container?: SolaContainer;
};

type TenantsResponse = {
  ok: boolean;
  error?: string;
  container?: SolaContainer;
  tenants?: SolaTenantRecord[];
  inserted?: number;
  skipped?: number;
  totalTenants?: number;
};

// This page is the canonical parent-container intake surface for Sola-based
// tenant mapping before any downstream operator promotion or enrichment.
export default function Page() {
  const [containers, setContainers] = useState<SolaContainer[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<SolaContainer | null>(null);
  const [tenants, setTenants] = useState<SolaTenantRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const loadContainers = useCallback(async (selectContainerId?: string) => {
    setLoading(true);
    try {
      const response = await fetch("/api/sola-containers", { cache: "no-store" });
      const json = (await response.json()) as ContainersResponse;
      if (!response.ok || !json.ok) throw new Error(json.error || "Failed to load Sola containers");
      const nextContainers = json.containers ?? [];
      setContainers(nextContainers);
      setSelectedContainer((current) => {
        const targetId = selectContainerId || current?.id;
        if (!targetId) return current;
        return nextContainers.find((container) => container.id === targetId) || null;
      });
      setPageError(null);
    } catch (error: unknown) {
      setPageError(error instanceof Error ? error.message : "Failed to load Sola containers");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTenants = useCallback(async (containerId: string) => {
    setTenantLoading(true);
    setBusyKey(`select:${containerId}`);
    try {
      const response = await fetch(`/api/sola-containers/${encodeURIComponent(containerId)}/tenants`, {
        cache: "no-store",
      });
      const json = (await response.json()) as TenantsResponse;
      if (!response.ok || !json.ok || !json.container) {
        throw new Error(json.error || "Failed to load tenant records");
      }
      setSelectedContainer(json.container);
      setTenants(json.tenants ?? []);
      setPageError(null);
    } catch (error: unknown) {
      setPageError(error instanceof Error ? error.message : "Failed to load tenant records");
    } finally {
      setBusyKey(null);
      setTenantLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContainers();
  }, [loadContainers]);

  return (
    <main className="min-h-screen bg-neutral-50">
      <AdminTopNav />
      <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-950">Sola Containers</h1>
            <p className="mt-1 text-sm text-neutral-600">
              Canonical parent-container seeds for Sola tenant extraction.
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              This page is the canonical parent-container intake surface for Sola-based tenant mapping.
            </p>
          </div>
          <SolaContainerSeedButton
            busy={busyKey === "seed"}
            onSeed={() =>
              void (async () => {
                setBusyKey("seed");
                try {
                  const response = await fetch("/api/sola-containers", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "seed_denver" }),
                  });
                  const json = (await response.json()) as ContainersResponse;
                  if (!response.ok || !json.ok) throw new Error(json.error || "Failed to seed Denver Sola");
                  await loadContainers(selectedContainer?.id);
                  setPageError(null);
                } catch (error: unknown) {
                  setPageError(error instanceof Error ? error.message : "Failed to seed Denver Sola");
                } finally {
                  setBusyKey(null);
                }
              })()
            }
          />
        </div>

        {pageError ? <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{pageError}</div> : null}

        <SolaContainerTable
          containers={containers}
          selectedContainerId={selectedContainer?.id}
          busyKey={busyKey}
          onSelect={(containerId) => void loadTenants(containerId)}
          onMarkReady={(containerId) =>
            void (async () => {
              setBusyKey(`ready:${containerId}`);
              try {
                const response = await fetch("/api/sola-containers", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "mark_ready", containerId }),
                });
                const json = (await response.json()) as ContainersResponse;
                if (!response.ok || !json.ok || !json.container) {
                  throw new Error(json.error || "Failed to update container status");
                }
                await loadContainers(containerId);
                if (selectedContainer?.id === containerId) {
                  setSelectedContainer(json.container);
                }
                setPageError(null);
              } catch (error: unknown) {
                setPageError(error instanceof Error ? error.message : "Failed to update container status");
              } finally {
                setBusyKey(null);
              }
            })()
          }
        />

        {loading ? (
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-500 shadow-sm">
            Loading Sola containers...
          </section>
        ) : null}

        {selectedContainer ? (
          <>
            <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-neutral-900">{selectedContainer.name}</h2>
              <p className="mt-1 text-sm text-neutral-600">
                {selectedContainer.city}, {selectedContainer.state}
                {selectedContainer.zip ? ` ${selectedContainer.zip}` : ""}
                {selectedContainer.phone ? ` • ${selectedContainer.phone}` : ""}
              </p>
            </section>

            <SolaTenantImportForm
              containerName={selectedContainer.name}
              busy={busyKey === `import:${selectedContainer.id}`}
              onImport={async (pastedText) => {
                setBusyKey(`import:${selectedContainer.id}`);
                try {
                  const response = await fetch(`/api/sola-containers/${encodeURIComponent(selectedContainer.id)}/tenants`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      mode: "manual_text",
                      sourceType: "manual_extract",
                      pastedText,
                    }),
                  });
                  const json = (await response.json()) as TenantsResponse;
                  if (!response.ok || !json.ok || !json.container) {
                    throw new Error(json.error || "Failed to import tenants");
                  }
                  setSelectedContainer(json.container);
                  setTenants(json.tenants ?? []);
                  await loadContainers(selectedContainer.id);
                  setPageError(null);
                  return {
                    inserted: json.inserted ?? 0,
                    skipped: json.skipped ?? 0,
                    totalTenants: json.totalTenants ?? (json.tenants ?? []).length,
                  };
                } finally {
                  setBusyKey(null);
                }
              }}
            />

            <SolaTenantTable tenants={tenants} loading={tenantLoading} />
          </>
        ) : null}
      </div>
    </main>
  );
}
