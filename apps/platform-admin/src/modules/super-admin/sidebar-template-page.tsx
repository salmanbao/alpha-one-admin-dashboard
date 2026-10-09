"use client";

/**
 * PFaaS Platform — Sidebar Template Page
 *
 * A minimal page that renders ONLY <Page><PageHeader/><PageContent/></Page>
 * with a heading. Used to verify the sidebar renders correctly and clicking
 * navigation items works — without any complex page logic.
 */

import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Info } from "lucide-react";

export function SidebarTemplatePage() {
  return (
    <Page>
      <PageHeader
        title="Sidebar Template"
        description="Minimal test page to verify sidebar rendering and navigation."
        icon={Info}
      />
      <PageContent>
        <div className="rounded-lg border bg-muted/30 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            If you can see this page, the sidebar navigation and routing are working correctly.
          </p>
        </div>
      </PageContent>
    </Page>
  );
}
