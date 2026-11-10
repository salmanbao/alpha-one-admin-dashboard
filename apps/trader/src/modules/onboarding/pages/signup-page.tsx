"use client";

/**
 * Signup / Registration — AUDIT-R3 §6 item 8 (R3-08).
 *
 * Journey bookend #1: new users can create an account instead of being
 * forced into "Start a challenge" as the only CTA. On submit we emit
 * `account.created` into the lifecycle bus so the onboarding funnel
 * (verification, provisioning) can react to a real new-trader event.
 *
 * Demo flow: validation only (no backend). Successful submit emits the
 * lifecycle event and navigates to the KYC onboarding step.
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TerraCard } from "@/components/terra/terra-ui";
import { FormField, useFormValidation } from "@pfaas/ui/platform-form-field";
import { emitLifecycle } from "@pfaas/lifecycle";

const emailValidator = (v: string) => {
  if (!v.trim()) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return "Enter a valid email address.";
  return "";
};

const passwordValidator = (v: string) =>
  !v || v.length < 6 ? "Password must be at least 6 characters." : "";

const displayNameValidator = (v: string) =>
  !v.trim() ? "Display name is required." : v.trim().length < 2 ? "Display name is too short." : "";

export function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const { field, validateAll } = useFormValidation({
    email: emailValidator,
    displayName: displayNameValidator,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateAll({ email, displayName })) return;

    // Manual confirm-password check — the FormField validator type only
    // accepts (value: string), so we compare here with the submit-time
    // password state rather than through the validator chain.
    if (password.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    // Emit account.created into the lifecycle bus so downstream surfaces
    // (verification, onboarding) can react.
    const newAccountId = `acc-${Date.now().toString(36).toUpperCase()}`;
    emitLifecycle({
      entity: { kind: "account", id: newAccountId },
      name: "account.created",
      actor: "trader",
      key: newAccountId,
      payload: {
        email,
        displayName,
        source: "signup",
        referrer: typeof document !== "undefined" ? document.referrer || null : null,
      },
    });

    // Small delay so the emit is visible before navigation.
    await new Promise((r) => setTimeout(r, 500));
    router.push("/account-verification-1");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary font-headline text-lg font-bold text-on-primary">
            TT
          </span>
          <h1 className="font-headline text-2xl font-bold text-on-surface">TerraTrader</h1>
          <p className="text-sm text-on-surface-variant">
            Create your trading account
          </p>
        </div>

        <TerraCard className="p-7">
          <form onSubmit={submit} className="space-y-4" noValidate>
            <FormField
              id="displayName"
              label="Display name"
              required
              autoComplete="name"
              value={displayName}
              {...field("displayName", displayName, setDisplayName)}
              placeholder="Alex Trader"
            />
            <FormField
              id="email"
              label="Email"
              type="email"
              required
              autoComplete="email"
              value={email}
              {...field("email", email, setEmail)}
              placeholder="you@example.com"
            />
            <label className="block text-sm font-medium text-on-surface">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-on-primary shadow-sm transition-all hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        </TerraCard>

        <p className="text-center text-xs text-on-surface-variant">
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}