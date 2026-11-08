import { redirect } from "next/navigation";

// SF-01: the status screen is step 4 of the unified /verification
// wizard — one status surface instead of a route plus a wizard step.
// Keeps the demo ?state=preview parameter working (the old links
// pointed here).
export default async function KycVerificationStatusRedirect({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const state = (await searchParams).state;
  const query =
    typeof state === "string" && state ? `&state=${encodeURIComponent(state)}` : "";
  redirect(`/verification?step=status${query}`);
}
