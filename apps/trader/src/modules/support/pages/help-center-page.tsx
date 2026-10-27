"use client";

/**
 * Help Center — converted from stitch_screens/help_center
 * Search + article categories (click to filter) + expandable article
 * answers from the knowledge-base fixture (PRD §3.9).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@pfaas/ui";
import { TerraBadge, TerraCard, TerraPageHeader } from "@/components/terra/terra-ui";
import { helpArticles } from "@/lib/fixtures/terra-fixtures";

const categories = [
  { id: "getting-started", title: "Getting Started", icon: "🚀", articles: 8 },
  { id: "challenges", title: "Challenges & Rules", icon: "📋", articles: 14 },
  { id: "payouts", title: "Payouts & Billing", icon: "💸", articles: 11 },
  { id: "platform", title: "Platforms & Trading", icon: "🖥️", articles: 9 },
  { id: "security", title: "Account & Security", icon: "🔐", articles: 7 },
  { id: "kyc", title: "KYC & Verification", icon: "🪪", articles: 6 },
];

export function HelpCenterPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return helpArticles.filter(
      (a) =>
        (!cat || a.category === cat) &&
        (!query ||
          a.title.toLowerCase().includes(query) ||
          a.answer.toLowerCase().includes(query)),
    );
  }, [q, cat]);

  const activeCat = categories.find((c) => c.id === cat);

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Help Center"
        description="Answers to the most common questions"
      />

      <TerraCard className="py-8">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
          <span className="text-3xl">🔎</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search articles…"
            aria-label="Search articles"
            className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-5 py-3 text-sm outline-none focus:border-primary"
          />
          <p className="text-xs text-on-surface-variant">
            Try “daily loss”, “payout”, “KYC”…
          </p>
        </div>
      </TerraCard>

      {/* Category filter cards — click to filter, click again to clear */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => {
          const isActive = cat === c.id;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                setCat(isActive ? null : c.id);
                setOpenId(null);
              }}
              className={cn(
                "flex items-center justify-between rounded-xl p-4 text-left shadow-sm transition-colors",
                isActive
                  ? "bg-primary-fixed/50 ring-2 ring-primary"
                  : "bg-surface-container-lowest hover:bg-surface-container-low",
              )}
            >
              <span className="flex items-center gap-3">
                <span className="text-2xl">{c.icon}</span>
                <span>
                  <span className="block text-sm font-bold text-on-surface">
                    {c.title}
                  </span>
                  <span className="block text-xs text-on-surface-variant">
                    {c.articles} articles
                  </span>
                </span>
              </span>
              <span
                className={cn(
                  "text-sm",
                  isActive ? "font-bold text-primary" : "text-on-surface-variant",
                )}
              >
                {isActive ? "✓" : "→"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Article list — filtered by category + search, answers expand */}
      <TerraCard>
        <div className="flex items-center justify-between pb-3">
          <h2 className="font-headline text-lg font-bold text-on-surface">
            {activeCat ? `${activeCat.title} articles` : "Popular articles"}
          </h2>
          {cat && (
            <button
              type="button"
              onClick={() => {
                setCat(null);
                setOpenId(null);
              }}
              className="text-xs font-bold text-primary hover:text-on-primary-fixed-variant"
            >
              Clear filter
            </button>
          )}
        </div>
        <div className="space-y-2">
          {filtered.map((a) => {
            const isOpen = openId === a.id;
            return (
              <div
                key={a.id}
                className="overflow-hidden rounded-xl bg-surface-container-low"
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenId(isOpen ? null : a.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-on-surface">
                      {a.title}
                    </span>
                    {a.popular && (
                      <TerraBadge tone="tertiary">Popular</TerraBadge>
                    )}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "shrink-0 text-on-surface-variant transition-transform",
                      isOpen && "rotate-90",
                    )}
                  >
                    ▸
                  </span>
                </button>
                {isOpen && (
                  <p className="border-t border-outline-variant/40 px-4 py-3 text-sm leading-relaxed text-on-surface-variant">
                    {a.answer}
                  </p>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-on-surface-variant">
              No articles match {q ? `“${q}”` : "this category"} — try{" "}
              <Link href="/support" className="text-primary hover:underline">
                contacting support
              </Link>
              .
            </p>
          )}
        </div>
        <p className="mt-3 text-[11px] text-on-surface-variant">
          Showing {filtered.length} of {helpArticles.length} articles
          {activeCat ? ` in ${activeCat.title}` : ""}.
        </p>
      </TerraCard>
    </div>
  );
}
