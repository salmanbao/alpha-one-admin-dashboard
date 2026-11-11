"use client";

/**
 * Create Role Page — simple placeholder for role creation workflow
 * This is a placeholder since R4-03 requires view registration
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader } from "@/components/platform/page";
import { Button } from "@/components/ui/button";

export function CreateRolePage() {
  const { navigate } = usePlatform();
  
  // For now, navigate to platform-roles-page which likely has role management
  // This fulfills the "register view" requirement for R4-03
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <PageHeader title="Create Role" />
      <div className="text-center">
        <p className="text-lg">Role creation workflow coming soon</p>
        <Button 
          onClick={() => navigate("platform-roles")} 
          className="mt-4 bg-primary text-white px-6 py-3 rounded"
        >
          Go to Roles Management
        </Button>
      </div>
    </div>
  );
}