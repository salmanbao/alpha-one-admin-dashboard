"use client";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, CheckCircle2, Clock, ShieldCheck } from "lucide-react";

export function TermsPoliciesPage() {
  const docs = [
    { name: "Terms of Service", version: "v2.1", accepted: "2 months ago", status: "accepted" },
    { name: "Challenge Rules", version: "v1.4", accepted: "2 months ago", status: "accepted" },
    { name: "Funded Trader Agreement", version: "v1.2", accepted: "—", status: "pending" },
    { name: "Privacy Policy", version: "v3.0", accepted: "2 months ago", status: "accepted" },
    { name: "Risk Disclosure", version: "v1.0", accepted: "2 months ago", status: "accepted" },
    { name: "Refund Policy", version: "v1.1", accepted: "2 months ago", status: "accepted" },
  ];

  return (
    <Page>
      <PageHeader title="Terms & Policies" description="Legal documents you've accepted. Versioned for transparency." icon={ShieldCheck} />
      <PageContent>
        <div className="space-y-2">
          {docs.map((d) => (
            <Card key={d.name}>
              <CardContent className="flex items-center gap-3 p-3">
                <div className="rounded-md bg-muted p-2"><FileText className="h-4 w-4" /></div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{d.name}</p>
                    <Badge variant="outline" className="text-[10px]">{d.version}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Accepted: {d.accepted}</p>
                </div>
                {d.status === "accepted" ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Clock className="h-5 w-5 text-amber-500" />}
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-50/30 p-3 text-xs text-muted-foreground dark:bg-amber-950/10">
          <p className="font-medium text-foreground">Versioned agreements</p>
          <p className="mt-1">When terms are updated, you'll be prompted to review and accept the new version before continuing. Your acceptance timestamp is recorded for legal compliance.</p>
        </div>
      </PageContent>
    </Page>
  );
}
