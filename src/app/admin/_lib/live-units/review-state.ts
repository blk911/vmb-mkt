import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

export type ReviewStatus = "approved" | "rejected" | "watch" | "needs_research";

export type ReviewDecision = {
  live_unit_id: string;
  review_status: ReviewStatus;
  updated_at: string;
  updated_by?: string;
};

export type ReviewStateFile = {
  updated_at: string | null;
  decisions: Record<string, ReviewDecision>;
};

const REVIEW_STATE_PATH = path.join(process.cwd(), "data", "markets", "beauty_live_units_review_state.v1.json");

function emptyState(): ReviewStateFile {
  return {
    updated_at: null,
    decisions: {},
  };
}

export function getReviewStatePath() {
  return REVIEW_STATE_PATH;
}

export function readReviewState(): ReviewStateFile {
  if (!fs.existsSync(REVIEW_STATE_PATH)) return emptyState();
  const parsed = JSON.parse(fs.readFileSync(REVIEW_STATE_PATH, "utf8")) as Partial<ReviewStateFile>;
  return {
    updated_at: typeof parsed.updated_at === "string" ? parsed.updated_at : null,
    decisions: parsed.decisions && typeof parsed.decisions === "object" ? parsed.decisions : {},
  };
}

async function writeReviewState(state: ReviewStateFile) {
  await fsp.mkdir(path.dirname(REVIEW_STATE_PATH), { recursive: true });
  const tmp = `${REVIEW_STATE_PATH}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
  await fsp.rename(tmp, REVIEW_STATE_PATH);
}

export async function upsertReviewDecision(input: {
  live_unit_id: string;
  review_status: ReviewStatus;
  updated_by?: string;
}) {
  const state = readReviewState();
  const decision: ReviewDecision = {
    live_unit_id: input.live_unit_id,
    review_status: input.review_status,
    updated_at: new Date().toISOString(),
    updated_by: input.updated_by,
  };
  state.decisions[input.live_unit_id] = decision;
  state.updated_at = decision.updated_at;
  await writeReviewState(state);
  return {
    state,
    decision,
  };
}

export async function applyReviewDecisions(input: {
  live_unit_ids: string[];
  review_status?: ReviewStatus;
  clear?: boolean;
  updated_by?: string;
}) {
  const uniqueIds = Array.from(new Set(input.live_unit_ids.map((value) => value.trim()).filter(Boolean)));
  const state = readReviewState();
  const updatedAt = new Date().toISOString();
  const changed: Array<ReviewDecision | { live_unit_id: string; cleared: true }> = [];

  for (const liveUnitId of uniqueIds) {
    if (input.clear) {
      if (state.decisions[liveUnitId]) {
        delete state.decisions[liveUnitId];
        changed.push({ live_unit_id: liveUnitId, cleared: true });
      }
      continue;
    }

    if (!input.review_status) continue;
    const decision: ReviewDecision = {
      live_unit_id: liveUnitId,
      review_status: input.review_status,
      updated_at: updatedAt,
      updated_by: input.updated_by,
    };
    state.decisions[liveUnitId] = decision;
    changed.push(decision);
  }

  state.updated_at = updatedAt;
  await writeReviewState(state);

  return {
    state,
    changed,
  };
}
