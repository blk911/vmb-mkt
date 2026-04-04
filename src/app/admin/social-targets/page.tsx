import SocialTargetsTable from "@/components/admin/social-targets/SocialTargetsTable";
import { loadReferralEdges } from "@/lib/social-targets/loadReferralEdges";
import { loadSocialTargets } from "@/lib/social-targets/loadSocialTargets";
import { isSocialTargetsDevBypass } from "@/lib/social-targets/social-targets-api-access";

export default async function AdminSocialTargetsPage() {
  const [targets, referralEdges] = await Promise.all([loadSocialTargets(), loadReferralEdges()]);
  const showDevReset = isSocialTargetsDevBypass();

  return (
    <div className="min-h-0 flex-1">
      <SocialTargetsTable
        initialTargets={targets}
        initialReferralEdges={referralEdges}
        showDevReset={showDevReset}
      />
    </div>
  );
}
