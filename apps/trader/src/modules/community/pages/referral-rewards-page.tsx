"use client";
/** N19 — Referral Reward Payout Tracker (Wave 3/P2). Reward lifecycle: earned→pending KYC→payable→paid, tied to payouts compliance. */
import { TerraCard, TerraPageHeader, TerraSectionTitle } from "@/components/terra/terra-ui";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Gift, CheckCircle2 } from "lucide-react";

const rewards = [
  {id:"rw1",friend:"an***@mail.com",amount:50,currency:"USD",status:"paid",stage:"paid",conditions:["KYC passed","Traded 1 lot"],payoutId:"po-8821"},
  {id:"rw2",friend:"rk***@proton.me",amount:50,currency:"USD",status:"payable",stage:"payable",conditions:["KYC passed","Traded 1 lot"],payoutId:null},
  {id:"rw3",friend:"ps***@gmail.com",amount:50,currency:"USD",status:"pending",stage:"pending_kyc",conditions:["KYC pending","Traded 0/1 lot"],payoutId:null},
  {id:"rw4",friend:"dv***@outlook.com",amount:50,currency:"USD",status:"earned",stage:"earned",conditions:["Signed up","KYC not started"],payoutId:null},
];
const tone = (s:string):"success"|"warning"|"info"|"muted" => s==="paid"?"success":s==="payable"?"info":s==="pending"?"warning":"muted";
export function ReferralRewardsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <TerraPageHeader title="Referral Reward Payouts" description="Track rewards from earned to paid — follows the same compliance path as profit payouts." />
      <TerraCard className="p-4"><TerraSectionTitle title="Reward status" />
        <ul className="mt-2 space-y-2">{rewards.map(r=>(
          <li key={r.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium text-sm">{r.friend} <span className="text-muted-foreground">· ${r.amount} {r.currency}</span></p><p className="text-[11px] text-muted-foreground">Conditions: {r.conditions.join(" · ")}{r.payoutId?` · Payout ${r.payoutId}`:""}</p></div><StatusBadge tone={tone(r.status)}>{r.stage.replace("_"," ")}</StatusBadge></div>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">{["earned","pending_kyc","payable","paid"].map((s,i)=><span key={s} className={`rounded px-1.5 py-0.5 ${["earned","pending","payable","paid"].indexOf(r.status)>=i?"bg-primary/15 text-primary":"bg-muted"}`}>{s.replace("_"," ")}</span>).reduce((a,b,i)=>i?[...a,<span key={i+"s"}>→</span>,b]:[b],[] as any)}</div>
            {r.status==="payable"&&<Button size="sm" className="mt-2 h-7 text-xs" onClick={()=>toast({title:"Payout triggered",description:`$${r.amount} reward queued via payouts (compliance checks applied).`})}><Gift className="mr-1 h-3 w-3" />Trigger payout</Button>}
            {r.status==="paid"&&<p className="mt-2 text-xs text-emerald-700 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Paid out (linked to {r.payoutId})</p>}
          </li>
        ))}</ul>
      </TerraCard>
    </div>
  );
}
