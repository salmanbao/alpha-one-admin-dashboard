"use client";

/**
 * Forgot Password — audit finding #7 (HIGH): broken recovery workflow.
 *
 * Self-service password reset: enter your registered email, receive
 * a reset link, then create a new password. Uses the shared
 * FormField + useFormValidation from @pfaas/ui/platform-form-field
 * for consistent blur→change→submit validation (audit #5).
 *
 * Demo flow: submitting the email shows a confirmation state with
 * the next steps (check inbox, link expires in 30 min, contact
 * support if not received).
 */

import { useState } from "react";
import Link from "next/link";
import { TerraCard, TerraPageHeader } from "@/components/terra/terra-ui";
import { FormField, useFormValidation } from "@pfaas/ui/platform-form-field";

const validators = {
  email: (v: string) => {
    if (!v.trim()) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return "Enter a valid email address.";
    return "";
  },
};

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { field, validateAll } = useFormValidation(validators);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateAll({ email })) setSent(true);
  };

  if (sent) {
    return (
      <div className="space-y-6">
        <TerraPageHeader
          title="Check Your Email"
          description="Password reset instructions sent"
        />
        <div className="mx-auto max-w-md">
          <TerraCard className="flex flex-col items-center gap-4 py-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-3xl text-on-primary">
              📧
            </span>
            <div>
              <p className="font-headline text-lg font-bold text-on-surface">
                Reset link sent to
              </p>
              <p className="text-sm font-semibold text-primary">{email}</p>
            </div>
            <div className="space-y-2 text-sm text-on-surface-variant">
              <p>Click the link in the email to reset your password.</p>
              <p className="text-xs">The link expires in 30 minutes for security.</p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Link
                href="/login"
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
              >
                Back to Sign In
              </Link>
              <Link
                href="/help-center"
                className="text-xs font-semibold text-primary hover:underline"
              >
                Didn't receive it? Contact support
              </Link>
            </div>
          </TerraCard>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Reset Your Password"
        description="Enter your registered email and we'll send you a reset link"
      />
      <div className="mx-auto max-w-md">
        <TerraCard>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              id="reset-email"
              label="Email address"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              helpText="Use the email you registered with TerraTrader."
              {...field("email", email, setEmail)}
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-on-primary shadow-sm transition-all hover:bg-primary/90"
            >
              Send Reset Link
            </button>
          </form>
          <div className="mt-4 text-center">
            <Link
              href="/login"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Back to Sign In
            </Link>
          </div>
        </TerraCard>
      </div>
    </div>
  );
}
