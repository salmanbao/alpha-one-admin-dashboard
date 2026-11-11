"use client";

/**
 * Profile & Security — converted from stitch_screens/profile_security
 * Profile fields, avatar upload, password change and connected devices
 * summary.
 *
 * R5 (Wave 0.5): the password change is no longer a fake. It verifies
 * the current password against the session-store account and rewrites
 * the credential via updateAccountPassword() — the same store login
 * validates against. Profile name/email persist to the active session;
 * phone/country/photo stay honestly labeled demo-only.
 */

import { useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
} from "@/components/terra/terra-ui";
import {
  DEMO_ACCOUNT,
  findAccountByEmail,
  readAccounts,
  updateAccountPassword,
  useSession,
  verifyPassword,
  writeAccounts,
  writeSession,
} from "@/lib/session-store";

const initialFields: { key: string; label: string; value: string }[] = [
  { key: "name", label: "Full name", value: "Tom Allen" },
  { key: "email", label: "Email", value: "tom.allen@terra.trader" },
  { key: "phone", label: "Phone", value: "+1 (415) 555-0142" },
  { key: "country", label: "Country", value: "United States" },
];

export function ProfileSecurityPage() {
  const session = useSession();
  // Local edits overlay the persisted identity (defaults → session → edits)
  // — no setState-in-effect hydration; the store hook supplies the values.
  const [edits, setEdits] = useState<Record<string, string>>({});
  const fields: Record<string, string> = {
    ...Object.fromEntries(initialFields.map((f) => [f.key, f.value])),
    ...(session ? { name: session.displayName, email: session.email } : {}),
    ...edits,
  };
  const [saved, setSaved] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSave = () => {
    // Name/email persist to the session + account record; phone/country
    // have no store yet and are labeled demo-only below.
    if (!session) {
      toast({
        title: "Not signed in",
        description: "Sign in again to persist profile changes.",
        variant: "destructive",
      });
      return;
    }
    const accounts = readAccounts();
    const idx = accounts.findIndex(
      (a) => a.email.toLowerCase() === session.email.toLowerCase(),
    );
    if (idx !== -1) {
      accounts[idx] = {
        ...accounts[idx],
        displayName: fields.name,
        email: fields.email,
      };
      writeAccounts(accounts);
    }
    writeSession({
      ...session,
      displayName: fields.name,
      email: fields.email,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatar(URL.createObjectURL(file));
    // Frontend-only demo: no upload endpoint.
    toast({
      title: "Avatar updated",
      description: `${file.name} — preview applied locally. A real deployment would PUT /profile/avatar. (Demo — no backend call.)`,
    });
  };

  const handlePassword = () => {
    if (!pw.current) {
      setPwMsg({ ok: false, text: "Enter your current password." });
      return;
    }
    if (pw.next.length < 8) {
      setPwMsg({ ok: false, text: "New password must be at least 8 characters." });
      return;
    }
    if (pw.next !== pw.confirm) {
      setPwMsg({ ok: false, text: "New passwords do not match." });
      return;
    }

    if (!session) {
      setPwMsg({ ok: false, text: "No active session — sign in again to change your password." });
      return;
    }

    let account = findAccountByEmail(session.email);
    if (!account && session.isDemo) {
      // The demo persona starts without a stored credential — seed it so
      // the change is real (login resolves it through findAccountByEmail).
      account = { ...DEMO_ACCOUNT };
      writeAccounts([...readAccounts(), account]);
    }
    if (!account) {
      setPwMsg({ ok: false, text: "This account no longer exists — sign up again." });
      return;
    }
    if (!verifyPassword(pw.current, account.password)) {
      setPwMsg({ ok: false, text: "Current password is incorrect." });
      return;
    }
    if (!updateAccountPassword(session.email, pw.next)) {
      setPwMsg({ ok: false, text: "The stored credential could not be updated — try again." });
      return;
    }
    setPw({ current: "", next: "", confirm: "" });
    setPwMsg({
      ok: true,
      text: "Password updated — your new password is required the next time you sign in.",
    });
  };

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
          {/* Avatar upload (PRD PUT /profile/avatar) */}
          <div className="mb-5 flex items-center gap-4 rounded-xl bg-surface-container-low p-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-fixed text-lg font-bold text-on-primary-fixed-variant">
              {avatar ? (
                <img src={avatar} alt="Avatar preview" className="h-full w-full object-cover" />
              ) : (
                "TA"
              )}
            </span>
            <div>
              <p className="text-sm font-bold text-on-surface">Profile photo</p>
              <p className="text-xs text-on-surface-variant">
                JPG or PNG, shown as a preview until saved.
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatar}
                  className="hidden"
                  aria-label="Choose avatar image"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="rounded-lg bg-surface-container px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container-high"
                >
                  {avatar ? "Change photo" : "Upload photo"}
                </button>
                {avatar && (
                  <button
                    type="button"
                    onClick={() => setAvatar(null)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:text-on-surface"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {initialFields.map((f) => (
              <label key={f.key} className="flex flex-col gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  {f.label}
                </span>
                <input
                  value={fields[f.key]}
                  onChange={(e) =>
                    setEdits((s) => ({ ...s, [f.key]: e.target.value }))
                  }
                  className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
                />
              </label>
            ))}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
              >
                Save changes
              </button>
              {saved && (
                <span className="text-xs font-bold text-primary">
                  ✓ Profile saved (name & email persisted on this device; phone, country & photo are demo-only)
                </span>
              )}
            </div>
          </div>
        </TerraCard>

        <div className="space-y-6">
          <TerraCard>
            <TerraSectionTitle title="Change password" />
            <div className="space-y-4">
              <input
                type="password"
                placeholder="Current password"
                value={pw.current}
                onChange={(e) => setPw((s) => ({ ...s, current: e.target.value }))}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <input
                type="password"
                placeholder="New password"
                value={pw.next}
                onChange={(e) => setPw((s) => ({ ...s, next: e.target.value }))}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={pw.confirm}
                onChange={(e) => setPw((s) => ({ ...s, confirm: e.target.value }))}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePassword}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
                >
                  Update password
                </button>
                {pwMsg && (
                  <span
                    className={`text-xs font-bold ${pwMsg.ok ? "text-primary" : "text-error"}`}
                    role="status"
                  >
                    {pwMsg.text}
                  </span>
                )}
              </div>
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
