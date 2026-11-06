/**
 * M1 — Connector catalog (spec §5).
 *
 * The data-driven registry that replaces the hard-coded `PLATFORMS`
 * array. Every entry describes category, auth kind, a config schema
 * (driving dynamic forms), docs/scopes and health expectations.
 * Commercial ESPs, ad platforms and self-hosted open-source tools
 * (Listmonk, Mautic, phpList, n8n) are all first-class citizens.
 */

import {
  Activity,
  BarChart3,
  Code2,
  Mail,
  Plug,
  Send,
  Target,
  Webhook,
  Workflow,
  Zap,
} from "lucide-react";
import type { ConnectorDefinition } from "./types";

export const CONNECTOR_DEFINITIONS: ConnectorDefinition[] = [
  /* ───────── Email ───────── */
  {
    id: "klaviyo",
    name: "Klaviyo",
    description: "Sync contacts, events and campaign engagement with Klaviyo.",
    category: "Email",
    authKind: "api_key",
    origin: "built-in",
    icon: Send,
    docsUrl: "https://developers.klaviyo.com/",
    secretExample: `{"private_key": "pk_..."}`,
    fields: [
      {
        key: "credentials",
        label: "API Credential (JSON)",
        type: "secret",
        required: true,
        secret: true,
        json: true,
        placeholder: `{"private_key": "pk_..."}`,
        help: "Paste the JSON credential blob from Klaviyo → Settings → API keys. Must parse as JSON.",
      },
      {
        key: "list_id",
        label: "Default list ID",
        type: "text",
        placeholder: "XyZ123",
        help: "Optional. Contacts created without a list land here.",
      },
    ],
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    description: "Push audiences and campaign events to a Mailchimp account.",
    category: "Email",
    authKind: "api_key",
    origin: "built-in",
    icon: Send,
    docsUrl: "https://mailchimp.com/developer/",
    secretExample: `{"api_key": "...", "server": "us1"}`,
    fields: [
      {
        key: "api_key",
        label: "API Key",
        type: "secret",
        required: true,
        secret: true,
        placeholder: "abc123def456-us1",
        help: "Found under Account → Extras → API keys.",
      },
      {
        key: "server",
        label: "Server prefix",
        type: "select",
        required: true,
        options: [
          { value: "us1", label: "us1" },
          { value: "us2", label: "us2" },
          { value: "us3", label: "us3" },
          { value: "us4", label: "us4" },
          { value: "us5", label: "us5" },
          { value: "eu1", label: "eu1" },
          { value: "eu2", label: "eu2" },
          { value: "eu3", label: "eu3" },
          { value: "au1", label: "au1" },
        ],
        help: "The data-centre suffix of your API key (the part after the dash).",
      },
    ],
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    description: "Transactional and marketing email delivery via SendGrid.",
    category: "Email",
    authKind: "api_key",
    origin: "built-in",
    icon: Mail,
    docsUrl: "https://docs.sendgrid.com/",
    secretExample: `{"api_key": "SG...."}`,
    fields: [
      {
        key: "api_key",
        label: "API key",
        type: "secret",
        required: true,
        secret: true,
        placeholder: "SG.xxxxxxxx",
        help: "Requires Mail Send and Suppressions scopes.",
      },
    ],
  },
  {
    id: "listmonk",
    name: "Listmonk",
    description: "Self-hosted newsletter and mailing list manager.",
    category: "Email",
    authKind: "custom_rest",
    origin: "community",
    icon: Mail,
    docsUrl: "https://listmonk.app/docs/",
    customBuilder: true,
    secretExample: `{"base_url": "https://lists.example.com", "token": "..."}`,
    fields: [
      {
        key: "base_url",
        label: "Instance URL",
        type: "url",
        required: true,
        placeholder: "https://lists.example.com",
        help: "Base URL of your Listmonk instance.",
      },
      {
        key: "token",
        label: "API token",
        type: "secret",
        required: true,
        secret: true,
        help: "Generate under Settings → API keys.",
      },
    ],
  },
  {
    id: "mautic",
    name: "Mautic",
    description: "Open-source marketing automation with a REST API.",
    category: "Email",
    authKind: "custom_rest",
    origin: "community",
    icon: Mail,
    docsUrl: "https://docs.mautic.org/",
    customBuilder: true,
    secretExample: `{"base_url": "https://mautic.example.com", "username": "...", "password": "..."}`,
    fields: [
      {
        key: "base_url",
        label: "Instance URL",
        type: "url",
        required: true,
        placeholder: "https://mautic.example.com",
      },
      {
        key: "username",
        label: "API username",
        type: "text",
        required: true,
      },
      {
        key: "password",
        label: "API password",
        type: "secret",
        required: true,
        secret: true,
      },
    ],
  },
  {
    id: "phplist",
    name: "phpList",
    description: "Self-hosted email campaign manager with a REST API.",
    category: "Email",
    authKind: "custom_rest",
    origin: "community",
    icon: Mail,
    docsUrl: "https://www.phplist.org/docs/",
    customBuilder: true,
    secretExample: `{"base_url": "https://lists.example.org", "api_token": "..."}`,
    fields: [
      {
        key: "base_url",
        label: "Instance URL",
        type: "url",
        required: true,
        placeholder: "https://lists.example.org",
      },
      {
        key: "api_token",
        label: "API token",
        type: "secret",
        required: true,
        secret: true,
      },
    ],
  },

  /* ───────── Ads ───────── */
  {
    id: "meta-pixel",
    name: "Meta Pixel",
    description: "Server-side conversion events for Facebook and Instagram ads.",
    category: "Ads",
    authKind: "api_key",
    origin: "built-in",
    icon: Activity,
    docsUrl: "https://developers.facebook.com/docs/marketing-api/",
    secretExample: `{"pixel_id": "...", "access_token": "..."}`,
    fields: [
      {
        key: "pixel_id",
        label: "Pixel ID",
        type: "text",
        required: true,
        placeholder: "1234567890123456",
      },
      {
        key: "access_token",
        label: "Access token",
        type: "secret",
        required: true,
        secret: true,
        help: "System user token with ads_management scope.",
      },
    ],
  },
  {
    id: "google-ads",
    name: "Google Ads",
    description: "Offline conversion import and audience sync for Google Ads.",
    category: "Ads",
    authKind: "oauth2",
    origin: "built-in",
    icon: Target,
    docsUrl: "https://developers.google.com/google-ads/api/",
    scopes: ["https://www.googleapis.com/auth/adwords"],
    fields: [
      {
        key: "customer_id",
        label: "Customer ID",
        type: "text",
        required: true,
        placeholder: "123-456-7890",
        help: "The Google Ads account (CID) without dashes.",
      },
    ],
  },

  /* ───────── Analytics ───────── */
  {
    id: "ga4",
    name: "Google Analytics 4",
    description: "Stream server-side events into a GA4 property.",
    category: "Analytics",
    authKind: "api_key",
    origin: "built-in",
    icon: BarChart3,
    docsUrl: "https://developers.google.com/analytics/devguides/collection/",
    secretExample: `{"measurement_id": "G-XXXX", "api_secret": "..."}`,
    fields: [
      {
        key: "measurement_id",
        label: "Measurement ID",
        type: "text",
        required: true,
        placeholder: "G-XXXXXXXXXX",
      },
      {
        key: "api_secret",
        label: "API secret",
        type: "secret",
        required: true,
        secret: true,
        help: "Created in GA4 → Admin → Data Streams → Measurement Protocol API secrets.",
      },
    ],
  },

  /* ───────── Community ───────── */
  {
    id: "discord",
    name: "Discord Webhook",
    description: "Post alerts and milestone messages to a Discord channel.",
    category: "Community",
    authKind: "webhook",
    origin: "built-in",
    icon: Webhook,
    docsUrl: "https://discord.com/developers/docs/resources/webhook",
    secretExample: `{"webhook_url": "https://discord.com/api/webhooks/..."}`,
    fields: [
      {
        key: "webhook_url",
        label: "Webhook URL",
        type: "url",
        required: true,
        placeholder: "https://discord.com/api/webhooks/…",
        help: "Channel Settings → Integrations → New Webhook.",
      },
    ],
  },
  {
    id: "slack",
    name: "Slack Webhook",
    description: "Deliver notifications to a Slack channel via incoming webhook.",
    category: "Community",
    authKind: "webhook",
    origin: "built-in",
    icon: Webhook,
    docsUrl: "https://api.slack.com/messaging/webhooks",
    secretExample: `{"webhook_url": "https://hooks.slack.com/...", "channel": "#alerts"}`,
    fields: [
      {
        key: "webhook_url",
        label: "Webhook URL",
        type: "url",
        required: true,
        placeholder: "https://hooks.slack.com/services/…",
      },
      {
        key: "channel",
        label: "Channel",
        type: "text",
        placeholder: "#alerts",
        help: "Optional override — defaults to the webhook's channel.",
      },
    ],
  },

  /* ───────── Automation ───────── */
  {
    id: "n8n",
    name: "n8n",
    description: "Self-hosted workflow automation with webhook triggers.",
    category: "Automation",
    authKind: "custom_rest",
    origin: "community",
    icon: Workflow,
    docsUrl: "https://docs.n8n.io/api/",
    customBuilder: true,
    secretExample: `{"base_url": "https://n8n.example.com", "api_key": "..."}`,
    fields: [
      {
        key: "base_url",
        label: "Instance URL",
        type: "url",
        required: true,
        placeholder: "https://n8n.example.com",
      },
      {
        key: "api_key",
        label: "API key",
        type: "secret",
        required: true,
        secret: true,
      },
    ],
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Fan platform events out to thousands of Zapier apps.",
    category: "Automation",
    authKind: "webhook",
    origin: "built-in",
    icon: Zap,
    docsUrl: "https://platform.zapier.com/docs/triggers",
    secretExample: `{"hook_url": "https://hooks.zapier.com/hooks/catch/..."}`,
    fields: [
      {
        key: "hook_url",
        label: "Zap hook URL",
        type: "url",
        required: true,
        placeholder: "https://hooks.zapier.com/hooks/catch/…",
        help: "Copy the catch-hook URL from your Zap's trigger step.",
      },
    ],
  },

  /* ───────── CRM ───────── */
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Two-way contact, deal and engagement sync with HubSpot CRM.",
    category: "CRM",
    authKind: "oauth2",
    origin: "built-in",
    icon: Plug,
    docsUrl: "https://developers.hubspot.com/docs/api/overview",
    scopes: [
      "crm.objects.contacts.read",
      "crm.objects.contacts.write",
      "oauth",
    ],
    fields: [
      {
        key: "portal_id",
        label: "Portal ID",
        type: "text",
        required: true,
        placeholder: "12345678",
        help: "Found in your HubSpot account settings → Account Details.",
      },
    ],
  },

  /* ───────── Custom ───────── */
  {
    id: "custom-rest",
    name: "Custom REST endpoint",
    description: "Any REST API with webhooks — built with the Custom Connector Builder.",
    category: "Custom",
    authKind: "custom_rest",
    origin: "built-in",
    icon: Code2,
    customBuilder: true,
    secretExample: `{"base_url": "https://api.example.com", "auth_token": "..."}`,
    fields: [
      {
        key: "base_url",
        label: "Base URL",
        type: "url",
        required: true,
        placeholder: "https://api.example.com",
      },
      {
        key: "auth_token",
        label: "Auth token",
        type: "secret",
        secret: true,
      },
    ],
  },
];

const byId = new Map(CONNECTOR_DEFINITIONS.map((d) => [d.id, d]));

/** Look up a catalog definition (undefined = unknown id, e.g. bad import). */
export function getConnectorDefinition(id: string): ConnectorDefinition | undefined {
  return byId.get(id);
}

/** Catalog grouped by category (wizard step 1 grid). */
export function groupDefinitionsByCategory(): Array<{
  category: ConnectorDefinition["category"];
  definitions: ConnectorDefinition[];
}> {
  const out: Array<{
    category: ConnectorDefinition["category"];
    definitions: ConnectorDefinition[];
  }> = [];
  for (const def of CONNECTOR_DEFINITIONS) {
    const bucket = out.find((b) => b.category === def.category);
    if (bucket) bucket.definitions.push(def);
    else out.push({ category: def.category, definitions: [def] });
  }
  return out;
}
