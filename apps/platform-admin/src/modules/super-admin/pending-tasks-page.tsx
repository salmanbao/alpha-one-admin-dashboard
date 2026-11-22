"use client";

/**
 * Pending Tasks — platform-admin
 * View and manage pending operations requiring attention across the platform.
 *
 * R13 P1-1: backed by the persisted pending-tasks store. "Take action"
 * navigates to the surface that resolves the task (and marks it
 * in-progress); "Mark all as reviewed" actually clears the inbox and
 * writes an audit row instead of firing a toast over untouched state.
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  listOpenTasks,
  startTask,
  reviewAllTasks,
  usePendingTasksVersion,
  type PendingTask,
} from "@/lib/platform/pending-tasks-store";
import { Zap, CheckCircle2, AlertTriangle, Shield, Clock, Folder } from "lucide-react";

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
  reviewed: "bg-green-100 text-green-800",
};

export function PendingTasksPage() {
  const { navigate } = usePlatform();
  usePendingTasksVersion();
  const tasks = listOpenTasks();

  const handleTakeAction = (task: PendingTask) => {
    startTask(task.id);
    navigate(task.route);
  };

  const handleReviewAll = () => {
    const cleared = reviewAllTasks();
    if (cleared === 0) {
      toast({ title: "Inbox already clear", description: "No open tasks to review." });
      return;
    }
    toast({
      title: "All tasks reviewed",
      description: `${cleared} task(s) cleared from the operations inbox.`,
    });
  };

  return (
    <Page>
      <PageHeader
        title="Pending Tasks"
        description="Operations requiring attention across the platform"
        icon={AlertTriangle}
      />
      <PageContent>
        <p className="text-sm text-muted-foreground mb-4">
          {tasks.length} pending task{tasks.length === 1 ? "" : "s"} requiring attention
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
                  onClick={() => handleTakeAction(task)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Take action
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-border/50">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground mb-3">
              No pending tasks — the operations inbox is clear.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mb-3">
              {tasks.length} task{tasks.length === 1 ? "" : "s"} still open. Reviewing clears
              them from this inbox and writes an audit record.
            </p>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleReviewAll}
            disabled={tasks.length === 0}
          >
            Mark all as reviewed
          </Button>
        </div>
      </PageContent>
    </Page>
  );
}
