"use client";

import { useEffect, useRef, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver, plural } from "@/lib/platform/terminology";
import { getTenantAiInsights } from "@/lib/platform/mock-data";
import type { AiInsight } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
import { BarSeries } from "@/components/platform/charts";
import { Brain, Sparkles, Target, AlertTriangle, Bot, TrendingUp, Save, Send, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function aiSeverityTone(sev: string): "default" | "success" | "warning" | "danger" | "info" | "muted" {
  switch (sev) {
    case "critical": return "danger";
    case "warning": return "warning";
    case "opportunity": return "success";
    case "info": return "info";
    default: return "muted";
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function avgConfidence(insights: AiInsight[]): number {
  if (!insights.length) return 0;
  const sum = insights.reduce((s, i) => s + i.confidence, 0);
  return Math.round((sum / insights.length) * 100);
}

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

export function AiOverviewPage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const insights = getTenantAiInsights(tid)
    .slice()
    .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  const active = insights.length;
  const avg = avgConfidence(insights);
  const opportunities = insights.filter((i) => i.severity === "opportunity").length;
  const critical = insights.filter((i) => i.severity === "critical").length;
  const confidenceData = insights.map((i) => ({
    date: i.title.length > 18 ? i.title.slice(0, 16) + "…" : i.title,
    value: Math.round(i.confidence * 100),
  }));
  return (
    <Page>
      <PageHeader
        title="AI / LLM"
        description={`AI-generated insights and assistant for ${plural(term("trader")).toLowerCase()}, ${plural(term("payout")).toLowerCase()}, and risk across this tenant.`}
        icon={Brain}
      />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Active Insights" value={active} icon={Sparkles} tone="positive" />
          <MetricCard label="Avg Confidence" value={`${avg}%`} icon={Brain} />
          <MetricCard label="Opportunities" value={opportunities} icon={Target} tone="positive" />
          <MetricCard label="Critical Alerts" value={critical} icon={AlertTriangle} tone="negative" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-lg border bg-card p-4">
            <p className="mb-3 text-sm font-medium">Insights feed</p>
            <div className="flex flex-col gap-2">
              {insights.length === 0 ? (
                <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                  No AI insights yet
                </div>
              ) : (
                insights.map((i) => (
                  <div key={i.id} className="flex items-start gap-3 rounded-lg border bg-card p-3">
                    <div className="mt-0.5">
                      {i.severity === "opportunity" ? (
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                      ) : i.severity === "critical" ? (
                        <AlertTriangle className="h-4 w-4 text-rose-600" />
                      ) : i.severity === "warning" ? (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      ) : (
                        <Sparkles className="h-4 w-4 text-teal-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">{i.title}</span>
                        <StatusBadge tone={aiSeverityTone(i.severity)}>{i.severity}</StatusBadge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{i.summary}</p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>Confidence {Math.round(i.confidence * 100)}%</span>
                        <span>·</span>
                        <span>{relativeTime(i.generatedAt)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Confidence by insight</p>
            {confidenceData.length === 0 ? (
              <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                No confidence data
              </div>
            ) : (
              <BarSeries data={confidenceData} xKey="date" yKey="value" color="#0d9488" height={240} formatValue={(v) => `${v}%`} />
            )}
          </div>
        </div>
      </PageContent>
    </Page>
  );
}

export function AiInsightsPage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  // Dismissed insight ids for this session — dismissing actually removes
  // the card and updates the counts.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const insights = getTenantAiInsights(tid)
    .filter((i) => !dismissed.has(i.id))
    .slice()
    .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  return (
    <Page>
      <PageHeader title="AI Insights" description={`Full list of AI-generated insights for this ${term("trader").toLowerCase()} tenant, ranked by recency.`} icon={Sparkles} />
      <PageContent>
        {insights.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No AI insights yet
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {insights.map((i) => (
              <Card key={i.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {i.severity === "opportunity" ? (
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                      ) : i.severity === "critical" ? (
                        <AlertTriangle className="h-4 w-4 text-rose-600" />
                      ) : i.severity === "warning" ? (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      ) : (
                        <Sparkles className="h-4 w-4 text-teal-600" />
                      )}
                      <StatusBadge tone={aiSeverityTone(i.severity)}>{i.severity}</StatusBadge>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{relativeTime(i.generatedAt)}</span>
                  </div>
                  <CardTitle className="text-base mt-2">{i.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <CardDescription className="text-sm leading-relaxed">{i.summary}</CardDescription>
                  <p className="text-xs text-muted-foreground leading-relaxed">{i.detail}</p>
                  <div className="mt-auto pt-2">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Confidence</span>
                      <span className="font-medium text-foreground">{Math.round(i.confidence * 100)}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.round(i.confidence * 100)}%`, backgroundColor: "#0d9488" }}
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDismissed((prev) => new Set(prev).add(i.id));
                      toast({ title: "Insight dismissed", description: i.title });
                    }}
                  >
                    Dismiss
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </PageContent>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* AI Assistant — mock chat                                            */
/* ------------------------------------------------------------------ */

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const seedChat: ChatMessage[] = [
  {
    id: "m1",
    role: "assistant",
    content: "Hi! I'm your AI assistant. I can answer questions about traders, payouts, risk, and analytics. Try asking about payout trends or trader performance.",
  },
  {
    id: "m2",
    role: "user",
    content: "What's the payout trend for this tenant?",
  },
  {
    id: "m3",
    role: "assistant",
    content: "Payout requests are up 38% week-over-week, concentrated in funded traders. Confidence 87%. Recommend reviewing payout reserves before the next cycle.",
  },
  {
    id: "m4",
    role: "user",
    content: "Which traders are at risk of breaching?",
  },
  {
    id: "m5",
    role: "assistant",
    content: "Three funded traders are approaching their max drawdown limit. I'd flag them for a margin call or risk review. Confidence 92%.",
  },
];

// Keyword-matched demo responses so the assistant always answers in-band
// (footer already discloses demo mode). Production would call a real LLM.
const CANNED_RESPONSES: Array<{ match: RegExp; reply: string }> = [
  {
    match: /payout|withdraw/i,
    reply: "Payout requests are up 38% week-over-week, concentrated in funded traders. Average processing time is 18.5h. Recommend reviewing payout reserves before the next cycle. Confidence 87%.",
  },
  {
    match: /risk|breach|drawdown/i,
    reply: "Open breaches are concentrated in daily-drawdown rules. Three funded traders are within 5% of their max drawdown limit — I'd flag them for a risk review. Confidence 92%.",
  },
  {
    match: /trader|participant|performance|leaderboard/i,
    reply: "Top performers this month are concentrated in the 100k accounts with a 68% pass rate. Equity is trending up 12% across the book. Ask me about a specific account for a deeper drill-down. Confidence 84%.",
  },
  {
    match: /challenge|evaluation|pass rate/i,
    reply: "Phase 1 pass rate is holding at 41%, Phase 2 at 63%. Most failures occur within the first 10 trading days — consider adjusting the min trading day rule. Confidence 81%.",
  },
  {
    match: /revenue|profit|analytics/i,
    reply: "Revenue is trending up 8% versus the previous period, driven by challenge fee volume. Payout ratio remains within the healthy band. Confidence 86%.",
  },
  {
    match: /kyc|compliance|document/i,
    reply: "KYC queue has a handful of submissions pending for over 24h. Median review time is 6.2h and no high-risk flags are outstanding. Confidence 89%.",
  },
];

const FALLBACK_RESPONSE =
  "Here's what I can see: KPIs across trading, risk and payouts are within normal bands this week. Try asking about payout trends, trader performance, risk breaches, or evaluation pass rates for a deeper answer. (Demo assistant — production wires a real LLM.)";

export function AiAssistantPage() {
  const { tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const [messages, setMessages] = useState<ChatMessage[]>(seedChat);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const counter = useRef(seedChat.length);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll the transcript to the newest message.
  useEffect(() => {
    const el = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]");
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, thinking]);

  const send = () => {
    const text = input.trim();
    if (!text || thinking) return;
    counter.current += 1;
    const userMsg: ChatMessage = { id: `m-${counter.current}`, role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    // Simulate a short think-time, then answer with a keyword-matched
    // canned response so the conversation never dead-ends.
    setThinking(true);
    setTimeout(() => {
      const canned =
        CANNED_RESPONSES.find((c) => c.match.test(text))?.reply ?? FALLBACK_RESPONSE;
      counter.current += 1;
      const botMsg: ChatMessage = { id: `m-${counter.current}`, role: "assistant", content: canned };
      setMessages((m) => [...m, botMsg]);
      setThinking(false);
    }, 700);
  };

  return (
    <Page>
      <PageHeader title="AI Assistant" description={`Ask questions across ${plural(term("trader")).toLowerCase()}, ${plural(term("payout")).toLowerCase()}, risk, and analytics.`} icon={Bot} />
      <PageContent>
        <Card className="flex h-[560px] flex-col">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-400">
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-foreground">PFaaS Assistant</p>
              <p className="text-[10px] text-muted-foreground">Powered by tenant LLM · demo mode</p>
            </div>
          </div>
          <ScrollArea ref={scrollRef} className="flex-1 px-4 py-4">
            <div className="flex flex-col gap-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
                >
                  <div className="flex max-w-[80%] items-start gap-2">
                    {m.role === "assistant" ? (
                      <Avatar className="mt-0.5 h-6 w-6">
                        <AvatarFallback className="bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-400">
                          <Bot className="h-3 w-3" />
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <Avatar className="mt-0.5 h-6 w-6">
                        <AvatarFallback>
                          <User className="h-3 w-3" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={
                        m.role === "user"
                          ? "rounded-2xl rounded-tr-sm bg-teal-600 px-3 py-2 text-sm text-white"
                          : "rounded-2xl rounded-tl-sm border bg-card px-3 py-2 text-sm text-foreground"
                      }
                    >
                      {m.content}
                    </div>
                  </div>
                </div>
              ))}
              {thinking ? (
                <div className="flex justify-start">
                  <div className="flex max-w-[80%] items-start gap-2">
                    <Avatar className="mt-0.5 h-6 w-6">
                      <AvatarFallback className="bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-400">
                        <Bot className="h-3 w-3" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="rounded-2xl rounded-tl-sm border bg-card px-3 py-2 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:120ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:240ms]" />
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </ScrollArea>
          <div className="border-t p-3">
            <div className="flex items-center gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask the assistant…"
                className="flex-1"
              />
              <Button size="sm" onClick={send}>
                <Send className="h-4 w-4" />
                Send
              </Button>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Press Enter to send. Demo mode — responses are simulated.
            </p>
          </div>
        </Card>
      </PageContent>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* AI Configure — feature toggles + model selector                    */
/* ------------------------------------------------------------------ */

export function AiConfigurePage() {
  const { tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const [insights, setInsights] = useState(true);
  const [predictions, setPredictions] = useState(true);
  const [anomaly, setAnomaly] = useState(false);
  const [model, setModel] = useState("gpt-4o-mini");

  const save = () => {
    toast({
      title: "AI configuration saved",
      description: `Model: ${model} · Insights: ${insights ? "on" : "off"} · Predictions: ${predictions ? "on" : "off"} · Anomaly: ${anomaly ? "on" : "off"}`,
    });
  };

  return (
    <Page>
      <PageHeader title="AI Configuration" description={`Toggle AI features and select the model used across this ${term("trader").toLowerCase()} tenant.`} icon={Brain} />
      <PageContent>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Feature toggles</CardTitle>
              <CardDescription>Enable or disable AI capabilities for this tenant.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FeatureToggle
                label="AI Insights"
                description="Generate proactive insights across modules."
                checked={insights}
                onChange={setInsights}
              />
              <FeatureToggle
                label="Predictions"
                description="Forecast revenue, payouts, and breach risk."
                checked={predictions}
                onChange={setPredictions}
              />
              <FeatureToggle
                label="Anomaly Detection"
                description="Flag unusual trading or payout patterns."
                checked={anomaly}
                onChange={setAnomaly}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Model selection</CardTitle>
              <CardDescription>Pick the LLM powering the assistant and insight generation.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Model</label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o-mini">GPT-4o mini</SelectItem>
                    <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    <SelectItem value="claude-3-5-sonnet">Claude 3.5 Sonnet</SelectItem>
                    <SelectItem value="llama-3-1-70b">Llama 3.1 70B</SelectItem>
                    <SelectItem value="mistral-large">Mistral Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Tip</p>
                <p className="mt-1">
                  Larger models are more capable but cost more per call. Start with GPT-4o mini and escalate
                  for high-stakes anomaly detection workflows.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="flex justify-end">
          <Button onClick={save}>
            <Save className="mr-1 h-4 w-4" />
            Save configuration
          </Button>
        </div>
      </PageContent>
    </Page>
  );
}

function FeatureToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
