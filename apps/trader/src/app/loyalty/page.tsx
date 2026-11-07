import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { LoyaltyPage } from "../../modules/promo/loyalty-page";
export default function Page(){ return <Suspense fallback={<PageSkeleton />}><LoyaltyPage /></Suspense>; }
