import { redirect } from "next/navigation";

// SF-01: retired — documents and review are steps of the unified
// /verification wizard, which no longer strands the trader on submit:
// submitting moves the flow to the status step.
export default function AccountVerification2Redirect() {
  redirect("/verification");
}
