import { Providers } from "@/components/platform/providers";
import { VerifyEmailPage } from "../../modules/profile/verify-email-page";

/**
 * Email verification route (audit D #5) — standalone prompt/resend/
 * recovery screen for operators whose address isn't confirmed yet.
 * Mounted outside the AppShell (like `/`), so it brings its own
 * Providers context for the signed-in operator's email.
 */
export default function Page() {
  return (
    <Providers>
      <main role="main" aria-label="Email verification">
        <VerifyEmailPage />
      </main>
    </Providers>
  );
}
