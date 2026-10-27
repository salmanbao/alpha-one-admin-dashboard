"use client";
import { useState } from "react";
import { Page, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Flag, EyeOff, ShieldAlert, RefreshCcw, Clock, Lock, Unlock } from "lucide-react";

const demoFlags = [
  { id: "ff-trader-mobile", name: "Trader Mobile UI", target: { rules: [{ key: "user.agent", value: "mobile" }] }, status: "on", killSwitch: false, version: "v3.1.0", updated: "2026-10-25" },
  { id: "ff-analytics-v3", name: "Analytics V3 Engine", target: { rules: [{ key: "tenant.plan", value: "scale" }] }, status: "on", killSwitch: false, version: "v3.0.2", updated: "2026-10-22" },
  { id: "ff-compliance-check", name: "Compliance Auto-Check", target: { rules: [{ key: "user.role", value: "super-admin" }] }, status: "off", killSwitch: true, version: "v2.9.1", updated: "2026-10-24" },
];

export function FeatureFlagEditorPage() {
  const [flags] = useState(demoFlags);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTargetRule, setNewTargetRule] = useState("user.agent=mobile");

  const current = flags.find((f) => f.id === editingId);

  return (
    <Page>
      <PageContent>
        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Feature Flag Editor</span></CardHeader>
          <CardContent className="space-y-4 p-4">
            {/* Kill-switch + targeting overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {flags.map((f) => (
                <div
                  key={f.id}
                  className={cn("rounded-lg border p-3", f.killSwitch ? "border-rose-500/30 bg-rose-50/40 dark:bg-rose-950/20" : f.status === "on" ? "border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/20" : "border-amber-500/30 bg-amber-50/20 dark:bg-amber-950/20")}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{f.name}</p>
                    <Badge variant={f.killSwitch ? "destructive" : f.status === "on" ? "default" : "outline"} className="text-[9px]">{f.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{f.id}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs font-mono text-amber-800">{f.version}</div>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => setEditingId(f.id)}>
                      <Lock className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => toast({ title: f.killSwitch ? "Kill-switch released" : "Killed", description: `${f.name}: ${f.killSwitch ? "enabled" : "disabled"}. Audited.` })}>
                      <EyeOff className="h-3 w-3 mr-1" /> {f.killSwitch ? "Release" : "Kill"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Editor panel */}
            {current && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Edit: {current.name}</span>
                    <Badge variant="outline" className="text-[10px]">v{current.version}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-4">
                  <div>
                    <Label>Targeting rules (key=value)</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        defaultValue={newTargetRule}
                        onChange={(e) => setNewTargetRule(e.target.value)}
                        placeholder="user.agent=mobile"
                        className="text-xs"
                      />
                      <Button size="sm" variant="outline" onClick={() => toast({ title: "Targeting updated", description: `Rule applied to ${current.name}` })}>
                        Apply
                      </Button>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Current rules: {current.target.rules.map((r) => `${r.key}=${String(r.value)}`).join(", ")}
                    </div>
                  </div>

                  <div>
                    <Label>Kill switch (global disable)</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Switch
                        checked={current.killSwitch}
                        onCheckedChange={() => toast({ title: "Kill-switch toggled", description: `Flag ${current.name}: ${!current.killSwitch ? "killed" : "released"}` })}
                      />
                      <span className="text-xs">{current.killSwitch ? "Disabled" : "Enabled"}</span>
                    </div>
                  </div>

                  <div>
                    <Label>History</Label>
                    <div className="space-y-2 mt-2">
                      {[
                        { when: "2026-10-25 14:32", action: "Enabled targeting for mobile users", actor: "Marcus Vance" },
                        { when: "2026-10-24 09:00", action: "Kill-switch applied (compliance review)", actor: "Sarah Chen" },
                        { when: "2026-10-22 11:15", action: "Released to Scale tenants only", actor: "James Rodriguez" },
                      ].map((h) => (
                        <div key={h.when} className="rounded-md border p-2 text-xs bg-muted/30">
                          <div className="flex items-center gap-2 font-medium">
                            <Clock className="h-3 w-3 text-muted-foreground" /> {h.when}
                          </div>
                          <p className="text-muted-foreground">{h.action}</p>
                          <p className="text-[10px]">{h.actor}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Close</Button>
                    <Button size="sm" variant="destructive" onClick={() => toast({ title: "Flag deleted", description: `${current.name} deleted.` })}>Delete</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}