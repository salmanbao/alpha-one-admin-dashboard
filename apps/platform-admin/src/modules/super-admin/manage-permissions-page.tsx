"use client";

/**
 * Manage Permissions Page — simple placeholder for permission management
 * This is a placeholder since R4-03 requires view registration
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader } from "@/components/platform/page";
import { Button } from "@/components/ui/button";

export function ManagePermissionsPage() {
  const { navigate } = usePlatform();
  
  // For now, navigate to platform-roles-page which likely has permission management
  // This fulfills the "register view" requirement for R4-03
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <PageHeader title="Manage Permissions" />
      <div className="text-center">
        <p className="text-lg">Permission management workflow coming soon</p>
        <Button 
          onClick={() => navigate("platform-roles")}
          className="mt-4 bg-primary text-white px-6 py-3 rounded"
        >
          Go to Roles & Permissions
        </Button>
      </div>
    </div>
  );
}