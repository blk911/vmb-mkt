export const WORKFLOW_STAGES = ["new", "working", "qualified", "handoff", "parked"] as const;
export const WORKFLOW_DISPOSITIONS = ["open", "priority", "nurture", "closed"] as const;

export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];
export type WorkflowDisposition = (typeof WORKFLOW_DISPOSITIONS)[number];

export type TargetWorkflow = {
  owner: string;
  stage: WorkflowStage;
  disposition: WorkflowDisposition;
  nextActionAt?: string;
  nextAction?: string;
  pinned: boolean;
};

export type TargetActivity = {
  at: string;
  type: string;
  detail: string;
};

export type WorkflowListLike = {
  id: string;
  name: string;
  updatedAt: string;
  techIds?: string[];
  membershipMode?: "fixed" | "dynamic";
  resolvedTargetCount?: number;
  unresolvedTargetCount?: number;
  workflow?: Partial<TargetWorkflow> | null;
  activity?: TargetActivity[] | null;
};

export function normalizeTargetWorkflow(workflow?: Partial<TargetWorkflow> | null): TargetWorkflow {
  const owner = String(workflow?.owner ?? "").trim();
  const stage = WORKFLOW_STAGES.includes((workflow?.stage ?? "") as WorkflowStage)
    ? (workflow?.stage as WorkflowStage)
    : "new";
  const disposition = WORKFLOW_DISPOSITIONS.includes((workflow?.disposition ?? "") as WorkflowDisposition)
    ? (workflow?.disposition as WorkflowDisposition)
    : "open";
  const nextActionAt = String(workflow?.nextActionAt ?? "").trim();

  return {
    owner,
    stage,
    disposition,
    nextActionAt: nextActionAt || undefined,
    nextAction: String(workflow?.nextAction ?? "").trim().slice(0, 2000) || undefined,
    pinned: workflow?.pinned === true,
  };
}

export function appendTargetActivity(
  existing: TargetActivity[] | null | undefined,
  entry: Omit<TargetActivity, "at"> & { at?: string }
) {
  return [
    {
      at: entry.at || new Date().toISOString(),
      type: entry.type,
      detail: entry.detail,
    },
    ...(Array.isArray(existing) ? existing : []),
  ].slice(0, 25);
}

function toTime(value?: string) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function summarizeWorkflowLists(lists: WorkflowListLike[], now = new Date()) {
  const stageCounts = Object.fromEntries(WORKFLOW_STAGES.map((stage) => [stage, 0])) as Record<WorkflowStage, number>;
  const dispositionCounts = Object.fromEntries(
    WORKFLOW_DISPOSITIONS.map((disposition) => [disposition, 0])
  ) as Record<WorkflowDisposition, number>;

  let pinnedCount = 0;
  let overdueCount = 0;
  let unassignedCount = 0;
  let staleCount = 0;
  let totalTargets = 0;
  let fixedTargetCount = 0;
  let dynamicMatchCount = 0;
  let unresolvedTargetCount = 0;
  const ownerCounts: Record<string, number> = {};

  const nowTime = now.getTime();
  const staleMs = 14 * 24 * 60 * 60 * 1000;

  for (const list of lists) {
    const workflow = normalizeTargetWorkflow(list.workflow);
    stageCounts[workflow.stage] += 1;
    dispositionCounts[workflow.disposition] += 1;
    const targetCount = Array.isArray(list.techIds) ? list.techIds.length : 0;
    totalTargets += targetCount;
    if (list.membershipMode === "dynamic") dynamicMatchCount += targetCount;
    else fixedTargetCount += targetCount;
    unresolvedTargetCount += list.unresolvedTargetCount || 0;
    if (workflow.pinned) pinnedCount += 1;
    if (!workflow.owner) {
      unassignedCount += 1;
    } else {
      ownerCounts[workflow.owner] = (ownerCounts[workflow.owner] || 0) + 1;
    }

    const nextActionAt = toTime(workflow.nextActionAt);
    if (nextActionAt !== null && nextActionAt <= nowTime) overdueCount += 1;

    const updatedAt = toTime(list.updatedAt);
    if (updatedAt !== null && nowTime - updatedAt >= staleMs) staleCount += 1;
  }

  return {
    listCount: lists.length,
    totalTargets,
    fixedTargetCount,
    dynamicMatchCount,
    unresolvedTargetCount,
    pinnedCount,
    overdueCount,
    unassignedCount,
    staleCount,
    stageCounts,
    dispositionCounts,
    ownerCounts,
  };
}

export function buildHighLevelHandoffPreview(lists: WorkflowListLike[]) {
  const eligible = lists
    .map((list) => ({ ...list, workflow: normalizeTargetWorkflow(list.workflow) }))
    .filter((list) => list.workflow.stage === "qualified" || list.workflow.stage === "handoff")
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    deliveryEnabled: false,
    listCount: eligible.length,
    totalTargets: eligible.reduce((sum, list) => sum + (Array.isArray(list.techIds) ? list.techIds.length : 0), 0),
    lists: eligible.map((list) => ({
      id: list.id,
      name: list.name,
      owner: list.workflow.owner || "",
      stage: list.workflow.stage,
      disposition: list.workflow.disposition,
      nextActionAt: list.workflow.nextActionAt || "",
      nextAction: list.workflow.nextAction || "",
      targetCount: Array.isArray(list.techIds) ? list.techIds.length : 0,
      membershipMode: list.membershipMode || "fixed",
      membershipNote: list.membershipMode === "dynamic" ? "Live filter matches for preview only." : "Saved fixed catalog membership.",
      resolvedTargetCount: list.resolvedTargetCount,
      unresolvedTargetCount: list.unresolvedTargetCount || 0,
      updatedAt: list.updatedAt,
    })),
  };
}
