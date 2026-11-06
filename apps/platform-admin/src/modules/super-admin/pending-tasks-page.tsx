"use client";

/**
 * Pending Tasks — platform-admin
 * View and manage pending operations requiring attention across the platform.
 */

import { useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Zap, CheckCircle2, AlertTriangle, Shield, Clock, Users, UserPlus, Folder } from "lucide-react";

interface PendingTask {
  id: string;
  title: string;
  description: string;
  category: "billing" | "approval" | "security" | "compliance" | "operations";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string;
  status: "pending" | "in-progress" | "blocked";
  action: () => void;
}

const tasks: PendingTask[] = [
  {
    id: "task-1",
    title: "Review pending invoices",
    description: "3 invoices require approval before the billing cycle closes.",
    category: "billing",
    priority: "high",
    dueDate: "2025-12-15",
    status: "pending",
    action: () => toast({ title: "Opening billing", description: "Redirecting to billing & invoices page." }),
  },
  {
    id: "task-2",
    title: "User access review",
    description: "2 users have pending access requests that need approval.",
    category: "security",
    priority: "urgent",
    dueDate: "2025-12-10",
    status: "pending",
    action: () => toast({ title: "Opening security", description: "Redirecting to security overview." }),
  },
  {
    id: "task-3",
    title: "Module catalog sync",
    description: "Module catalog needs synchronization with the central registry.",
    category: "compliance",
    priority: "medium",
    dueDate: "2025-12-20",
    status: "pending",
    action: () => toast({ title: "Catalog sync", description: "Syncing module catalog (demo — no network call)." }),
  },
  {
    id: "task-4",
    title: "Feature flags audit",
    description: "Review recently created feature flags for compliance.",
    category: "compliance",
    priority: "low",
    dueDate: "2025-12-25",
    status: "in-progress",
    action: () => toast({ title: "Feature flags", description: "Opening feature flags audit." }),
  },
  {
    id: "task-5",
    title: "Backup verification",
    description: "Verify recent backups are complete and restorable.",
    category: "operations",
    priority: "high",
    dueDate: "2025-12-12",
    status: "pending",
    action: () => toast({ title: "Backup verification", description: "Starting backup verification (demo)." }),
  },
];

const priorityColors: Record<PendingTask["priority"], string> = {
  low: "text-green-500/70",
  medium: "text-yellow-500/70",
  high: "text-orange-500/70",
  urgent: "text-red-500/70",
};

const categoryIcons: Record<PendingTask["category"], React.ReactElement> = {
  billing: <Clock className="h-4 w-4 text-amber-500" />,
  approval: <AlertTriangle className="h-4 w-4 text-orange-500" />,
  security: <Shield className="h-4 w-4 text-red-500" />,
  compliance: <Folder className="h-4 w-4 text-purple-500" />,
  operations: <Zap className="h-4 w-4 text-blue-500" />,
};

const statusIndicators: Record<PendingTask["status"], string> = {
  pending: "bg-gray-100 text-gray-800",
  "in-progress": "bg-blue-100 text-blue-800",
  blocked: "bg-red-100 text-red-800",
};

export function PendingTasksPage() {
  const { navigate } = usePlatform();

  return (
    <Page>
      <PageHeader
        title="Pending Tasks"
        description="Operations requiring attention across the platform"
        icon={AlertTriangle}
      />
      <PageContent>
        <p className="text-sm text-muted-foreground mb-4">
          {tasks.length} pending tasks requiring attention
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks.map((task) => (
            <Card
              key={task.id}
              className="p-4 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <Badge
                    variant="outline"
                    className={`h-5 w-5 rounded ${statusIndicators[task.status]} flex items-center justify-center text-[10px]`}
                  >
                    {categoryIcons[task.category]}
                  </Badge>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground truncate line-clamp-1">
                    {task.title}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {task.description}
                  </p>
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                  <span className={`${priorityColors[task.priority]} text-[10px] font-bold uppercase tracking-wider`}>
                    {task.priority}
                  </span>
                  <span className="text-[9px] text-muted-foreground">{task.dueDate}</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border/50 flex justify-between items-start">
                <span className="text-[10px] text-muted-foreground capitalize">{task.category}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="hover:bg-primary/10"
                  onClick={task.action}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Take action
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-border/50">
          <p className="text-sm text-muted-foreground mb-3">
            No pending tasks
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              toast({
                title: "No tasks",
                description: "All caught up — great work!",
              })
            }
          >
            Mark all as reviewed
          </Button>
        </div>
      </PageContent>
    </Page>
  );
}