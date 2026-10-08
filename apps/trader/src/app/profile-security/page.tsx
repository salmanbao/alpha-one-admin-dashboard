import { Suspense } from "react";
import { ProfileSecurityPage } from "../../modules/account/pages/profile-security-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ProfileSecurityPage />
    </Suspense>
  );
}
