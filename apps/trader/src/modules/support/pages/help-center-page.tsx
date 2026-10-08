"use client";

/**
 * Help Center — converted from stitch_screens/help_center
 * Search + article categories + popular articles.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { TerraCard, TerraPageHeader } from "@/components/terra/terra-ui";

const categories = [
  { id: "getting-started", title: "Getting Started", icon: "🚀", articles: 8 },
  { id: "challenges", title: "Challenges & Rules", icon: "📋", articles: 14 },
  { id: "payouts", title: "Payouts & Billing", icon: "💸", articles: 11 },
  { id: "platform", title: "Platforms & Trading", icon: "🖥️", articles: 9 },
  { id: "security", title: "Account & Security", icon: "🔐", articles: 7 },
  { id: "kyc", title: "KYC & Verification", icon: "🪪", articles: 6 },
];

const popular = [
  "How is the daily loss limit calculated?",
  "When is my first payout available?",
  "Which platforms can I trade on?",
  "How do I reset my trading password?",
  "Can I hold positions over the weekend?",
  "How long does KYC verification take?",
];

export function HelpCenterPage() {
  const [q, setQ] = useState("");

  const filteredPopular = useMemo(
    () => popular.filter((p) => p.toLowerCase().includes(q.toLowerCase())),
    [q],
  );

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
            className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-5 py-3 text-sm outline-none focus:border-primary"
          />
          <p className="text-xs text-on-surface-variant">
            Try “daily loss”, “payout”, “KYC”…
          </p>
        </div>
      </TerraCard>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <TerraCard key={c.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{c.icon}</span>
              <div>
                <p className="text-sm font-bold text-on-surface">{c.title}</p>
                <p className="text-xs text-on-surface-variant">{c.articles} articles</p>
              </div>
            </div>
            <span className="text-on-surface-variant">→</span>
          </TerraCard>
        ))}
      </div>

      <TerraCard>
        <h2 className="pb-3 font-headline text-lg font-bold text-on-surface">Popular articles</h2>
        <div className="space-y-2">
          {filteredPopular.map((p) => (
            <div
              key={p}
              className="flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-3 text-sm"
            >
              <span className="font-semibold text-on-surface">{p}</span>
              <span className="text-on-surface-variant">→</span>
            </div>
          ))}
          {filteredPopular.length === 0 && (
            <p className="text-sm text-on-surface-variant">
              No articles match “{q}” — try{" "}
              <Link href="/support" className="text-primary hover:underline">
                contacting support
              </Link>
              .
            </p>
          )}
        </div>
      </TerraCard>
    </div>
  );
}
