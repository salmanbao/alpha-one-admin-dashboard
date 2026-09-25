"use client";
import { useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/platform/status";
import { ShieldCheck, Upload, CheckCircle2, Clock, AlertTriangle, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function KycOnboardingPage() {
  const { navigate } = usePlatform();
  const [step, setStep] = useState(0);
  const steps = ["Personal Info", "Address", "Document", "Selfie", "Review"];
  const [status, setStatus] = useState<"not-started" | "in-progress" | "submitted">("not-started");

  return (
    <Page>
      <PageHeader title="KYC Verification" description="Complete your identity verification to activate your trading account." icon={ShieldCheck} />
      <PageContent>
        {/* Progress */}
        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{i < step ? "✓" : i + 1}</div>
              <span className={`text-xs ${i <= step ? "font-medium text-foreground" : "text-muted-foreground"}`}>{s}</span>
              {i < steps.length - 1 && <div className="h-px w-8 bg-border" />}
            </div>
          ))}
        </div>

        {step === 0 && <Card><CardHeader className="pb-2"><span className="text-sm font-medium">Personal information</span></CardHeader>
          <CardContent className="space-y-3">
            <div><Label className="text-xs">Full name (as on ID)</Label><Input placeholder="Tom Allen" className="mt-1" /></div>
            <div><Label className="text-xs">Date of birth</Label><Input type="date" className="mt-1" /></div>
            <div><Label className="text-xs">Country of residence</Label><select className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"><option>United States</option><option>United Kingdom</option><option>UAE</option><option>Singapore</option></select></div>
            <Button onClick={() => { setStep(1); setStatus("in-progress"); }}>Continue <ArrowRight className="ml-1 h-4 w-4" /></Button>
          </CardContent></Card>}

        {step === 1 && <Card><CardHeader className="pb-2"><span className="text-sm font-medium">Residential address</span></CardHeader>
          <CardContent className="space-y-3">
            <div><Label className="text-xs">Street address</Label><Input placeholder="123 Main St" className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">City</Label><Input placeholder="New York" className="mt-1" /></div>
              <div><Label className="text-xs">Postal code</Label><Input placeholder="10001" className="mt-1" /></div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(0)}><ArrowLeft className="mr-1 h-4 w-4" /> Back</Button>
              <Button onClick={() => setStep(2)}>Continue <ArrowRight className="ml-1 h-4 w-4" /></Button>
            </div>
          </CardContent></Card>}

        {step === 2 && <Card><CardHeader className="pb-2"><span className="text-sm font-medium">Identity document</span></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Upload a government-issued photo ID (passport, driver's license, or national ID).</p>
            <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
              <Upload className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm font-medium">Drop your document here</p>
              <p className="text-xs text-muted-foreground">or click to browse · PDF, JPG, PNG (max 10MB)</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => toast({ title: "Document uploaded", description: "passport.pdf (2.4 MB)" })}>Browse files</Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="mr-1 h-4 w-4" /> Back</Button>
              <Button onClick={() => setStep(3)}>Continue <ArrowRight className="ml-1 h-4 w-4" /></Button>
            </div>
          </CardContent></Card>}

        {step === 3 && <Card><CardHeader className="pb-2"><span className="text-sm font-medium">Selfie verification</span></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Take a selfie holding your ID document next to your face.</p>
            <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
              <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm font-medium">Enable camera and take selfie</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => toast({ title: "Selfie captured", description: "Liveness check passed." })}>Open camera</Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="mr-1 h-4 w-4" /> Back</Button>
              <Button onClick={() => setStep(4)}>Continue <ArrowRight className="ml-1 h-4 w-4" /></Button>
            </div>
          </CardContent></Card>}

        {step === 4 && <Card><CardHeader className="pb-2"><span className="text-sm font-medium">Review & submit</span></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1 text-xs">
              <p className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Name: Tom Allen</p>
              <p className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> DOB: 1990-01-15</p>
              <p className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Country: United States</p>
              <p className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Address: 123 Main St, New York</p>
              <p className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Document: passport.pdf uploaded</p>
              <p className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Selfie: captured</p>
            </div>
            <div className="rounded-md border border-amber-500/20 bg-amber-50/30 p-2 text-xs dark:bg-amber-950/10">
              <p className="font-medium">Consent</p>
              <p className="text-muted-foreground">By submitting, you consent to identity verification by our KYC provider. Your data is processed according to our privacy policy.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)}><ArrowLeft className="mr-1 h-4 w-4" /> Back</Button>
              <Button onClick={() => { setStatus("submitted"); toast({ title: "KYC submitted!", description: "Verification typically takes 5-15 minutes." }); navigate("kyc-status"); }}>Submit for verification <ArrowRight className="ml-1 h-4 w-4" /></Button>
            </div>
          </CardContent></Card>}
      </PageContent>
    </Page>
  );
}
