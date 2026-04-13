"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminTopNav } from "@/components/admin/AdminTopNav";
import { SolaContainerSeedButton } from "@/components/admin/sola-containers/SolaContainerSeedButton";
import { SolaContainerTable } from "@/components/admin/sola-containers/SolaContainerTable";
import { SolaContainerUrlForm } from "@/components/admin/sola-containers/SolaContainerUrlForm";
import { SolaTenantImportForm } from "@/components/admin/sola-containers/SolaTenantImportForm";
import { SolaTenantTable } from "@/components/admin/sola-containers/SolaTenantTable";
import type { SolaContainer, SolaContainerStatus, SolaTenantRecord } from "@/lib/sola-containers/types";

const PRIORITY_FIRST_WAVE = [
  "Parker Rd. and Chambers",
  "Southlands",
  "Parker",
  "Castle Rock",
  "Belmar",
] as const;

const STATUS_OPTIONS: Array<{ label: string; value: "all" | SolaContainerStatus }> = [
  { label: "All statuses", value: "all" },
  { label: "seeded", value: "seeded" },
  { label: "resolved", value: "resolved" },
  { label: "tenant_pull_ready", value: "tenant_pull_ready" },
  { label: "tenant_pull_in_progress", value: "tenant_pull_in_progress" },
  { label: "tenant_pull_complete", value: "tenant_pull_complete" },
];

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

type ContainerFilters = {
  search: string;
  city: string;
  status: "all" | SolaContainerStatus;
  priorityOnly: boolean;
};

// This page supports both parent-container resolution and child tenant intake
// in a single container-first workflow before any downstream promotion.
export default function Page() {
  const [containers, setContainers] = useState<SolaContainer[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<SolaContainer | null>(null);
  const [tenants, setTenants] = useState<SolaTenantRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ContainerFilters>({
    search: "",
    city: "all",
    status: "all",
    priorityOnly: false,
  });

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

  const cityOptions = useMemo(() => {
    return ["all", ...new Set(containers.map((container) => container.city).filter(Boolean))];
  }, [containers]);

  const filteredContainers = useMemo(() => {
    const prioritySet = new Set(PRIORITY_FIRST_WAVE.map((name) => name.toLowerCase()));
    const search = filters.search.trim().toLowerCase();
    return containers.filter((container) => {
      if (search && !`${container.name} ${container.city} ${container.zip || ""}`.toLowerCase().includes(search)) {
        return false;
      }
      if (filters.city !== "all" && container.city !== filters.city) {
        return false;
      }
      if (filters.status !== "all" && container.status !== filters.status) {
        return false;
      }
      if (filters.priorityOnly && !prioritySet.has(container.name.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [containers, filters]);

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
              Canonical parent-container intake and tenant mapping for Sola locations.
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

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Container Filters</h2>
              <p className="text-sm text-neutral-600">Search the seed set and quickly focus the first manual-loading wave.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-medium">
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-700">{filteredContainers.length} shown</span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">Priority First Wave</span>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-neutral-700">Search</span>
              <input
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                className="rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
                placeholder="Parker, Belmar, 80134..."
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-neutral-700">City</span>
              <select
                value={filters.city}
                onChange={(event) => setFilters((current) => ({ ...current, city: event.target.value }))}
                className="rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
              >
                {cityOptions.map((city) => (
                  <option key={city} value={city}>
                    {city === "all" ? "All cities" : city}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-neutral-700">Status</span>
              <select
                value={filters.status}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, status: event.target.value as ContainerFilters["status"] }))
                }
                className="rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-end">
              <span className="flex w-full items-center gap-2 rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={filters.priorityOnly}
                  onChange={(event) => setFilters((current) => ({ ...current, priorityOnly: event.target.checked }))}
                />
                Priority first wave only
              </span>
            </label>
          </div>
        </section>

        <SolaContainerTable
          containers={filteredContainers}
          selectedContainerId={selectedContainer?.id}
          busyKey={busyKey}
          priorityNames={[...PRIORITY_FIRST_WAVE]}
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
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-neutral-900">{selectedContainer.name}</h2>
                    {PRIORITY_FIRST_WAVE.includes(selectedContainer.name as (typeof PRIORITY_FIRST_WAVE)[number]) ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                        Priority First Wave
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-neutral-600">
                    {selectedContainer.city}, {selectedContainer.state}
                    {selectedContainer.zip ? ` ${selectedContainer.zip}` : ""}
                    {selectedContainer.phone ? ` • ${selectedContainer.phone}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedContainer.locationPageUrl ? (
                    <a
                      href={selectedContainer.locationPageUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="rounded-full border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                    >
                      Location Page
                    </a>
                  ) : null}
                  {selectedContainer.directoryPageUrl ? (
                    <a
                      href={selectedContainer.directoryPageUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="rounded-full border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                    >
                      Directory
                    </a>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-700">
                  Status: {selectedContainer.status}
                </span>
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-700">
                  Tenant count: {tenants.length}
                </span>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-neutral-600 md:grid-cols-2">
                <div>
                  <div className="font-medium text-neutral-800">Location Page URL</div>
                  <div className="break-all">{selectedContainer.locationPageUrl || "Not set yet"}</div>
                </div>
                <div>
                  <div className="font-medium text-neutral-800">Directory Page URL</div>
                  <div className="break-all">{selectedContainer.directoryPageUrl || "Not set yet"}</div>
                </div>
              </div>
            </section>

            <SolaContainerUrlForm
              key={`${selectedContainer.id}|${selectedContainer.locationPageUrl || ""}|${selectedContainer.directoryPageUrl || ""}`}
              container={selectedContainer}
              busy={busyKey === `urls:${selectedContainer.id}`}
              onSave={async (values) => {
                setBusyKey(`urls:${selectedContainer.id}`);
                try {
                  const response = await fetch(`/api/sola-containers/${encodeURIComponent(selectedContainer.id)}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(values),
                  });
                  const json = (await response.json()) as ContainersResponse;
                  if (!response.ok || !json.ok || !json.container) {
                    throw new Error(json.error || "Failed to save container URLs");
                  }
                  setSelectedContainer(json.container);
                  await loadContainers(selectedContainer.id);
                  setPageError(null);
                } finally {
                  setBusyKey(null);
                }
              }}
            />

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
