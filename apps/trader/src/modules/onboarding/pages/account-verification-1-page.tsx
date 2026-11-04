"use client";

/**
 * Account Verification (Step 1) — converted from stitch_screens/account_verification_1
 * First step of post-purchase verification: confirm identity basics.
 *
 * Audit #5: uses the shared FormField + useFormValidation from
 * @pfaas/ui/platform-form-field so validation timing (blur → change →
 * submit) and error styling match every other dashboard.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TerraBadge, TerraCard, TerraPageHeader, TerraSectionTitle } from "@/components/terra/terra-ui";
import { FormField, useFormValidation } from "@pfaas/ui/platform-form-field";

const validators = {
  fullName: (v: string) => (!v.trim() ? "Full legal name is required." : ""),
  dob: (v: string) => {
    if (!v.trim()) return "Date of birth is required.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return "Use YYYY-MM-DD format.";
    return "";
  },
  country: (v: string) => (!v.trim() ? "Country of residence is required." : ""),
  phone: (v: string) => {
    if (!v.trim()) return "Phone number is required.";
    if (v.replace(/\D/g, "").length < 7) return "Enter a valid phone number.";
    return "";
  },
};

export function AccountVerification1Page() {
  const router = useRouter();
  const [fullName, setFullName] = useState("Tom Allen");
  const [dob, setDob] = useState("1990-04-12");
  const [country, setCountry] = useState("United States");
  const [phone, setPhone] = useState("+1 (415) 555-0142");
  const { field, validateAll } = useFormValidation(validators);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateAll({ fullName, dob, country, phone })) {
      router.push("/account-verification-2");
    }
  };

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Account Verification"
        description="Step 1 of 2 — confirm your details"
        actions={<TerraBadge tone="tertiary">Step 1 of 2</TerraBadge>}
      />

      <div className="mx-auto max-w-2xl">
        <TerraCard>
          <TerraSectionTitle
            title="Confirm your identity"
            description="This must match the details on your payment method."
          />
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                id="fullName"
                label="Full legal name"
                required
                value={fullName}
                {...field("fullName", fullName, setFullName)}
              />
              <FormField
                id="dob"
                label="Date of birth"
                type="text"
                required
                placeholder="YYYY-MM-DD"
                value={dob}
                {...field("dob", dob, setDob)}
              />
              <FormField
                id="country"
                label="Country of residence"
                required
                value={country}
                {...field("country", country, setCountry)}
              />
              <FormField
                id="phone"
                label="Phone number"
                type="tel"
                required
                value={phone}
                {...field("phone", phone, setPhone)}
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
              >
                Continue to step 2
              </button>
            </div>
          </form>
        </TerraCard>
      </div>
    </div>
  );
}
