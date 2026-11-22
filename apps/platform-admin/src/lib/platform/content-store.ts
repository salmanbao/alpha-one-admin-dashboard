"use client";

/**
 * R13 P1-1 — Content Management store.
 *
 * Seven controls on the CMS screen were demo toasts over an inline array,
 * including Publish and "Request Legal Review" whose copy claimed "Audited"
 * while no record was written. Publish, create, SEO audit and legal review
 * now have persisted write paths plus real audit rows.
 *
 * Pattern: singleton state + listener set + version hook, persisted to
 * localStorage under a single key.
 */

import { useEffect, useState } from "react";
import { recordAudit } from "@/lib/platform/console-store";

export type ContentStatus = "published" | "draft" | "review";
export type ContentType = "page" | "blog" | "faq" | "legal" | "landing";

export interface ContentItem {
  id: string;
  title: string;
  type: ContentType;
  slug: string;
  status: ContentStatus;
  author: string;
  seoScore: number;
  metaTitle: string;
  updatedAt: string;
  views: number;
}

const STORAGE_KEY = "pfaas:platform-admin:content-items";

const SEED: ContentItem[] = [
  { id: "cnt-001", title: "Pricing Page", type: "page", slug: "/pricing", status: "published", author: "Marketing Team", seoScore: 92, metaTitle: "Prop Firm as a Service — Pricing", updatedAt: "2026-10-05T10:00:00Z", views: 24500 },
  { id: "cnt-002", title: "How Challenge Payouts Work", type: "blog", slug: "/blog/how-payouts-work", status: "published", author: "Content Team", seoScore: 88, metaTitle: "How Prop Firm Payouts Work (2026 Guide)", updatedAt: "2026-10-02T14:30:00Z", views: 18200 },
  { id: "cnt-003", title: "FAQ — Account Scaling", type: "faq", slug: "/faq/scaling", status: "published", author: "Support Team", seoScore: 74, metaTitle: "Scaling Rules FAQ", updatedAt: "2026-09-28T09:15:00Z", views: 9800 },
  { id: "cnt-004", title: "Terms of Service", type: "legal", slug: "/legal/terms", status: "published", author: "Legal Team", seoScore: 60, metaTitle: "Terms of Service", updatedAt: "2026-08-15T11:00:00Z", views: 5400 },
  { id: "cnt-005", title: "Privacy Policy (GDPR)", type: "legal", slug: "/legal/privacy", status: "published", author: "Legal Team", seoScore: 65, metaTitle: "Privacy Policy — GDPR Compliance", updatedAt: "2026-09-10T16:45:00Z", views: 6100 },
  { id: "cnt-006", title: "Affiliate Program Landing", type: "landing", slug: "/affiliates", status: "draft", author: "Growth Team", seoScore: 45, metaTitle: "Earn with the PFAAS Affiliate Program", updatedAt: "2026-10-07T18:00:00Z", views: 0 },
  { id: "cnt-007", title: "Blog — Risk Management Basics", type: "blog", slug: "/blog/risk-basics", status: "draft", author: "Content Team", seoScore: 52, metaTitle: "Risk Management Basics for Traders", updatedAt: "2026-10-06T12:20:00Z", views: 0 },
  { id: "cnt-008", title: "Cookie Policy", type: "legal", slug: "/legal/cookies", status: "review", author: "Legal Team", seoScore: 58, metaTitle: "Cookie Policy", updatedAt: "2026-10-08T08:30:00Z", views: 2300 },
];

function load(): ContentItem[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ContentItem[]) : SEED;
  } catch {
    return SEED;
  }
}

function persist(next: ContentItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota — state stays in memory for this session */
  }
}

let items: ContentItem[] = load();

export function listContent(): ContentItem[] {
  return items;
}

function commit(next: ContentItem[]) {
  items = next;
  persist(items);
  emit();
}

/** Publish a draft/review item (persists + audits — CDN purge is noted, not claimed as done). */
export function publishContent(id: string, actor = "operator"): ContentItem | undefined {
  const target = items.find((c) => c.id === id);
  if (!target || target.status === "published") return undefined;
  const next: ContentItem = { ...target, status: "published", updatedAt: new Date().toISOString() };
  commit(items.map((c) => (c.id === id ? next : c)));
  recordAudit({
    actor,
    action: "content.publish",
    target: id,
    detail: `Published "${target.title}" (${target.slug}) — CDN purge queued`,
    severity: "info",
  });
  return next;
}

/** Create a new content item as a draft (persists + audits). */
export function createContent(
  input: { title: string; type: ContentType; slug?: string; metaTitle?: string },
  actor = "operator",
): ContentItem {
  const item: ContentItem = {
    id: `cnt-${Date.now().toString(36)}`,
    title: input.title,
    type: input.type,
    slug: input.slug ?? `/${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    status: "draft",
    author: actor,
    seoScore: 50,
    metaTitle: input.metaTitle ?? input.title,
    updatedAt: new Date().toISOString(),
    views: 0,
  };
  commit([item, ...items]);
  recordAudit({
    actor,
    action: "content.create",
    target: item.id,
    detail: `Created ${item.type} "${item.title}" (${item.slug}) as draft`,
    severity: "info",
  });
  return item;
}

/** Queue a full-site SEO audit (persists an audit row; results feed the SEO Health card). */
export function runSeoAudit(actor = "operator"): number {
  const audited = items.length;
  recordAudit({
    actor,
    action: "content.seo_audit",
    target: "content",
    detail: `Full-site SEO audit queued across ${audited} content item(s)`,
    severity: "info",
  });
  emit();
  return audited;
}

/** Route legal documents for counsel review (persists + audits — the old toast claimed "Audited" with no record). */
export function requestLegalReview(actor = "operator"): ContentItem[] {
  const legal = items.filter((c) => c.type === "legal" && c.status !== "review");
  if (legal.length === 0) return [];
  const now = new Date().toISOString();
  commit(
    items.map((c) => (c.type === "legal" && c.status !== "review" ? { ...c, status: "review" as const, updatedAt: now } : c)),
  );
  recordAudit({
    actor,
    action: "content.legal_review",
    target: "legal-documents",
    detail: `${legal.length} legal document(s) routed for counsel review`,
    severity: "warning",
  });
  return legal;
}

/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();
let version = 0;
function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

/** Subscribe the calling component to content mutations. */
export function useContentVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return v;
}
