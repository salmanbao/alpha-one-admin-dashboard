"use client";

/**
 * PFaaS — Stitch ↔ legacy view gate.
 *
 * The stitch redesigns in `src/modules/stitch/pages` are authored for the
 * **prop-admin** dashboard (PROP_ADMIN_DESIGN_SPEC.md). Super-admin and trader
 * dashboards must keep their existing rendering, so every converted view is
 * wrapped: prop-admin operators get the stitch page, every other application
 * falls back to the component that was registered before the conversion.
 */

import * as React from "react";
import { usePlatform } from "@/lib/platform/platform-context";

type ReqProps = { params: Record<string, string> };

/**
 * Prop-admin sees `Stitch`; every other application (super-admin, trader)
 * keeps `Legacy` — protecting the other two dashboards from redesign drift.
 */
export function withPropAdminStitch(
  Stitch: React.ComponentType<ReqProps>,
  Legacy: React.ComponentType<ReqProps>
): React.ComponentType<ReqProps> {
  function GatedView(props: ReqProps) {
    const { runtime } = usePlatform();
    if (runtime.application === "prop-admin") {
      return <Stitch {...props} />;
    }
    return <Legacy {...props} />;
  }
  GatedView.displayName = "StitchGatedView";
  return GatedView;
}
