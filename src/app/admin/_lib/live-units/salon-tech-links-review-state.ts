import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

export type SalonTechReviewStatus = "confirmed" | "rejected" | "watch";

export type SalonTechLinkReviewDecision = {
  entity_id: string;
  tech_id: string;
  review_status: SalonTechReviewStatus;
  note?: string;
  updated_at: string;
  updated_by?: string;
};

export type SalonTechLinksReviewStateFile = {
  updated_at: string | null;
  links: Record<string, SalonTechLinkReviewDecision>;
};

const REVIEW_STATE_PATH = path.join(
  process.cwd(),
  "data",
  "markets",
  "beauty_salon_tech_links_review_state.v1.json"
);

function emptyState(): SalonTechLinksReviewStateFile {
  return {
    updated_at: null,
    links: {},
  };
}

export function salonTechLinkKey(entityId: string, techId: string) {
  return `${entityId}::${techId}`;
}

export function readSalonTechLinksReviewState(): SalonTechLinksReviewStateFile {
  if (!fs.existsSync(REVIEW_STATE_PATH)) return emptyState();
  const parsed = JSON.parse(fs.readFileSync(REVIEW_STATE_PATH, "utf8")) as Partial<SalonTechLinksReviewStateFile>;
  return {
    updated_at: typeof parsed.updated_at === "string" ? parsed.updated_at : null,
    links: parsed.links && typeof parsed.links === "object" ? parsed.links : {},
  };
}

async function writeState(state: SalonTechLinksReviewStateFile) {
  await fsp.mkdir(path.dirname(REVIEW_STATE_PATH), { recursive: true });
  const tmp = `${REVIEW_STATE_PATH}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
  await fsp.rename(tmp, REVIEW_STATE_PATH);
}

export async function upsertSalonTechLinkReview(input: {
  entity_id: string;
  tech_id: string;
  review_status: SalonTechReviewStatus;
  note?: string;
  updated_by?: string;
}) {
  const state = readSalonTechLinksReviewState();
  const updatedAt = new Date().toISOString();
  const key = salonTechLinkKey(input.entity_id, input.tech_id);
  const decision: SalonTechLinkReviewDecision = {
    entity_id: input.entity_id,
    tech_id: input.tech_id,
    review_status: input.review_status,
    note: input.note,
    updated_at: updatedAt,
    updated_by: input.updated_by,
  };
  state.links[key] = decision;
  state.updated_at = updatedAt;
  await writeState(state);
  return {
    state,
    decision,
  };
}

export async function clearSalonTechLinkReview(input: {
  entity_id: string;
  tech_id: string;
}) {
  const state = readSalonTechLinksReviewState();
  const key = salonTechLinkKey(input.entity_id, input.tech_id);
  if (state.links[key]) {
    delete state.links[key];
    state.updated_at = new Date().toISOString();
    await writeState(state);
  }
  return {
    state,
    cleared_key: key,
  };
}
