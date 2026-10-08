"use client";

/**
 * Profile Page — user account, avatar, preferences, sessions.
 *
 * Spec section 11. Includes avatar upload (client-side preview),
 * display name editing, notification preferences quick-access,
 * active sessions, and security info.
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/platform/status";
import { User, Shield, Bell, Settings, Camera, Monitor, Smartphone, Tablet, Globe, Clock, Mail, MapPin, Check } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { useState, useRef, useEffect } from "react";

/** Derive initials from a display name (first letters of the first two words). */
function initialsFrom(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "U";
}

export function ProfilePage() {
  const { user, tenant, updateUser } = usePlatform();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl ?? null);
  const [displayName, setDisplayName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  // Quick-preferences persist to localStorage so reloads keep the
  // operator's choices. Mirrors the NotificationsTab pattern in
  // settings-page.tsx (`pfaas:notificationPrefs`). Round 4 fix:
  // previously local-only with the comment "no persistence layer yet".
  const PROFILE_PREFS_KEY = "pfaas:profilePrefs";
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") {
      return {
        "Email notifications": true,
        "In-app notifications": true,
        "Desktop notifications": false,
        "Weekly digest": true,
        "AI insight alerts": true,
      };
    }
    try {
      const stored = window.localStorage.getItem(PROFILE_PREFS_KEY);
      if (stored) {
        return {
          "Email notifications": true,
          "In-app notifications": true,
          "Desktop notifications": false,
          "Weekly digest": true,
          "AI insight alerts": true,
          ...(JSON.parse(stored) as Record<string, boolean>),
        };
      }
    } catch { /* ignore parse errors */ }
    return {
      "Email notifications": true,
      "In-app notifications": true,
      "Desktop notifications": false,
      "Weekly digest": true,
      "AI insight alerts": true,
    };
  });
  // Persist whenever prefs change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(PROFILE_PREFS_KEY, JSON.stringify(prefs));
    } catch { /* ignore quota errors */ }
  }, [prefs]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resync local edits when the active user changes (user switcher).
  // Render-time reset pattern (avoids setState-in-effect cascades).
  const [lastUserId, setLastUserId] = useState(user.id);
  if (lastUserId !== user.id) {
    setLastUserId(user.id);
    setAvatarUrl(user.avatarUrl ?? null);
    setDisplayName(user.name);
    setEmail(user.email);
  }

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Avatar must be under 2MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setAvatarUrl(url);
      // Persist immediately so the avatar survives reloads and shows in the topbar
      updateUser({ avatarUrl: url });
      toast({ title: "Avatar updated", description: "Your profile photo has been updated." });
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = () => {
    const name = displayName.trim();
    const mail = email.trim();
    if (!name) {
      toast({ title: "Name required", description: "Display name cannot be empty.", variant: "destructive" });
      return;
    }
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    updateUser({ name, email: mail || user.email, initials: initialsFrom(name) });
    toast({ title: "Profile saved", description: "Your changes have been saved." });
  };

  // Mock active sessions
  const sessions = [
    { id: "s1", device: "Desktop", browser: "Chrome 128", location: "New York, US", ip: "192.168.1.1", current: true, icon: Monitor, lastActive: "Active now" },
    { id: "s2", device: "Mobile", browser: "Safari iOS", location: "New York, US", ip: "10.0.0.42", current: false, icon: Smartphone, lastActive: "2h ago" },
    { id: "s3", device: "Tablet", browser: "Chrome Android", location: "London, UK", ip: "203.0.113.5", current: false, icon: Tablet, lastActive: "1d ago" },
  ];

  return (
    <Page>
      <PageHeader title="Profile" description="Your account, preferences, and security." icon={User} />
      <PageContent>
        {/* Profile header with avatar upload */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative">
                <Avatar className="h-20 w-20 border-2 border-border">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={user.name} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <AvatarFallback className="bg-primary/10 text-xl font-bold text-primary">{user.initials}</AvatarFallback>
                  )}
                </Avatar>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-110"
                  aria-label="Upload avatar"
                  title="Upload avatar"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                  aria-label="Choose avatar file"
                />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-foreground">{user.name}</h2>
                  <StatusBadge tone="info">{user.application}</StatusBadge>
                  {user.roles.map((r) => (
                    <Badge key={r} variant="outline" className="text-[10px]">{r.replace("-", " ")}</Badge>
                  ))}
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" /> {user.email}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground/70">
                  <Clock className="h-3 w-3" /> Last active: {new Date(user.lastActiveAt).toLocaleString()}
                </p>
              </div>
              <Button size="sm" onClick={saveProfile} className="gap-1.5">
                <Check className="h-4 w-4" /> Save
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Edit profile form */}
        <Card>
          <CardHeader className="pb-2">
            <span className="text-sm font-medium">Edit Profile</span>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="display-name">Display Name</Label>
                <Input id="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Changes to your display name and email will be reflected across the platform.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Roles & permissions */}
          <Card>
            <CardHeader className="pb-2"><div className="flex items-center gap-2"><Shield className="h-4 w-4" /><span className="text-sm font-medium">Roles & Permissions</span></div></CardHeader>
            <CardContent>
              <p className="mb-2 text-xs text-muted-foreground">Roles:</p>
              <div className="mb-3 flex flex-wrap gap-1">
                {user.roles.map((r) => <Badge key={r}>{r}</Badge>)}
              </div>
              <p className="mb-2 text-xs text-muted-foreground">{user.permissions.length} permissions granted</p>
              <div className="flex flex-wrap gap-1">
                {user.permissions.slice(0, 12).map((p) => (
                  <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                ))}
                {user.permissions.length > 12 ? <Badge variant="outline" className="text-[10px]">+{user.permissions.length - 12} more</Badge> : null}
              </div>
            </CardContent>
          </Card>

          {/* Tenant info */}
          <Card>
            <CardHeader className="pb-2"><div className="flex items-center gap-2"><Settings className="h-4 w-4" /><span className="text-sm font-medium">Tenant</span></div></CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white" style={{ background: tenant.branding.primaryColor }}>
                  {tenant.branding.initials}
                </span>
                <div>
                  <p className="text-sm font-medium">{tenant.branding.name}</p>
                  <p className="text-xs text-muted-foreground">{tenant.plan} plan · {tenant.currency} · {tenant.timezone}</p>
                </div>
              </div>
              <Separator className="my-3" />
              <div className="space-y-1.5 text-xs">
                <p className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-3 w-3" /> Locale: {tenant.locale}</p>
                <p className="flex items-center gap-1.5 text-muted-foreground"><Globe className="h-3 w-3" /> Timezone: {tenant.timezone}</p>
                <p className="flex items-center gap-1.5 text-muted-foreground"><Settings className="h-3 w-3" /> {tenant.enabledModules.length} modules enabled</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick preferences */}
        <Card>
          <CardHeader className="pb-2"><div className="flex items-center gap-2"><Bell className="h-4 w-4" /><span className="text-sm font-medium">Quick Preferences</span></div></CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Email notifications", desc: "Receive email alerts for critical events", defaultOn: true },
              { label: "In-app notifications", desc: "Show notifications in the platform", defaultOn: true },
              { label: "Desktop notifications", desc: "Browser push notifications", defaultOn: false },
              { label: "Weekly digest", desc: "Summary of activity every Monday", defaultOn: true },
              { label: "AI insight alerts", desc: "Notify when AI generates a critical insight", defaultOn: true },
            ].map((p) => (
              <div key={p.label} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{p.desc}</p>
                </div>
                <Switch
                  checked={prefs[p.label] ?? p.defaultOn}
                  onCheckedChange={(v) => setPrefs((s) => ({ ...s, [p.label]: v }))}
                  aria-label={p.label}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Active sessions */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Globe className="h-4 w-4" /><span className="text-sm font-medium">Active Sessions</span></div>
              <Badge variant="secondary">{sessions.length} devices</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {sessions.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.id} className="flex items-center gap-3 rounded-md border p-3">
                  <div className="rounded-md bg-muted p-2"><Icon className="h-4 w-4 text-muted-foreground" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{s.device}</span>
                      {s.current ? <StatusBadge tone="success">Current</StatusBadge> : null}
                    </div>
                    <p className="text-xs text-muted-foreground">{s.browser} · {s.location} · {s.ip}</p>
                    <p className="text-[10px] text-muted-foreground/70">{s.lastActive}</p>
                  </div>
                  {!s.current ? (
                    <Button size="sm" variant="ghost" className="text-rose-600 hover:text-rose-700" onClick={() => toast({ title: "Session revoked (demo)", description: `${s.device} session would be ended in production.`, variant: "destructive" })}>
                      Revoke
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
