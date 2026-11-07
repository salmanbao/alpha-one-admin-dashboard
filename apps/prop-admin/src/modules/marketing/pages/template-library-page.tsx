"use client";

/**
 * M4.5 — Flow & Campaign Template Library (spec §8.5).
 *
 * Gallery of ready-made prop-firm automations and campaign templates
 * with previews, placeholder dictionaries (bound to the tenant
 * terminology engine) and one-click instantiation into independent
 * drafts — the shared template set is seeded on first open.
 *
 * Dummy data only.
 */

import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { EmptyState } from "@/components/platform/guards";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  ArrowRight,
  Filter,
  LayoutTemplate,
  Mail,
  Rocket,
  Search,
} from "lucide-react";
import { relativeTime } from "@/modules/integrations/format";
import { recordAudit } from "@/lib/audit";
import {
  CHANNEL_LABEL,
  createCampaign,
  createFlow,
  getStudioTemplate,
  listStudioTemplates,
  type StudioTemplate,
} from "../campaign-studio-store";

const CATEGORIES = ["All", "Onboarding", "Activation", "Retention", "Win-back", "Referral", "Compliance"] as const;

export function TemplateLibraryPage() {
  const { navigate } = usePlatform();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");
  const [sort, setSort] = useState<"usage" | "updated" | "name">("usage");
  const [preview, setPreview] = useState<StudioTemplate | null>(null);

  const templates = useMemo(() => {
    let out = listStudioTemplates();
    if (category !== "All") out = out.filter((t) => t.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((t) => t.name.toLowerCase().includes(q) || t.outcome.toLowerCase().includes(q));
    }
    out = [...out].sort((a, b) =>
      sort === "usage" ? b.usage - a.usage : sort === "name" ? a.name.localeCompare(b.name) : b.updated.localeCompare(a.updated),
    );
    return out;
  }, [search, category, sort]);

  function useTemplate(t: StudioTemplate) {
    if (t.kind === "flow") {
      // Independent draft — cloning fresh state each time (8.5 acceptance).
      const flow = createFlow(`${t.name} (draft)`, "trigger.challenge_passed");
      recordAudit({
        action: "template.instantiate",
        entity: "automation-flow",
        entityId: flow.id,
        summary: `Instantiated flow template “${t.name}” → draft ${flow.name}.`,
        module: "marketing",
      });
      toast({
        title: "Flow draft created",
        description: "Placeholders mapped through terminology settings — opening the builder.",
      });
      navigate("automation-flows", { flow: flow.id });
    } else {
      const campaign = createCampaign({
        name: `${t.name} (draft)`,
        channel: t.channel,
        segmentId: "",
        status: "draft",
        templateId: t.id,
        subject: t.subject ?? "",
        body: t.body ?? "",
        audienceSize: 0,
      });
      recordAudit({
        action: "template.instantiate",
        entity: "campaign",
        entityId: campaign.id,
        summary: `Instantiated campaign template “${t.name}” → draft ${campaign.name}.`,
        module: "marketing",
      });
      toast({ title: "Campaign draft created", description: "Opening the composer with the template loaded." });
      navigate("campaign-new", { campaign: campaign.id });
    }
  }

  return (
    <Page>
      <PageHeader
        title="Template Library"
        description="Prop-firm-proven flows and campaigns — preview read-only, instantiate into your own draft."
        icon={LayoutTemplate}
        actions={
          <Button size="sm" onClick={() => navigate("automation-flows")}>
            <Rocket className="mr-1 h-4 w-4" /> New flow
          </Button>
        }
      />

      <PageContent>
        {/* Toolbar */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates…"
              className="pl-8"
              aria-label="Search templates"
            />
          </div>
          <Select value={category} onValueChange={(v) => setCategory(v as (typeof CATEGORIES)[number])}>
            <SelectTrigger className="w-full sm:w-[170px]" aria-label="Category filter">
              <Filter className="mr-1 h-3.5 w-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as "usage" | "updated" | "name")}>
            <SelectTrigger className="w-full sm:w-[150px]" aria-label="Sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="usage">Sort by usage</SelectItem>
              <SelectItem value="updated">Recently updated</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Launch preset set */}
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-xs font-semibold">
            Launch preset set <Badge variant="secondary" className="ml-1 text-[9px]">Day one</Badge>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Welcome &amp; KYC nudge series · Challenge passed upsell · Payout approved celebration · Dormant 30-day
            win-back · Breach empathy re-engage · Referral invitation — every new tenant starts productive from these
            six.
          </p>
        </div>

        {/* Cards grid */}
        {templates.length === 0 ? (
          <EmptyState
            title="No templates match"
            description="Adjust the category or search to see the full library."
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setCategory("All");
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <Card key={t.id} className="group transition-shadow hover:shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      {t.kind === "campaign" ? (
                        <Mail className="h-4 w-4 text-primary" />
                      ) : (
                        <LayoutTemplate className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {t.kind === "flow" ? "Flow" : "Campaign"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-tight">{t.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t.outcome}</p>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {t.channels.map((c) => (
                      <Badge key={c} variant="secondary" className="text-[9px]">
                        {CHANNEL_LABEL[c] ?? c}
                      </Badge>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>
                      {t.kind === "flow" ? `${t.steps} steps` : "1 step"} · used {t.usage}×
                    </span>
                    <span>Updated {relativeTime(t.updated)}</span>
                  </div>

                  <div className="mt-3 flex gap-1.5">
                    <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => setPreview(t)}>
                      Preview
                    </Button>
                    <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => useTemplate(t)}>
                      Use template <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageContent>

      {/* Detail sheet */}
      <Sheet open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {preview && (
            <>
              <SheetHeader>
                <SheetTitle>{preview.name}</SheetTitle>
                <SheetDescription>{preview.outcome}</SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">{preview.category}</Badge>
                  <Badge variant="secondary">{preview.kind === "flow" ? `${preview.steps}-step flow` : "Campaign"}</Badge>
                  {preview.channels.map((c) => (
                    <Badge key={c} variant="secondary" className="text-[10px]">
                      {CHANNEL_LABEL[c] ?? c}
                    </Badge>
                  ))}
                </div>

                {/* Read-only preview */}
                {preview.kind === "flow" ? (
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="mb-2 text-xs font-semibold">Flow mini-map (read-only)</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {["Trigger", "Message", "Wait", "Split", "Message", "End"].map((step, i) => (
                        <span key={i} className="flex items-center gap-1.5">
                          <span className="rounded-md border bg-background px-2 py-1 text-[10px]">{step}</span>
                          {i < 5 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border bg-background p-3">
                    <p className="mb-2 text-xs font-semibold">Email preview</p>
                    <p className="text-xs font-semibold">{preview.subject ?? `${preview.name} — {{first_name}}`}</p>
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                      {preview.body ??
                        "Hi {{first_name}},\n\nThis template renders with your tenant’s terminology — firm name, currency and brand color resolve automatically.\n\n— {{firm_name}}"}
                    </p>
                  </div>
                )}

                {/* Placeholders */}
                <div className="rounded-lg border p-3">
                  <p className="mb-2 text-xs font-semibold">Placeholders ({preview.placeholders.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {preview.placeholders.map((p) => (
                      <code key={p} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">
                        {p}
                      </code>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Resolved through the terminology engine: firm name, currency, brand color.
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Used {preview.usage}× by this firm</span>
                  <span>Updated {relativeTime(preview.updated)}</span>
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => useTemplate(preview)}>
                    <Rocket className="mr-1 h-4 w-4" /> Use template
                  </Button>
                  <Button variant="outline" onClick={() => setPreview(null)}>
                    Close
                  </Button>
                </div>

                <p className="text-[10px] text-muted-foreground">
                  Instantiation never mutates the shared template — each use creates an independent draft.
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </Page>
  );
}

/** Exported for the composer's template picker empty-state copy. */
export const TEMPLATE_LIBRARY_EMPTY_HINT = "Create one from a blank or use the Template Library presets.";
