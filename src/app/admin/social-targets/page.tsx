import SocialTargetsTable from "@/components/admin/social-targets/SocialTargetsTable";
import { loadReferralEdges } from "@/lib/social-targets/loadReferralEdges";
import { loadSocialTargets } from "@/lib/social-targets/loadSocialTargets";
import { isSocialTargetsDevBypass } from "@/lib/social-targets/social-targets-api-access";
import { computeReferralCounts, withComputedPriorityScore } from "@/lib/social-targets/target-utils";

export default async function AdminSocialTargetsPage() {
  const [mergedTargets, referralEdges] = await Promise.all([loadSocialTargets(), loadReferralEdges()]);
  const withReferrals = computeReferralCounts(mergedTargets, referralEdges);
  const initialTargets = withComputedPriorityScore(withReferrals);
  const showDevReset = isSocialTargetsDevBypass();

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="min-h-0 flex-1">
        <SocialTargetsTable
          initialTargets={initialTargets}
          initialReferralEdges={referralEdges}
          showDevReset={showDevReset}
        />
      </div>
    </main>
  );
}
