"use client";

import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/platform/status";
import {
  Monitor, Smartphone, Tablet, Clock, ShieldCheck, AlertTriangle,
  CheckCircle2, XCircle, Lock, KeyRound, Bell, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface Session {
  id: string;
  device: string;
  browser: string;
  location: string;
  ip: string;
  current: boolean;
  lastActive: string;
  age: string;
  anomaly: boolean;
  icon: typeof Monitor;
}

const sessions: Session[] = [
  { id: "s1", device: "Desktop", browser: "Chrome 128", location: "New York, US", ip: "192.168.1.1", current: true, lastActive: "Active now", age: "2h 15m", anomaly: false, icon: Monitor },
  { id: "s2", device: "Mobile", browser: "Safari iOS", location: "New York, US", ip: "10.0.0.42", current: false, lastActive: "2h ago", age: "5h", anomaly: false, icon: Smartphone },
  { id: "s3", device: "Desktop", browser: "Firefox 130", location: "London, UK", ip: "203.0.113.5", current: false, lastActive: "1d ago", age: "1d 3h", anomaly: true, icon: Monitor },
];

export function MySessionsPage() {
  const otherSessions = sessions.filter((s) => !s.current);
  const anomalyCount = sessions.filter((s) => s.anomaly).length;

  return (
    <Page>
      <PageHeader title="My Sessions" description="Active sessions across your devices. Revoke suspicious or stale sessions." icon={ShieldCheck} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Active Sessions" value={sessions.length} icon={Activity} />
          <MetricCard label="Anomalies" value={anomalyCount} icon={AlertTriangle} tone={anomalyCount > 0 ? "warning" : "positive"} />
          <MetricCard label="2FA Status" value="Enabled" icon={KeyRound} tone="positive" />
          <MetricCard label="Last Password Change" value="12d ago" icon={Lock} />
        </div>

        {anomalyCount > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-50/50 p-3 dark:bg-amber-950/20">
            <p className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              {anomalyCount} session{anomalyCount === 1 ? "" : "s"} flagged as anomalous — review the location and IP below.
            </p>
          </div>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium">Active sessions</span>
            <Button
              size="sm"
              variant="outline"
              disabled={otherSessions.length === 0}
              onClick={() => toast({ title: "Sessions revoked", description: `${otherSessions.length} other session(s) revoked.` })}
            >
              <XCircle className="mr-1 h-3.5 w-3.5" /> Revoke all other
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {sessions.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.id} className={cn(
                  "flex items-center gap-3 rounded-md border p-3",
                  s.current && "border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/10",
                  s.anomaly && "border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10",
                )}>
                  <div className="rounded-md bg-muted p-2"><Icon className="h-4 w-4" /></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{s.device} · {s.browser}</p>
                      {s.current && <Badge variant="outline" className="border-emerald-500/30 text-[10px] text-emerald-700 dark:text-emerald-400">CURRENT</Badge>}
                      {s.anomaly && <Badge variant="outline" className="border-amber-500/30 text-[10px] text-amber-700 dark:text-amber-400">ANOMALY</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{s.location} · {s.ip} · {s.lastActive} · age {s.age}</p>
                  </div>
                  {!s.current && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-rose-600 hover:text-rose-600"
                      onClick={() => toast({ title: "Session revoked", description: `${s.device} session from ${s.location} revoked.`, variant: "destructive" })}
                    >
                      Revoke
                    </Button>
                  )}
                  {s.current && <span className="text-xs text-muted-foreground">Cannot revoke current session</span>}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="rounded-lg border border-amber-500/20 bg-amber-50/30 p-3 text-xs text-muted-foreground dark:bg-amber-950/10">
          <p className="font-medium text-foreground">Session security</p>
          <p className="mt-1">The operator cannot revoke their own current session through this action — use "Log out" instead. All session revocations are audited. Sessions expire automatically after 24h of inactivity.</p>
        </div>
      </PageContent>
    </Page>
  );
}
