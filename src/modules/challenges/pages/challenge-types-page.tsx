"use client";

/**
 * Challenge Types catalog page.
 *
 * Card grid of all challenge types. Each card surfaces type-level
 * badges (free trial, competition, phase count, active toggle) and
 * a single primary action (Edit → jump to Challenge Configuration
 * with the type pre-selected, §22-23 contextual action).
 */

import { useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { getChallengeTypes, type ChallengeType } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Layers,
  Plus,
  Zap,
  Target,
  GitBranch,
  Gift,
  Trophy,
  PencilLine,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

/* Icon mapping per the spec. Single source of truth. */
const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap,
  Target,
  Layers,
  GitBranch,
  Gift,
  Trophy,
};

function TypeIcon({ name, className }: { name: string; className?: string }) {
  const Icon = TYPE_ICONS[name] ?? Target;
  return <Icon className={className} />;
}

function ChallengeTypeCard({
  type,
  active,
  onToggle,
  onEdit,
}: {
  type: ChallengeType;
  active: boolean;
  onToggle: (next: boolean) => void;
  onEdit: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex flex-col gap-3 rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm",
        !active && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-muted p-2 text-emerald-600 dark:text-emerald-400">
            <TypeIcon name={type.icon} className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{type.name}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{type.description}</p>
          </div>
        </div>
        <Switch
          checked={active}
          onCheckedChange={onToggle}
          aria-label={`Toggle active state for ${type.name}`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="text-[10px]">
          <Layers className="mr-1 h-3 w-3" />
          {type.phases} phase{type.phases === 1 ? "" : "s"}
        </Badge>
        {type.hasFreeTrial ? (
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 text-[10px] dark:text-emerald-400">
            <Gift className="mr-1 h-3 w-3" />
            Free Trial
          </Badge>
        ) : null}
        {type.isCompetition ? (
          <Badge variant="outline" className="border-amber-500/40 text-amber-700 text-[10px] dark:text-amber-400">
            <Trophy className="mr-1 h-3 w-3" />
            Competition
          </Badge>
        ) : null}
        {active ? (
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 text-[10px] dark:text-emerald-400">
            <Check className="mr-1 h-3 w-3" />
            Active
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            Disabled
          </Badge>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
        <span className="text-xs text-muted-foreground">
          {type.id}
        </span>
        <Button size="sm" variant="outline" onClick={onEdit}>
          <PencilLine className="mr-1 h-3.5 w-3.5" /> Edit
        </Button>
      </div>
    </div>
  );
}

export function ChallengeTypesPage() {
  const { navigate } = usePlatform();
  const types = getChallengeTypes();
  const [activeMap, setActiveMap] = useState<Record<string, boolean>>(
    Object.fromEntries(types.map((t) => [t.id, t.active])),
  );

  return (
    <Page>
      <PageHeader
        title="Challenge Types"
        description="Catalog of evaluation programs available to traders. Toggle availability or edit phase configuration."
        icon={Layers}
        actions={
          <Button
            size="sm"
            onClick={() =>
              toast({ title: "Add Challenge Type", description: "The new challenge type form would open here." })
            }
          >
            <Plus className="mr-1 h-4 w-4" /> Add Challenge Type
          </Button>
        }
      />
      <PageContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {types.map((t) => (
            <ChallengeTypeCard
              key={t.id}
              type={t}
              active={activeMap[t.id] ?? t.active}
              onToggle={(next) => {
                setActiveMap((m) => ({ ...m, [t.id]: next }));
                toast({
                  title: next ? "Challenge type enabled" : "Challenge type disabled",
                  description: `${t.name} is now ${next ? "available for purchase" : "hidden from the catalog"}.`,
                });
              }}
              onEdit={() => navigate("challenge-config", { typeId: t.id })}
            />
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Editing a card opens the <span className="font-medium text-foreground">Challenge Configuration</span> page with that type pre-selected.
        </p>
      </PageContent>
    </Page>
  );
}
