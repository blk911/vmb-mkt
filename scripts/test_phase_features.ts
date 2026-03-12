import assert from "node:assert/strict";
import { validateAccessRequest } from "../src/lib/access/requestAccess.ts";
import {
  buildHighLevelHandoffPreview,
  normalizeTargetWorkflow,
  summarizeWorkflowLists,
} from "../src/lib/ops/targetWorkflow.ts";

function run() {
  const validRequest = validateAccessRequest({
    name: "Jordan Smith",
    email: "Jordan@example.com",
    organization: "VMB Partner Ops",
    requestedRole: "external",
    notes: "Needs review access for launch support.",
  });
  assert.equal(validRequest.ok, true);
  if (!validRequest.ok) throw new Error("Expected valid access request");
  assert.equal(validRequest.value.email, "jordan@example.com");
  assert.equal(validRequest.value.requestedRole, "external");

  const invalidRequest = validateAccessRequest({
    name: "Jordan",
    email: "not-an-email",
    organization: "VMB",
  });
  assert.equal(invalidRequest.ok, false);

  const defaultWorkflow = normalizeTargetWorkflow();
  assert.equal(defaultWorkflow.stage, "new");
  assert.equal(defaultWorkflow.disposition, "open");
  assert.equal(defaultWorkflow.pinned, false);

  const lists = [
    {
      id: "tgt_1",
      name: "Denver priority",
      updatedAt: "2026-02-01T10:00:00.000Z",
      techIds: ["a", "b", "c"],
      workflow: {
        owner: "alex",
        stage: "qualified" as const,
        disposition: "priority" as const,
        pinned: true,
        nextActionAt: "2026-02-02T09:00:00.000Z",
      },
    },
    {
      id: "tgt_2",
      name: "Lakewood nurture",
      updatedAt: "2026-01-01T10:00:00.000Z",
      techIds: ["d"],
      workflow: {
        owner: "",
        stage: "working" as const,
        disposition: "nurture" as const,
        pinned: false,
      },
    },
    {
      id: "tgt_3",
      name: "Aurora handoff",
      updatedAt: "2026-02-03T10:00:00.000Z",
      techIds: ["e", "f"],
      workflow: {
        owner: "sam",
        stage: "handoff" as const,
        disposition: "open" as const,
        pinned: false,
        nextActionAt: "2026-02-06T10:00:00.000Z",
      },
    },
  ];

  const summary = summarizeWorkflowLists(lists, new Date("2026-02-05T12:00:00.000Z"));
  assert.equal(summary.listCount, 3);
  assert.equal(summary.totalTargets, 6);
  assert.equal(summary.pinnedCount, 1);
  assert.equal(summary.overdueCount, 1);
  assert.equal(summary.unassignedCount, 1);
  assert.equal(summary.staleCount, 1);
  assert.equal(summary.stageCounts.qualified, 1);
  assert.equal(summary.ownerCounts.alex, 1);

  const handoff = buildHighLevelHandoffPreview(lists);
  assert.equal(handoff.listCount, 2);
  assert.equal(handoff.totalTargets, 5);
  assert.deepEqual(
    handoff.lists.map((list) => list.id),
    ["tgt_3", "tgt_1"]
  );

  console.log("Phase 1 access request validation ✅");
  console.log("Phase 2 workflow summary ✅");
  console.log("Phase 3 HighLevel preview ✅");
}

run();
