/**
 * Audit version subscription — platform-admin side.
 *
 * The shared `packages/ui` audit components (`EntityAuditTimeline`)
 * import `@/lib/audit` from whichever app compiles them, so every app
 * must provide `useAuditVersion`. In prop-admin / trader this file also
 * hosts the session-audit chokepoint (`recordAudit` → `getSessionAudit`);
 * platform-admin's real audit pipeline is `console-store.recordAudit`,
 * which is a separate reactive store — so this file only supplies the
 * subscription contract and currently never bumps.
 */
import { useState } from "react";

export function useAuditVersion(): number {
  const [v] = useState(0);
  return v;
}
