import { getMergedSocialTargets } from "@/lib/social-targets/social-targets-store";
import type { SocialTarget } from "@/types/social-target";

export async function loadSocialTargets(): Promise<SocialTarget[]> {
  return getMergedSocialTargets();
}
