"use client";

/**
 * Reset Password Landing — AUDIT-R3 §6 item 8 (R3-08).
 *
 * Journey bookend #2: users who clicked a password-reset link from
 * their email land here. The page accepts `?token=` in the query string
 * (contract with the email sender), validates the new password, and
 * emits `account.password-reset` into the lifecycle bus.
 *
 * Demo flow: token is ignored (no backend), but the page renders the
 * form and on success emits the event then navigates to /login?reset=ok.
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TerraCard, TerraPageHeader } from "@/components/terra/terra-ui";
import { FormField, useFormValidation } from "@pfaas/ui/platform-form-field";
import { emitLifecycle } from "@pfaas/lifecycle";

const passwordValidator = (v: string) =>
  !v || v.length < 6 ? "Password must be at least 6 characters." : "";

export function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { field, validateAll } = useFormValidation({
    password: passwordValidator,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateAll({ password })) return;

    setLoading(true);

    // Emit account.password-reset into the lifecycle bus so the inbox/
    // audit surfaces can reflect the change.
    emitLifecycle({
      entity: { kind: "account", id: `reset-${token ?? "unknown"}` },
      name: "account.password-reset",
      actor: "trader",
      key: `reset-${token ?? Date.now().toString(36)}`,
      payload: {
        token: token ?? null,
        resetAt: new Date().toISOString(),
      },
    });

    await new Promise((r) => setTimeout(r, 500));
    setLoading(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <TerraPageHeader
            title="Password Updated"
            description="Your new password has been set"
          />
          <TerraCard className="flex flex-col items-center gap-4 py-8">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success text-3xl text-on-success">
              ✓
            </span>
            <p className="text-sm text-on-surface-variant">
              Your password has been successfully reset.
            </p>
            <Link
              href="/login?reset=ok"
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
            >
              Sign In
            </Link>
          </TerraCard>
        </div>
      </div>
    );
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
            {token ? "Enter your new password" : "Reset password link missing"}
          </p>
        </div>

        <TerraCard className="p-7">
          {!token ? (
            <div className="space-y-4">
              <TerraPageHeader
                title="Invalid or expired link"
                description="The password reset link is missing or has expired."
              />
              <p className="text-sm text-on-surface-variant">
                Please request a new password reset from the
                <Link href="/forgot-password" className="font-bold text-primary hover:underline">
                  Forgot Password
                </Link>
                page.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate>
              <FormField
                id="password"
                label="New password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                {...field("password", password, setPassword)}
                placeholder="At least 6 characters"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-on-primary shadow-sm transition-all hover:bg-primary/90 disabled:opacity-60"
              >
                {loading ? "Resetting…" : "Reset password"}
              </button>
            </form>
          )}
        </TerraCard>

        <p className="text-center text-xs text-on-surface-variant">
          <Link href="/login" className="font-bold text-primary hover:underline">
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}