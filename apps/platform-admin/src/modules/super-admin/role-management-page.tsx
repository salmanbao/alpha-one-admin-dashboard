"use client";

/**
 * Role Management — platform-admin
 * Manage platform roles and permissions across super-admin and prop-admin applications.
 */

import { useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { roles as allRoles, users as allUsers } from "@/lib/platform/mock-data";
import { AuthUser } from "@/lib/platform/types";
import { cn } from "@/lib/utils";
import {
  Shield,
  Users,
  Lock,
  Globe,
  Settings2,
  Mail,
  Zap,
  CheckCircle2,
  AlertTriangle,
  
} from "lucide-react";

interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  application: "super-admin" | "prop-admin";
}

const columns: Column<RoleDefinition>[] = [
  {
    key: "id",
    header: "Role ID",
    cell: (r) => <span className="font-mono text-sm">{r.id}</span>,
    sortValue: (r) => r.id,
  },
  {
    key: "name",
    header: "Role Name",
    cell: (r) => (
      <span>
        <Button size="sm" variant="outline" className="hover:underline">
          {r.name}
        </Button>
      </span>
    ),
    sortValue: (r) => r.name,
  },
  {
    key: "description",
    header: "Description",
    cell: (r) => <span className="text-xs text-muted-foreground">{r.description}</span>,
    sortValue: (r) => r.description,
  },
  {
    key: "application",
    header: "Application",
    cell: (r) => (
      <Badge variant={r.application === "super-admin" ? "default" : "secondary"}>
        {r.application}
      </Badge>
    ),
    sortValue: (r) => r.application,
  },
  {
    key: "permissions-count",
    header: "Perms",
    cell: (r) => (
      <span className="text-[10px]">
        {r.permissions.length}
      </span>
    ),
    sortValue: (r) => r.permissions.length,
  },
  {
    key: "actions",
    header: "Actions",
    cell: (r) => (
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
          Edit
        </Button>
        <Button size="sm" variant="destructive" className="h-6 px-2 text-xs">
          Delete
        </Button>
      </div>
    ),
  },
];

export function RoleManagementPage() {
  const { navigate } = usePlatform();

  return (
    <Page>
      <PageHeader
        title="Role Management"
        description="Manage platform roles and permissions"
        icon={Shield}
      />
      <PageContent>
        <div className="grid gap-4 mb-6">
          <div>
            <Button
              size="icon"
              variant="outline"
              onClick={() => navigate("create-role")}
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" /> New role
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => navigate("manage-permissions")}
              className="flex items-center gap-2"
            >
              <Lock className="h-4 w-4" /> Manage permissions
            </Button>
          </div>
          <Select
            defaultValue="all"
            onValueChange={() => {}}
            
          >
            <SelectTrigger >
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All applications</SelectItem>
              <SelectItem value="super-admin">Super Admin</SelectItem>
              <SelectItem value="prop-admin">Prop Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DataTable
          columns={columns}
          data={allRoles as RoleDefinition[]}
          rowKey={(r) => r.id}
          searchableText={(r) => `${r.id} ${r.name} ${r.description}`}
          searchPlaceholder="Search roles…"
          pageSize={10}
          emptyTitle="No roles found"
          emptyDescription="Create a new role to get started."
        />
      </PageContent>
    </Page>
  );
}