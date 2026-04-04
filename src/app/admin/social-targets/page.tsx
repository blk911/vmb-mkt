import SocialTargetsTable from "@/components/admin/social-targets/SocialTargetsTable";
import { loadReferralEdges } from "@/lib/social-targets/loadReferralEdges";
import { loadSocialTargets } from "@/lib/social-targets/loadSocialTargets";

export default function AdminSocialTargetsPage() {
  const targets = loadSocialTargets();
  const referralEdges = loadReferralEdges();

  return (
    <div className="min-h-0 flex-1">
      <SocialTargetsTable initialTargets={targets} initialReferralEdges={referralEdges} />
    </div>
  );
}
