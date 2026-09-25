"use client";

import { useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { getTraderForUser, getTraderAccounts } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Key, Copy, Download, Eye, EyeOff, Server, Lock, ShieldCheck, ExternalLink, AlertTriangle } from "lucide-react";

export function TradingCredentialsPage() {
  const { runtime, user } = usePlatform();
  const trader = user.application === "trader" ? getTraderForUser(user) : null;
  const accounts = trader ? getTraderAccounts(trader.id) : [];
  const account = accounts[0];
  const [showPassword, setShowPassword] = useState(false);
  const [showInvestor, setShowInvestor] = useState(false);

  if (!account) {
    return (
      <Page><PageHeader title="Trading Credentials" icon={Key} /><PageContent>
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <Key className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium">No active account</p>
          <p className="text-xs text-muted-foreground">Purchase a challenge to receive trading credentials.</p>
        </div>
      </PageContent></Page>
    );
  }

  const server = account.platform === "MT5" ? "AlphaCapital-Live" : account.platform === "MT4" ? "AlphaCapital-MT4" : "DXTrade-Live";

  return (
    <Page>
      <PageHeader title="Trading Credentials" description={`Account #${account.login} · ${account.platform}`} icon={Key} />
      <PageContent>
        <div className="rounded-lg border border-amber-500/20 bg-amber-50/30 p-3 text-xs dark:bg-amber-950/10">
          <p className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-400">
            <ShieldCheck className="h-4 w-4" /> Security notice
          </p>
          <p className="mt-1 text-muted-foreground">
            Your trading credentials give full access to your account. Never share them. Passwords are hidden by default — click reveal to view. Reveal actions are logged.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Connection details */}
          <Card>
            <CardContent className="space-y-3 p-4">
              <h3 className="text-sm font-semibold">Connection Details</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-md border p-2">
                  <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Platform</p><p className="text-sm font-medium">{account.platform}</p></div>
                  <Badge variant="outline" className="text-[10px]">{account.platform}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-md border p-2">
                  <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Server</p><p className="text-sm font-medium font-mono">{server}</p></div>
                  <Button size="sm" variant="ghost" aria-label="Copy server" onClick={() => toast({ title: "Copied", description: "Server name copied to clipboard." })}><Copy className="h-3 w-3" /></Button>
                </div>
                <div className="flex items-center justify-between rounded-md border p-2">
                  <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Login</p><p className="text-sm font-medium font-mono">{account.login}</p></div>
                  <Button size="sm" variant="ghost" aria-label="Copy login" onClick={() => toast({ title: "Copied", description: "Login copied to clipboard." })}><Copy className="h-3 w-3" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Passwords */}
          <Card>
            <CardContent className="space-y-3 p-4">
              <h3 className="text-sm font-semibold">Passwords</h3>
              {/* Main password */}
              <div className="rounded-md border p-2">
                <div className="flex items-center justify-between">
                  <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Trading Password</p>
                    <p className="font-mono text-sm">{showPassword ? "Tx9$kP2#Lm" : "••••••••••"}</p></div>
                  <div className="flex gap-1">
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button size="sm" variant="ghost" aria-label="Reveal password"><Eye className="h-3 w-3" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Reveal trading password?</AlertDialogTitle>
                          <AlertDialogDescription>This will display your trading password on screen. This action is logged for security. Make sure no one is looking at your screen.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => { setShowPassword(true); toast({ title: "Password revealed", description: "Reveal action logged." }); }}>Reveal</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    {showPassword && <Button size="sm" variant="ghost" aria-label="Hide password" onClick={() => setShowPassword(false)}><EyeOff className="h-3 w-3" /></Button>}
                    <Button size="sm" variant="ghost" aria-label="Copy password" onClick={() => toast({ title: "Copied", description: "Password copied to clipboard." })}><Copy className="h-3 w-3" /></Button>
                  </div>
                </div>
              </div>
              {/* Investor password */}
              <div className="rounded-md border p-2">
                <div className="flex items-center justify-between">
                  <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Investor Password</p>
                    <p className="font-mono text-sm">{showInvestor ? "Rv4@mQ8#Nx" : "••••••••••"}</p>
                    <p className="text-[10px] text-muted-foreground">Read-only access — no trading</p></div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" aria-label="Reveal investor password" onClick={() => { setShowInvestor(!showInvestor); toast({ title: showInvestor ? "Hidden" : "Revealed", description: showInvestor ? "Investor password hidden." : "Reveal action logged." }); }}>{showInvestor ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}</Button>
                    <Button size="sm" variant="ghost" aria-label="Copy investor password" onClick={() => toast({ title: "Copied", description: "Investor password copied." })}><Copy className="h-3 w-3" /></Button>
                  </div>
                </div>
              </div>
              {/* Download */}
              <Button variant="outline" className="w-full" onClick={() => toast({ title: "Credentials downloaded", description: "A PDF with your credentials has been downloaded." })}>
                <Download className="mr-1 h-4 w-4" /> Download credentials (PDF)
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Platform download */}
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-2 text-sm font-semibold">Download / Open Platform</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline"><ExternalLink className="mr-1 h-4 w-4" /> Download {account.platform} for Desktop</Button>
              <Button variant="outline"><ExternalLink className="mr-1 h-4 w-4" /> {account.platform} Web Terminal</Button>
              <Button variant="outline"><ExternalLink className="mr-1 h-4 w-4" /> Connection Guide</Button>
            </div>
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
