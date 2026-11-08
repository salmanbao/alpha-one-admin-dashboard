import { redirect } from "next/navigation";

// SF-01: retired — /kyc-onboarding was the second competing KYC path.
// The unified /verification wizard starts at the first incomplete step,
// so this redirect is a no-op for a fresh trader.
export default function KycOnboardingRedirect() {
  redirect("/verification");
}
