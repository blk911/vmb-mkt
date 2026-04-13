import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { writeJsonAtomic } from "@/app/api/admin/_lib/atomic";
import { readJsonArrayFile } from "@/lib/social-targets/json-file";
import { DENVER_SOLA_SEEDS } from "./seed-denver";
import { solaContainersStorePath, solaTenantsStorePath } from "./runtime-paths";
import type { SolaContainer, SolaContainerStatus, SolaTenantRecord } from "./types";

// Containers and tenant children stay in dedicated Sola stores so container-first
// intake and review can evolve without contaminating unrelated discovery outputs.

function normalizeText(input?: string): string {
  return (input || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeTenantKey(input?: string): string {
  return normalizeText(input).replace(/\s+/g, " ");
}

function trimToOptional(value?: string): string | undefined {
  const trimmed = (value || "").trim();
  return trimmed || undefined;
}

function compareContainers(a: SolaContainer, b: SolaContainer): number {
  const distanceDelta = (a.distanceMiles ?? Number.MAX_SAFE_INTEGER) - (b.distanceMiles ?? Number.MAX_SAFE_INTEGER);
  if (distanceDelta !== 0) return distanceDelta;
  return `${a.city} ${a.name}`.localeCompare(`${b.city} ${b.name}`);
}

function compareTenants(a: SolaTenantRecord, b: SolaTenantRecord): number {
  const nameDelta = a.tenantName.localeCompare(b.tenantName);
  if (nameDelta !== 0) return nameDelta;
  return (a.suite || "").localeCompare(b.suite || "");
}

function containerIdentityKey(input: Pick<SolaContainer, "brand" | "name" | "city" | "state">): string {
  return [input.brand, normalizeText(input.name), normalizeText(input.city), normalizeText(input.state)].join("|");
}

function tenantIdentityKey(input: Pick<SolaTenantRecord, "containerId" | "tenantName" | "suite">): string {
  return [input.containerId, normalizeTenantKey(input.tenantName), normalizeTenantKey(input.suite)].join("|");
}

function hashId(prefix: string, value: string): string {
  return `${prefix}_${crypto.createHash("md5").update(value).digest("hex").slice(0, 12)}`;
}

async function ensureArrayFile(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await writeJsonAtomic(filePath, []);
  }
}

async function readArray<T>(filePath: string): Promise<T[]> {
  await ensureArrayFile(filePath);
  const rows = await readJsonArrayFile<T>(filePath, []);
  if (!Array.isArray(rows)) {
    throw new Error(`Invalid array store: ${path.basename(filePath)}`);
  }
  return rows;
}

async function writeArray<T>(filePath: string, rows: T[]): Promise<T[]> {
  await ensureArrayFile(filePath);
  await writeJsonAtomic(filePath, rows);
  return rows;
}

export async function listSolaContainers(): Promise<SolaContainer[]> {
  const rows = await readArray<SolaContainer>(solaContainersStorePath());
  return [...rows].sort(compareContainers);
}

export async function saveSolaContainers(containers: SolaContainer[]): Promise<SolaContainer[]> {
  const byIdentity = new Map<string, SolaContainer>();
  for (const container of containers) {
    byIdentity.set(containerIdentityKey(container), container);
  }
  const next = [...byIdentity.values()].sort(compareContainers);
  return writeArray(solaContainersStorePath(), next);
}

export async function getSolaContainerById(id: string): Promise<SolaContainer | null> {
  const rows = await listSolaContainers();
  return rows.find((row) => row.id === id) ?? null;
}

export async function upsertSolaContainer(container: SolaContainer): Promise<{ container: SolaContainer; inserted: boolean }> {
  const rows = await listSolaContainers();
  const identity = containerIdentityKey(container);
  const existing = rows.find((row) => containerIdentityKey(row) === identity);
  const next = existing
    ? rows.map((row) => (row.id === existing.id ? { ...row, ...container, id: existing.id, createdAt: existing.createdAt } : row))
    : [...rows, container];
  await saveSolaContainers(next);
  return { container: existing ? { ...existing, ...container, id: existing.id, createdAt: existing.createdAt } : container, inserted: !existing };
}

export async function updateSolaContainerStatus(
  id: string,
  status: SolaContainerStatus
): Promise<SolaContainer> {
  const rows = await listSolaContainers();
  const index = rows.findIndex((row) => row.id === id);
  if (index === -1) throw new Error("container_not_found");
  const current = rows[index];
  const updated: SolaContainer = {
    ...current,
    status,
    updatedAt: new Date().toISOString(),
  };
  rows[index] = updated;
  await saveSolaContainers(rows);
  return updated;
}

export async function updateSolaContainer(
  id: string,
  patch: Partial<Pick<SolaContainer, "locationPageUrl" | "directoryPageUrl" | "status" | "notes">>
): Promise<SolaContainer> {
  const rows = await listSolaContainers();
  const index = rows.findIndex((row) => row.id === id);
  if (index === -1) throw new Error("container_not_found");

  const current = rows[index];
  const nextLocationPageUrl =
    patch.locationPageUrl !== undefined ? trimToOptional(patch.locationPageUrl) : current.locationPageUrl;
  const nextDirectoryPageUrl =
    patch.directoryPageUrl !== undefined ? trimToOptional(patch.directoryPageUrl) : current.directoryPageUrl;
  const nextNotes = patch.notes !== undefined ? trimToOptional(patch.notes) : current.notes;

  let nextStatus = patch.status ?? current.status;
  const savedParentUrl = Boolean(nextLocationPageUrl || nextDirectoryPageUrl);
  if (savedParentUrl && current.status === "seeded" && patch.status === undefined) {
    nextStatus = "resolved";
  }

  const updated: SolaContainer = {
    ...current,
    locationPageUrl: nextLocationPageUrl,
    directoryPageUrl: nextDirectoryPageUrl,
    notes: nextNotes,
    status: nextStatus,
    updatedAt: new Date().toISOString(),
  };

  rows[index] = updated;
  await saveSolaContainers(rows);
  return updated;
}

export async function seedDenverSolaContainers(): Promise<{
  containers: SolaContainer[];
  total: number;
  inserted: number;
  skipped: number;
}> {
  const existing = await listSolaContainers();
  const byIdentity = new Map(existing.map((row) => [containerIdentityKey(row), row]));
  let inserted = 0;
  let skipped = 0;

  for (const seed of DENVER_SOLA_SEEDS) {
    const now = new Date().toISOString();
    const next: SolaContainer = {
      id: hashId("solac", containerIdentityKey({ brand: "Sola Salons", ...seed })),
      brand: "Sola Salons",
      market: "Denver Metro",
      region: "Denver Front Range",
      name: seed.name,
      city: seed.city,
      state: seed.state,
      zip: seed.zip,
      phone: seed.phone,
      distanceMiles: seed.distanceMiles,
      source: "manual_seed",
      sourceLabel: "Denver Sola canonical seed",
      status: "seeded",
      createdAt: now,
      updatedAt: now,
    };
    const key = containerIdentityKey(next);
    if (byIdentity.has(key)) {
      skipped += 1;
      continue;
    }
    byIdentity.set(key, next);
    inserted += 1;
  }

  const containers = [...byIdentity.values()].sort(compareContainers);
  await saveSolaContainers(containers);
  return {
    containers,
    total: containers.length,
    inserted,
    skipped,
  };
}

export async function listSolaTenants(): Promise<SolaTenantRecord[]> {
  const rows = await readArray<SolaTenantRecord>(solaTenantsStorePath());
  return [...rows].sort(compareTenants);
}

export async function listSolaTenantsByContainerId(containerId: string): Promise<SolaTenantRecord[]> {
  const rows = await listSolaTenants();
  return rows.filter((row) => row.containerId === containerId);
}

export async function saveSolaTenants(tenants: SolaTenantRecord[]): Promise<SolaTenantRecord[]> {
  const byIdentity = new Map<string, SolaTenantRecord>();
  for (const tenant of tenants) {
    byIdentity.set(tenantIdentityKey(tenant), tenant);
  }
  const next = [...byIdentity.values()].sort(compareTenants);
  return writeArray(solaTenantsStorePath(), next);
}

export async function appendSolaTenantRecords(rows: SolaTenantRecord[]): Promise<{
  inserted: number;
  skipped: number;
  tenants: SolaTenantRecord[];
}> {
  const existing = await listSolaTenants();
  const byIdentity = new Map(existing.map((row) => [tenantIdentityKey(row), row]));
  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const key = tenantIdentityKey(row);
    if (byIdentity.has(key)) {
      skipped += 1;
      continue;
    }
    byIdentity.set(key, row);
    inserted += 1;
  }

  const tenants = [...byIdentity.values()].sort(compareTenants);
  await saveSolaTenants(tenants);
  return { inserted, skipped, tenants };
}

export function createSolaTenantId(containerId: string, tenantName: string, suite?: string): string {
  return hashId("solat", tenantIdentityKey({ containerId, tenantName, suite }));
}
