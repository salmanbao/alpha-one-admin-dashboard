"use client";

import { useState, useEffect } from "react";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { moduleRegistry } from "@/lib/platform/module-registry";
import { readKillSwitches, getKillSwitch, toggleKillSwitch } from "@/lib/platform/module-kill-switch-store";

export function ModuleDetailPage({ params }: { params?: Record<string, string> }) {
  const allModules = moduleRegistry.getAll();
  const moduleId = params?.module;
  const selectedModule = moduleId ? allModules.find((m) => m.manifest.id === moduleId) : undefined;
  const moduleName = selectedModule?.manifest?.name ?? "Unknown Module";

  const [showKillSwitch, setShowKillSwitch] = useState(false);
  const [showOverrides, setShowOverrides] = useState(false);
  const [fleetDisabled, setFleetDisabled] = useState(false);

  // Load kill switch state from persisted store
  const [killSwitchState, setKillSwitchState] = useState(false);
  useEffect(() => {
    const ks = getKillSwitch(moduleId ?? "");
    if (ks) {
      setKillSwitchState(ks.disabled);
    }
  }, [moduleId]);

  const handleToggleKillSwitch = () => {
    const ks = getKillSwitch(moduleId ?? "");
    if (ks) {
      const newState = !ks.disabled;
      setFleetDisabled(newState);
      setKillSwitchState(newState);
      const operator = { id: "op-admin", name: "Platform Admin" };
      toggleKillSwitch(moduleId ?? "", moduleName, newState, operator);
    }
  };

  return (
    <Page>
      <PageHeader
        title={selectedModule ? selectedModule.manifest.name : "Module Detail"}
        description={selectedModule ? `View details for ${selectedModule.manifest.name}` : "Select a module from the catalog to view its detail."}
      />
      <PageContent>
        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Module Details</span></CardHeader>
          <CardContent className="space-y-3">
            <Card>
              <CardHeader className="pb-2"><span className="text-sm font-medium">Module Catalog</span></CardHeader>
              <CardContent className="space-y-1">
                {allModules.map((m) => (
                  <button
                    key={m.manifest.id}
                    onClick={() => {}}
                    className="flex w-full items-center gap-3 rounded-md border p-2.5 text-left transition-colors"
                  >
                    <span className="h-4 w-4 rounded-full bg-muted" />
                    <span className="text-sm font-medium truncate">{m.manifest.name}</span>
                  </button>
                ))}
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}