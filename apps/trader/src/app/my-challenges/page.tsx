import { redirect } from "next/navigation";

// SF-04: /my-challenges was a near-identical duplicate of /my-accounts
// (same fixture cards, same deep-link target /account-detail?id=).
// Redirect to the canonical account list so the user has one home for
// "my accounts" — phase badges now carry the challenge framing.
export default function MyChallengesRedirect() {
  redirect("/my-accounts");
}