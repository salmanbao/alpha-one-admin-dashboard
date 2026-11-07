import { TraderView } from "@/lib/platform/view-router";

/** R3-04 — Communication History (gated to trader.self via TraderView). */
export default function CommsHistoryRoute() {
  return <TraderView viewId="comms-history" />;
}
