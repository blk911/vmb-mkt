import fs from "node:fs/promises";
import path from "node:path";
import { writeJsonAtomic } from "@/app/api/admin/_lib/atomic";
import type { ImportDecisionStatus } from "@/lib/import-diff/types";
import { buildInitialReview } from "@/lib/external-site-review/build-initial-review";
import type { ImportedProfileReviewPayload } from "@/lib/external-site-review/types";
import { getRuntimeDataRoot } from "@/lib/runtime/runtime-data-root";
import { readJsonArrayFile } from "@/lib/social-targets/json-file";
import type { ImportedProfileDraft, ImportedProfileDraftStatus } from "./types";

const DRAFTS_PATH = path.join(getRuntimeDataRoot(), "imported-profile-drafts.generated.json");

async function ensureDraftStore(): Promise<void> {
  await fs.mkdir(path.dirname(DRAFTS_PATH), { recursive: true });
  try {
    await fs.access(DRAFTS_PATH);
  } catch {
    await writeJsonAtomic(DRAFTS_PATH, []);
  }
}

function hydrateImportedProfileDraft(draft: ImportedProfileDraft): ImportedProfileDraft {
  return {
    ...draft,
    decisionStatus: draft.decisionStatus || "unresolved",
    review:
      draft.review ||
      buildInitialReview({
        businessName: draft.businessName,
        subtitle: draft.subtitle,
        bookingUrl: draft.bookingUrl,
        instagramUrl: draft.instagramUrl,
        heroImageUrl: draft.heroImageUrl,
        services: draft.services,
        providers: draft.providers,
        portfolioImages: draft.portfolioImages,
        referralBlock: draft.referralBlock,
        giftBlock: draft.giftBlock,
        networkBlock: draft.networkBlock,
      }),
  };
}

export async function readImportedProfileDrafts(): Promise<ImportedProfileDraft[]> {
  await ensureDraftStore();
  const rows = await readJsonArrayFile<ImportedProfileDraft>(DRAFTS_PATH, []);
  return rows.map(hydrateImportedProfileDraft).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getImportedProfileDraftById(draftId: string): Promise<ImportedProfileDraft | null> {
  const rows = await readImportedProfileDrafts();
  return rows.find((row) => row.id === draftId) ?? null;
}

export async function appendImportedProfileDraft(draft: ImportedProfileDraft): Promise<ImportedProfileDraft> {
  const rows = await readImportedProfileDrafts();
  const next = [hydrateImportedProfileDraft(draft), ...rows.filter((row) => row.id !== draft.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  await writeJsonAtomic(DRAFTS_PATH, next);
  return hydrateImportedProfileDraft(draft);
}

export async function updateImportedProfileDraftStatus(
  draftId: string,
  status: ImportedProfileDraftStatus
): Promise<ImportedProfileDraft> {
  const rows = await readImportedProfileDrafts();
  const index = rows.findIndex((row) => row.id === draftId);
  if (index === -1) throw new Error("draft_not_found");
  const updated: ImportedProfileDraft = {
    ...rows[index],
    status,
    updatedAt: new Date().toISOString(),
  };
  rows[index] = updated;
  await writeJsonAtomic(DRAFTS_PATH, rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  return updated;
}

export async function updateImportedDraftReview(
  draftId: string,
  reviewPayload: ImportedProfileReviewPayload
): Promise<ImportedProfileDraft> {
  const rows = await readImportedProfileDrafts();
  const index = rows.findIndex((row) => row.id === draftId);
  if (index === -1) throw new Error("draft_not_found");
  const updated: ImportedProfileDraft = {
    ...rows[index],
    updatedAt: new Date().toISOString(),
    review: {
      payload: {
        businessName: reviewPayload.businessName,
        subtitle: reviewPayload.subtitle,
        bookingUrl: reviewPayload.bookingUrl,
        instagramUrl: reviewPayload.instagramUrl,
        heroImageUrl: reviewPayload.heroImageUrl,
        services: reviewPayload.services.map((service) => ({ ...service })),
        providers: reviewPayload.providers.map((provider) => ({ ...provider })),
        portfolioImages: [...reviewPayload.portfolioImages],
        referralBlock: { ...reviewPayload.referralBlock },
        giftBlock: { ...reviewPayload.giftBlock },
        networkBlock: { ...reviewPayload.networkBlock },
      },
      hasEdits: true,
      lastEditedAt: new Date().toISOString(),
    },
  };
  rows[index] = updated;
  await writeJsonAtomic(DRAFTS_PATH, rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  return updated;
}

export async function updateImportedDraftDecisionStatus(
  draftId: string,
  decisionStatus: ImportDecisionStatus
): Promise<ImportedProfileDraft> {
  const rows = await readImportedProfileDrafts();
  const index = rows.findIndex((row) => row.id === draftId);
  if (index === -1) throw new Error("draft_not_found");
  const updated: ImportedProfileDraft = {
    ...rows[index],
    decisionStatus,
    decisionUpdatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  rows[index] = updated;
  await writeJsonAtomic(DRAFTS_PATH, rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  return updated;
}
