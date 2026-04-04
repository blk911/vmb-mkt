import { getMergedReferralEdges } from "@/lib/social-targets/referral-edges-store";
import type { ReferralEdge } from "@/types/social-target";

export async function loadReferralEdges(): Promise<ReferralEdge[]> {
  return getMergedReferralEdges();
}
