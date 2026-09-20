"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { AuditLogTable } from "@/components/platform/audit";
import { getTenantAudit } from "@/lib/platform/mock-data";
import { ScrollText } from "lucide-react";

export function AuditPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const entries = getTenantAudit(tid);
  return (
    <Page>
      <PageHeader title="Audit Log" description="All platform actions and changes." icon={ScrollText} />
      <PageContent>
        <AuditLogTable entries={entries} />
      </PageContent>
    </Page>
  );
}
