import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { ProfileSecurityPage } from "../../modules/account/pages/profile-security-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProfileSecurityPage />
    </Suspense>
  );
}
