import { redirect } from "next/navigation";

// SF-01: retired — identity details are now one step of the unified
// /verification wizard (the draft is restored from sessionStorage, so
// nothing typed here is ever lost to a redirect).
export default function AccountVerification1Redirect() {
  redirect("/verification");
}
