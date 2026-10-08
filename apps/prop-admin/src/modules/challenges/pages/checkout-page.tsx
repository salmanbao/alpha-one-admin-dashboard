"use client";

import { useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/components/platform/status";
import { ShoppingCart, ShieldCheck, ArrowRight, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function CheckoutPage() {
  const { runtime, navigate } = usePlatform();
  const currency = runtime.tenant?.currency ?? "USD";
  const [method, setMethod] = useState("card");
  const [promo, setPromo] = useState("");
  const challenge = { name: "2-Step Standard", accountSize: 100000, price: 990 };
  const discount = promo.toUpperCase() === "WELCOME10" ? Math.round(challenge.price * 0.1) : 0;
  const tax = Math.round((challenge.price - discount) * 0.05);
  const total = challenge.price - discount + tax;

  return (
    <Page>
      <PageHeader title="Checkout" description="Review your order and complete your purchase." icon={ShoppingCart} />
      <PageContent>
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-4">
            {/* Order summary */}
            <Card>
              <CardHeader className="pb-2"><span className="text-sm font-medium">Order summary</span></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Challenge</span><span className="font-medium">{challenge.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Account size</span><span className="font-medium">{formatCurrency(challenge.accountSize, currency)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span className="font-medium">{formatCurrency(challenge.price, currency)}</span></div>
                {discount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount (WELCOME10)</span><span>-{formatCurrency(discount, currency)}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Taxes & fees</span><span className="font-medium">{formatCurrency(tax, currency)}</span></div>
                <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span>{formatCurrency(total, currency)}</span></div>
              </CardContent>
            </Card>

            {/* Payment method */}
            <Card>
              <CardHeader className="pb-2"><span className="text-sm font-medium">Payment method</span></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {[{id:"card",label:"Credit Card"},{id:"crypto",label:"Crypto (USDT)"},{id:"paypal",label:"PayPal"},{id:"skrill",label:"Skrill"}].map((m) => (
                    <button key={m.id} onClick={() => setMethod(m.id)} className={`flex items-center gap-2 rounded-md border p-3 text-sm transition ${method === m.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}>
                      {method === m.id && <Check className="h-3 w-3 text-emerald-500" />}{m.label}
                    </button>
                  ))}
                </div>
                {method === "card" && <div className="space-y-2">
                  <div><Label className="text-xs">Card number</Label><Input placeholder="4242 4242 4242 4242" className="text-sm" /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Expiry</Label><Input placeholder="12/28" className="text-sm" /></div>
                    <div><Label className="text-xs">CVC</Label><Input placeholder="123" className="text-sm" /></div>
                  </div>
                </div>}
              </CardContent>
            </Card>

            {/* Promo code */}
            <Card>
              <CardContent className="flex items-center gap-2 p-3">
                <Input placeholder="Promo code (try WELCOME10)" value={promo} onChange={(e) => setPromo(e.target.value)} className="text-sm" />
                <Button size="sm" variant="outline" onClick={() => toast({ title: discount > 0 ? "Promo applied!" : "Invalid code", description: discount > 0 ? `10% discount applied` : "Try WELCOME10" })}>Apply</Button>
              </CardContent>
            </Card>
          </div>

          {/* Trust + CTA */}
          <div className="space-y-4">
            <Card className="border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/10">
              <CardContent className="space-y-2 p-4">
                <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400"><ShieldCheck className="h-4 w-4" /> Secure payment</p>
                <p className="text-xs text-muted-foreground">Your payment is processed via encrypted connection. We never store your card details.</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>· Challenge terms accepted at checkout</p>
                  <p>· Refund available before account activation</p>
                  <p>· 30-day evaluation period starts on first trade</p>
                </div>
              </CardContent>
            </Card>
            <Button size="lg" className="w-full" onClick={() => { toast({ title: "Payment processing…", description: "Redirecting to payment provider (demo)." }); setTimeout(() => navigate("purchase-completed"), 1500); }}>
              Pay {formatCurrency(total, currency)} & Start Challenge <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
