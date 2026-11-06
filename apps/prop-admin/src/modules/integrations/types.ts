/**
 * M1 — Connector Registry types (spec §5).
 *
 * Each connector is a data record: category, authentication kind, a
 * config schema that drives dynamic forms, and health/sync telemetry.
 * Adding a platform becomes data plus an adapter — never a page edit.
 */

import type { ComponentType } from "react";

/* ------------------------------------------------------------------ */
/* Catalog vocabulary                                                  */
/* ------------------------------------------------------------------ */

export const CONNECTOR_CATEGORIES = [
  "Email",
  "Ads",
  "Analytics",
  "Community",
  "Automation",
  "CRM",
  "Custom",
] as const;

export type ConnectorCategory = (typeof CONNECTOR_CATEGORIES)[number];

export type AuthKind = "api_key" | "oauth2" | "webhook" | "custom_rest";

export const AUTH_KIND_LABEL: Record<AuthKind, string> = {
  api_key: "API Key",
  oauth2: "OAuth 2.0",
  webhook: "Webhook",
  custom_rest: "Custom REST",
};

export type ConnectorStatus =
  | "connected"
  | "degraded"
  | "error"
  | "disconnected";

export const CONNECTOR_STATUS_LABEL: Record<ConnectorStatus, string> = {
  connected: "Connected",
  degraded: "Degraded",
  error: "Error",
  disconnected: "Disconnected",
};

/** Status → StatusBadge tone. */
export function connectorStatusTone(
  status: ConnectorStatus,
): "success" | "warning" | "danger" | "muted" {
  switch (status) {
    case "connected":
      return "success";
    case "degraded":
      return "warning";
    case "error":
      return "danger";
    default:
      return "muted";
  }
}

/* ------------------------------------------------------------------ */
/* Config schema (drives dynamic forms in the drawer + wizard)         */
/* ------------------------------------------------------------------ */

export type ConfigFieldType = "text" | "secret" | "select" | "number" | "url";

export interface ConfigFieldOption {
  value: string;
  label: string;
}

export interface ConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  required?: boolean;
  placeholder?: string;
  /** Inline help rendered via LabelWithHelp. */
  help?: string;
  options?: ConfigFieldOption[];
  /** Secret values are masked with an eye toggle and never rendered in lists. */
  secret?: boolean;
  /**
   * Value must parse as JSON (credential blobs like
   * `{"private_key": "..."}`) — Save blocks with an inline field error.
   */
  json?: boolean;
  /** Number constraints (sync frequency, timeouts). */
  min?: number;
  max?: number;
}

/* ------------------------------------------------------------------ */
/* Connector definition (catalog entry)                                */
/* ------------------------------------------------------------------ */

export type ConnectorOrigin = "built-in" | "community";

export interface ConnectorDefinition {
  /** Stable id used by records, imports and deep links. */
  id: string;
  name: string;
  description: string;
  category: ConnectorCategory;
  authKind: AuthKind;
  origin: ConnectorOrigin;
  icon: ComponentType<{ className?: string }>;
  docsUrl?: string;
  /** Required scopes shown in the wizard help panel for OAuth kinds. */
  scopes?: string[];
  /** JSON example shown in the "API key format" collapsible. */
  secretExample?: string;
  /** Field definitions rendered as the dynamic credential form. */
  fields: ConfigField[];
  /**
   * Community tiles with no built-in adapter (Listmonk, Mautic, phpList,
   * n8n) deep-link to the Custom Connector Builder (spec 5.5).
   */
  customBuilder?: boolean;
}

/* ------------------------------------------------------------------ */
/* Connector record (configured instance in the hub)                   */
/* ------------------------------------------------------------------ */

export type HealthState = "ok" | "warn" | "fail" | "idle";

export interface ConnectorRecord {
  id: string;
  definitionId: string;
  status: ConnectorStatus;
  /** Active switch (optimistic toggles from the hub table). */
  active: boolean;
  /** Event logging switch. */
  eventLogging: boolean;
  /** Config values — secrets are dummy values, masked for display. */
  config: Record<string, string>;
  connectedAt?: string;
  lastSync?: string;
  nextSync?: string;
  /** Last provider failure message (health-dot tooltip). */
  lastError?: string;
  lastErrorAt?: string;
  events24h: number;
  eventsPrev24h: number;
  health: HealthState;
  latencyMs?: number;
  /** Account / workspace label returned by the provider test call. */
  accountLabel?: string;
  /** Sync cadence chosen in the drawer: 15m | hourly | daily. */
  syncFrequency?: "15m" | "hourly" | "daily";
  /** Default audience sync target (ESP connectors only). */
  audienceTarget?: string;
}

/** Row-level filter vocabulary for the hub toolbar. */
export type HubStatusFilter = "all" | ConnectorStatus;

/** Preset saved views on the views bar (spec 5.1). */
export type HubPreset = "all" | "attention" | "connected" | "custom";
