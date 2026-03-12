import fs from "node:fs";
import path from "node:path";
import { dataRootAbs } from "../../../backend/lib/paths/data-root";
import { writeJsonAtomic } from "../../app/api/admin/_lib/atomic";
import type { AccessRequestForm, RequestedAccessRole } from "./requestAccess";

export type AccessRequestRecord = AccessRequestForm & {
  id: string;
  createdAt: string;
  status: "pending" | "approved" | "denied";
};

type AccessRequestStore = {
  ok: true;
  updatedAt: string;
  requests: AccessRequestRecord[];
};

function requestStorePathAbs() {
  return path.join(dataRootAbs(), "app", "access_requests.json");
}

export function createAccessRequestId(nowIso: string) {
  return `acc_${nowIso.slice(0, 10).replace(/-/g, "")}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function listAccessRequests(): Promise<AccessRequestStore> {
  const absPath = requestStorePathAbs();
  if (!fs.existsSync(absPath)) {
    return { ok: true, updatedAt: new Date().toISOString(), requests: [] };
  }

  const raw = fs.readFileSync(absPath, "utf8");
  const parsed = JSON.parse(raw) as AccessRequestStore;
  return {
    ok: true,
    updatedAt: parsed.updatedAt || new Date().toISOString(),
    requests: Array.isArray(parsed.requests) ? parsed.requests : [],
  };
}

export async function createAccessRequest(form: {
  name: string;
  email: string;
  organization: string;
  requestedRole: RequestedAccessRole;
  notes: string;
}) {
  const now = new Date().toISOString();
  const store = await listAccessRequests();
  const record: AccessRequestRecord = {
    ...form,
    id: createAccessRequestId(now),
    createdAt: now,
    status: "pending",
  };

  store.requests = [record, ...store.requests].slice(0, 500);
  store.updatedAt = now;
  await writeJsonAtomic(requestStorePathAbs(), store);
  return record;
}
