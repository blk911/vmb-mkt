import data from "@/data/socialTargets/social_targets_v1.json";
import type { SocialTarget } from "@/types/social-target";

export function loadSocialTargets(): SocialTarget[] {
  return data as SocialTarget[];
}
