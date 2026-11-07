"use client";
/** N18 — Loyalty Ledger & Tiers (Wave 3/P2). Points ledger, tier progression, earning rules, perks, redeem to promo wallet. */
import { TerraCard, TerraPageHeader, TerraSectionTitle } from "@/components/terra/terra-ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { Award, ArrowUpRight } from "lucide-react";
import Link from "next/link";

const ledger = [
  {id:"l1",ts:"2026-11-05",type:"earned",desc:"Challenge purchase",pts:500,balance:2450},
  {id:"l2",ts:"2026-11-02",type:"earned",desc:"Referral funded",pts:800,balance:1950},
  {id:"l3",ts:"2026-10-28",type:"spent",desc:"Redeemed $25 coupon",pts:-250,balance:1150},
  {id:"l4",ts:"2026-10-10",type:"expired",desc:"Promo points expired",pts:-100,balance:1400},
];
export function LoyaltyPage() {
  const pts = 2450; const tier="Silver"; const next=3000; const pct=Math.round((pts/next)*100);
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <TerraPageHeader title="Loyalty & Tiers" description="Earn points, progress tiers, and redeem perks into your promo wallet." actions={<Button variant="outline" size="sm" asChild><Link href="/promos">Open Promo Wallet</Link></Button>} />
      <TerraCard className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs text-muted-foreground">Balance</p><p className="text-2xl font-semibold">{pts.toLocaleString()} pts</p><Badge variant="secondary" className="mt-1">{tier} tier</Badge></div>
          <div className="w-full max-w-xs"><p className="text-xs text-muted-foreground mb-1">Progress to Gold ({next.toLocaleString()} pts)</p><Progress value={pct} /><p className="text-[11px] text-muted-foreground mt-1">{next-pts} pts to next tier</p></div>
        </div>
      </TerraCard>
      <div className="grid gap-4 lg:grid-cols-2">
        <TerraCard className="p-4"><TerraSectionTitle title="Points ledger" /><ul className="mt-2 space-y-1">{ledger.map(l=><li key={l.id} className="flex items-center justify-between rounded border px-2 py-1.5 text-xs"><span><span className="font-medium">{l.desc}</span><span className="block text-muted-foreground">{l.ts} · {l.type}</span></span><span className={l.pts>=0?"text-emerald-600 font-semibold":"text-muted-foreground"}>{l.pts>=0?"+":""}{l.pts} <span className="block text-[10px] text-muted-foreground text-right">bal {l.balance}</span></span></li>)}</ul></TerraCard>
        <TerraCard className="p-4 space-y-3"><TerraSectionTitle title="Tier perks & rules" />
          <div className="text-xs space-y-1"><p><strong>Bronze</strong>: base earn 1×</p><p><strong>Silver</strong> (you): 1.25× earn, priority support</p><p><strong>Gold</strong>: 1.5× earn, exclusive coupons, faster payouts review</p></div>
          <div className="rounded border p-2 text-[11px] text-muted-foreground">Earning rules: 1 pt/$ on challenge purchases, 500 pts on KYC, 800 pts per funded referral. Points expire after 12 months of inactivity.</div>
          <Button size="sm" onClick={()=>toast({title:"Redeem",description:"250 pts redeemed for a $25 coupon (added to Promo Wallet)."})}><ArrowUpRight className="mr-1 h-4 w-4" />Redeem 250 pts → $25 coupon</Button>
        </TerraCard>
      </div>
    </div>
  );
}
