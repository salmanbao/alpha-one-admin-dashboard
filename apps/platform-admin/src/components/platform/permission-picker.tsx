"use client";

/**
 * Permission picker — grouped checkbox list shared by the Create Role
 * and Manage Permissions editors (gap S-04).
 *
 * Renders the scope's permission catalog grouped by domain, with
 * per-group bulk toggles and a live selected-count per group so the
 * operator always sees exactly what a role will grant.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { PermissionOption } from "@/lib/platform/role-store";

interface PermissionPickerProps {
  catalog: PermissionOption[];
  selected: Set<string>;
  onToggle: (permissionId: string, checked: boolean) => void;
  disabled?: boolean;
}

export function PermissionPicker({ catalog, selected, onToggle, disabled }: PermissionPickerProps) {
  const groups = new Map<string, PermissionOption[]>();
  for (const option of catalog) {
    const list = groups.get(option.group) ?? [];
    list.push(option);
    groups.set(option.group, list);
  }

  return (
    <div className="space-y-4">
      {Array.from(groups.entries()).map(([group, options]) => {
        const selectedInGroup = options.filter((o) => selected.has(o.id)).length;
        const allSelected = selectedInGroup === options.length;
        return (
          <div key={group}>
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group}
                </h4>
                <Badge variant="secondary" className="text-[9px]">
                  {selectedInGroup}/{options.length}
                </Badge>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[10px]"
                disabled={disabled}
                onClick={() =>
                  options.forEach((o) => onToggle(o.id, !allSelected))
                }
              >
                {allSelected ? "Clear group" : "Select group"}
              </Button>
            </div>
            <div className="grid gap-1 sm:grid-cols-2">
              {options.map((option) => (
                <label
                  key={option.id}
                  className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-sm transition-colors ${
                    selected.has(option.id)
                      ? "border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/20"
                      : "hover:bg-muted/50"
                  } ${disabled ? "opacity-60" : "cursor-pointer"}`}
                >
                  <Checkbox
                    checked={selected.has(option.id)}
                    disabled={disabled}
                    onCheckedChange={(checked) => onToggle(option.id, checked === true)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block leading-tight">{option.label}</span>
                    <code className="block text-[10px] text-muted-foreground">{option.id}</code>
                  </span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
