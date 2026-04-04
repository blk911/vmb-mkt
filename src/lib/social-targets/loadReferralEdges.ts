import data from "@/data/socialTargets/referral_edges_v1.json";
import type { ReferralEdge } from "@/types/social-target";

export function loadReferralEdges(): ReferralEdge[] {
  return data as ReferralEdge[];
}
