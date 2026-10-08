"use client";

/**
 * Profile & Security — converted from stitch_screens/profile_security
 * Profile fields, password change and connected devices summary.
 */

import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
} from "@/components/terra/terra-ui";

export function ProfileSecurityPage() {
  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Profile & Security"
        description="Your personal information and account protection"
        actions={<TerraBadge tone="success">Identity verified</TerraBadge>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TerraCard>
          <TerraSectionTitle title="Profile" />
          <div className="space-y-4">
            {[
              ["Full name", "Tom Allen"],
              ["Email", "tom.allen@terra.trader"],
              ["Phone", "+1 (415) 555-0142"],
              ["Country", "United States"],
            ].map(([label, value]) => (
              <label key={label} className="flex flex-col gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  {label}
                </span>
                <input
                  defaultValue={value}
                  className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
                />
              </label>
            ))}
            <button
              type="button"
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
            >
              Save changes
            </button>
          </div>
        </TerraCard>

        <div className="space-y-6">
          <TerraCard>
            <TerraSectionTitle title="Change password" />
            <div className="space-y-4">
              <input
                type="password"
                placeholder="Current password"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <input
                type="password"
                placeholder="New password"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <input
                type="password"
                placeholder="Confirm new password"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button
                type="button"
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
              >
                Update password
              </button>
            </div>
          </TerraCard>

          <TerraCard>
            <TerraSectionTitle title="Security score" />
            <div className="flex items-center justify-between rounded-xl bg-primary-fixed/50 px-4 py-3">
              <span className="text-sm font-semibold text-on-primary-fixed-variant">
                Strong — 2FA enabled, recent password
              </span>
              <span className="font-headline text-xl font-bold text-primary">A</span>
            </div>
          </TerraCard>
        </div>
      </div>
    </div>
  );
}
