import { TraderView } from "@/lib/platform/view-router";

/** R9 W1 UC-T7 — Outage Claim (gated to trader.self via TraderView). */
export default function OutageClaimRoute() {
  return <TraderView viewId="outage-claim" />;
}
