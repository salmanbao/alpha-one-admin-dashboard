import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { ReferralRewardsPage } from "../../modules/community/pages/referral-rewards-page";
export default function Page(){ return <Suspense fallback={<PageSkeleton />}><ReferralRewardsPage /></Suspense>; }
