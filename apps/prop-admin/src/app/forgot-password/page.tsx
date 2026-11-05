import { Providers } from "@/components/platform/providers";
import { ForgotPasswordPage } from "../../modules/profile/forgot-password-page";

/**
 * Forgot-password route (finding #4) — self-service password recovery
 * for prop-firm operators, integrated with the email verification
 * workflow. Standalone like `/verify-email`: brings its own Providers
 * context and renders outside the AppShell.
 */
export default function Page() {
  return (
    <Providers>
      <main role="main" aria-label="Password reset">
        <ForgotPasswordPage />
      </main>
    </Providers>
  );
}
