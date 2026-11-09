/**
 * Integrations catalog seed (R2-W3-04).
 *
 * The seeded platform integration list, extracted from the Integrations
 * page so the go-live wizard's "Connectors" step (step ④) and that page
 * mutate the SAME catalog through `integrations-store` overrides —
 * connecting a connector in the wizard shows up as Connected on the
 * page and vice versa.
 *
 * The seed stays code; operator changes live in `integrations-store`
 * (`pfaas:platform-admin:integrations`) and are merged on read.
 */

export interface SeedIntegration {
  id: string;
  name: string;
  category: string;
  description: string;
  status: "connected" | "disconnected" | "error";
  config: Record<string, string>;
  lastSync: string;
  health: string;
}

export const SEED_INTEGRATIONS: SeedIntegration[] = [
  { id: "int-001", name: "Stripe", category: "payment", description: "Payment processing for subscriptions and one-time charges", status: "connected", config: { publishableKey: "pk_live_51H8x…", webhookSigning: "Enabled", currencies: "USD, EUR, GBP" }, lastSync: "2026-10-08T14:00:00Z", health: "healthy" },
  { id: "int-002", name: "PayPal", category: "payment", description: "Alternative payment gateway for global customers", status: "connected", config: { clientId: "AeR8x…", sandbox: "Disabled", webhooks: "Enabled" }, lastSync: "2026-10-08T12:30:00Z", health: "healthy" },
  { id: "int-003", name: "Wise", category: "payment", description: "Multi-currency payouts and transfers", status: "disconnected", config: {}, lastSync: "2026-09-15T10:00:00Z", health: "unknown" },
  { id: "int-004", name: "SendGrid", category: "email", description: "Transactional email delivery", status: "connected", config: { apiKey: "SG.xK9p…", domain: "mail.pfaas.com", dailyLimit: "100,000" }, lastSync: "2026-10-08T14:30:00Z", health: "healthy" },
  { id: "int-006", name: "Persona", category: "kyc", description: "KYC/AML identity verification", status: "connected", config: { environment: "production", webhookUrl: "https://api.pfaas.com/kyc/webhook", autoApprove: "Low risk only" }, lastSync: "2026-10-08T13:45:00Z", health: "healthy" },
  { id: "int-007", name: "Sumsub", category: "kyc", description: "Alternative KYC provider with document review", status: "error", config: { appId: "app_pfaas_01", level: "standard" }, lastSync: "2026-10-07T15:20:00Z", health: "degraded" },
  { id: "int-008", name: "HubSpot", category: "crm", description: "CRM sync for leads and customer data", status: "connected", config: { portalId: "23456789", syncInterval: "15 minutes", objects: "Contacts, Deals" }, lastSync: "2026-10-08T14:15:00Z", health: "healthy" },
  { id: "int-010", name: "Slack", category: "notifications", description: "Team notifications for alerts and incidents", status: "connected", config: { workspace: "PFAAS Team", channels: "#alerts, #billing, #ops" }, lastSync: "2026-10-08T14:30:00Z", health: "healthy" },
];
