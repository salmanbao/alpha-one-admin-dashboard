"use client";

/**
 * N17 — Marketing Preference Center (Wave 1, P0, spec).
 * Per-topic × per-channel opt-in/out, global channel kill switches,
 * confirmation + receipt. Writes to consent store semantics (local mirror;
 * production writes to the M3 consent store the composer reads).
 * Linked from every campaign via /unsubscribe?token=...
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { TerraCard, TerraPageHeader, TerraSectionTitle } from "@/components/terra/terra-ui";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Megaphone, Mail, MessageSquare, Smartphone, ShieldCheck, Undo2 } from "lucide-react";
import {
  type MarketingChannel, type MarketingTopic, type PrefMatrix,
  TOPIC_LABEL, CHANNEL_LABEL, loadPrefs, savePrefs, defaultPrefs, addReceipt, loadReceipts,
} from "@/lib/marketing-preferences";

const TOPICS: MarketingTopic[] = ["promotions", "education", "product_news"];
const CHS: MarketingChannel[] = ["email", "sms", "whatsapp"];
const CH_ICON = { email: Mail, sms: Smartphone, whatsapp: MessageSquare } as const;

export function MarketingPreferencesPage() {
  const [prefs, setPrefs] = useState<PrefMatrix>(defaultPrefs);
  const [receipts, setReceipts] = useState(loadReceipts());
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setPrefs(loadPrefs()); setReceipts(loadReceipts()); }, []);

  function setCell(t: MarketingTopic, ch: MarketingChannel, v: boolean) {
    setPrefs(p => ({ ...p, [t]: { ...p[t], [ch]: v } })); setDirty(true);
  }
  function killChannel(ch: MarketingChannel, off: boolean) {
    setPrefs(p => {
      const n = { ...p } as PrefMatrix;
      TOPICS.forEach(t => { n[t] = { ...n[t], [ch]: !off }; });
      return n;
    }); setDirty(true);
  }
  function save() {
    savePrefs(prefs);
    const rec = addReceipt("preferences_saved", "Updated marketing topic/channel preferences.");
    setReceipts(r => [rec, ...r]);
    setDirty(false);
    toast({ title: "Preferences saved", description: "Your marketing choices were updated and recorded (receipt issued)." });
  }
  function resetAll() {
    const d = defaultPrefs();
    setPrefs(d); savePrefs(d);
    const rec = addReceipt("preferences_reset", "Reset to default marketing preferences.");
    setReceipts(r => [rec, ...r]); setDirty(false);
    toast({ title: "Reset to defaults" });
  }
  function unsubAll() {
    const off: PrefMatrix = { promotions:{email:false,sms:false,whatsapp:false}, education:{email:false,sms:false,whatsapp:false}, product_news:{email:false,sms:false,whatsapp:false} };
    setPrefs(off); savePrefs(off);
    const rec = addReceipt("unsubscribe_all", "Unsubscribed from all marketing topics and channels.");
    setReceipts(r => [rec, ...r]); setDirty(false);
    toast({ title: "Unsubscribed from all marketing", description: "You won’t receive marketing messages. Transactional/security alerts are unaffected." });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <TerraPageHeader
        title="Marketing Preference Center"
        description="Choose what marketing you receive and where. Transactional and security messages are never affected."
        
        actions={<div className="flex gap-2"><Button variant="outline" size="sm" onClick={resetAll}><Undo2 className="mr-1 h-4 w-4" />Reset defaults</Button><Button size="sm" onClick={save} disabled={!dirty}>Save preferences</Button></div>}
      />

      <TerraCard className="p-4 space-y-3">
        <div className="flex items-center justify-between"><TerraSectionTitle title="Global channel controls" /><Button variant="ghost" size="sm" className="text-destructive" onClick={unsubAll}>Unsubscribe from all marketing</Button></div>
        <p className="text-xs text-muted-foreground">Turn a channel off everywhere. This is the same effect as the one-click unsubscribe link in our emails.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {CHS.map(ch => {
            const Icon = CH_ICON[ch];
            const anyOn = TOPICS.some(t => prefs[t][ch]);
            return (
              <label key={ch} className="flex items-center justify-between rounded-lg border p-3">
                <span className="flex items-center gap-2 text-sm"><Icon className="h-4 w-4" />{CHANNEL_LABEL[ch]}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">{anyOn ? "on" : "off"}<Switch checked={anyOn} onCheckedChange={v => killChannel(ch, !v)} aria-label={`Enable ${CHANNEL_LABEL[ch]} marketing`} /></span>
              </label>
            );
          })}
        </div>
      </TerraCard>

      <TerraCard className="p-4">
        <TerraSectionTitle title="Topics × channels" />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="pb-2 font-medium">Topic</th>{CHS.map(ch => <th key={ch} className="pb-2 text-center font-medium">{CHANNEL_LABEL[ch]}</th>)}</tr></thead>
            <tbody>
              {TOPICS.map(t => (
                <tr key={t} className="border-t">
                  <td className="py-3 pr-3"><span className="font-medium">{TOPIC_LABEL[t]}</span></td>
                  {CHS.map(ch => (
                    <td key={ch} className="py-3 text-center"><Switch checked={prefs[t][ch]} onCheckedChange={v => setCell(t, ch, v)} aria-label={`${TOPIC_LABEL[t]} via ${CHANNEL_LABEL[ch]}`} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 flex items-start gap-2 rounded-md bg-muted/40 p-2 text-[11px] text-muted-foreground"><ShieldCheck className="mt-0.5 h-3.5 w-3.5" />We record your consent choices with a timestamp and source (CAN-SPAM/GDPR). Changing preferences takes effect immediately and syncs to our sending systems.</p>
      </TerraCard>

      <TerraCard className="p-4 space-y-2">
        <TerraSectionTitle title="Confirmation & receipts" />
        {receipts.length === 0 ? <p className="text-xs text-muted-foreground">No changes yet.</p> : (
          <ul className="space-y-1">{receipts.slice(0,5).map(r => (
            <li key={r.id} className="flex items-center justify-between rounded border px-2 py-1.5 text-xs"><span>{r.detail}</span><span className="text-muted-foreground">{new Date(r.ts).toLocaleString()}</span></li>
          ))}</ul>
        )}
      </TerraCard>

      <p className="text-center text-[11px] text-muted-foreground">Need the no-login link? Every marketing email includes a <Link href="/unsubscribe?token=demo" className="underline">one-click unsubscribe</Link>.</p>
    </div>
  );
}
