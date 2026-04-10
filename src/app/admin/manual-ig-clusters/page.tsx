"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminTopNav } from "@/components/admin/AdminTopNav";
import { ManualIgClusterCreateForm } from "@/components/admin/manual-ig-clusters/ManualIgClusterCreateForm";
import { ManualIgClusterDetailTable } from "@/components/admin/manual-ig-clusters/ManualIgClusterDetailTable";
import { ManualIgClustersTable } from "@/components/admin/manual-ig-clusters/ManualIgClustersTable";
import type { ManualIgAcceptedRecord, ManualIgCluster } from "@/lib/manual-ig-clusters/types";

type ClusterListResponse = {
  ok: boolean;
  error?: string;
  clusters?: ManualIgCluster[];
};

type ClusterDetailResponse = {
  ok: boolean;
  error?: string;
  cluster?: ManualIgCluster;
};

type AcceptResponse = {
  ok: boolean;
  error?: string;
  cluster?: ManualIgCluster;
  acceptedRecord?: ManualIgAcceptedRecord;
  inserted?: boolean;
  alreadyAccepted?: boolean;
};

type RejectResponse = {
  ok: boolean;
  error?: string;
  cluster?: ManualIgCluster;
};

export default function Page() {
  const [clusters, setClusters] = useState<ManualIgCluster[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<ManualIgCluster | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const loadClusters = useCallback(async (selectClusterId?: string) => {
    setLoading(true);
    try {
      const response = await fetch("/api/manual-ig-clusters", { cache: "no-store" });
      const json = (await response.json()) as ClusterListResponse;
      if (!response.ok || !json.ok) throw new Error(json.error || "Failed to load clusters");
      const nextClusters = json.clusters ?? [];
      setClusters(nextClusters);
      setSelectedCluster((current) => {
        const targetId = selectClusterId || current?.clusterId;
        if (!targetId) return current;
        return nextClusters.find((cluster) => cluster.clusterId === targetId) || null;
      });
      setPageError(null);
    } catch (error: unknown) {
      setPageError(error instanceof Error ? error.message : "Failed to load clusters");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadClusterDetail = useCallback(async (clusterId: string) => {
    setBusyKey(`open:${clusterId}`);
    try {
      const response = await fetch(`/api/manual-ig-clusters/${encodeURIComponent(clusterId)}`, {
        cache: "no-store",
      });
      const json = (await response.json()) as ClusterDetailResponse;
      if (!response.ok || !json.ok || !json.cluster) {
        throw new Error(json.error || "Failed to load cluster");
      }
      setSelectedCluster(json.cluster);
      setPageError(null);
    } catch (error: unknown) {
      setPageError(error instanceof Error ? error.message : "Failed to load cluster");
    } finally {
      setBusyKey(null);
    }
  }, []);

  useEffect(() => {
    void loadClusters();
  }, [loadClusters]);

  const handleAccept = useCallback(async (itemId: string) => {
    if (!selectedCluster) return;
    setBusyKey(`accept:${itemId}`);
    try {
      const response = await fetch(`/api/manual-ig-clusters/${encodeURIComponent(selectedCluster.clusterId)}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const json = (await response.json()) as AcceptResponse;
      if (!response.ok || !json.ok || !json.cluster) {
        throw new Error(json.error || "Failed to accept item");
      }
      setSelectedCluster(json.cluster);
      await loadClusters(json.cluster.clusterId);
      setPageError(null);
    } catch (error: unknown) {
      setPageError(error instanceof Error ? error.message : "Failed to accept item");
    } finally {
      setBusyKey(null);
    }
  }, [loadClusters, selectedCluster]);

  const handleReject = useCallback(async (itemId: string) => {
    if (!selectedCluster) return;
    setBusyKey(`reject:${itemId}`);
    try {
      const response = await fetch(`/api/manual-ig-clusters/${encodeURIComponent(selectedCluster.clusterId)}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const json = (await response.json()) as RejectResponse;
      if (!response.ok || !json.ok || !json.cluster) {
        throw new Error(json.error || "Failed to reject item");
      }
      setSelectedCluster(json.cluster);
      await loadClusters(json.cluster.clusterId);
      setPageError(null);
    } catch (error: unknown) {
      setPageError(error instanceof Error ? error.message : "Failed to reject item");
    } finally {
      setBusyKey(null);
    }
  }, [loadClusters, selectedCluster]);

  return (
    <main className="min-h-screen bg-neutral-50">
      <AdminTopNav />
      <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-950">Manual IG Clusters</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Manual IG clusters are high-signal copied follow networks from target accounts. They stay isolated until accepted.
          </p>
        </div>

        {pageError ? <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{pageError}</div> : null}

        <ManualIgClusterCreateForm
          onSuccess={(cluster) => {
            setSelectedCluster(cluster);
            void loadClusters(cluster.clusterId);
          }}
        />

        <ManualIgClustersTable
          clusters={clusters}
          selectedClusterId={selectedCluster?.clusterId}
          busyKey={busyKey}
          onOpen={(clusterId) => void loadClusterDetail(clusterId)}
        />

        {loading ? (
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-500 shadow-sm">
            Loading clusters...
          </section>
        ) : null}

        {selectedCluster ? (
          <ManualIgClusterDetailTable
            cluster={selectedCluster}
            busyKey={busyKey}
            onAccept={(itemId) => void handleAccept(itemId)}
            onReject={(itemId) => void handleReject(itemId)}
          />
        ) : null}
      </div>
    </main>
  );
}
