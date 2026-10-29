# §10.15 — Demo Persistence Data Model & Control Matrix

## Data Model (`pfaas:demo:*` keys)

| Store | Key | Schema (`validation.ts`) | Purge on reset |
|---|---|---|---|
| Traders | `pfaas:demo:traders` | `demoTradersSchema` (record) | yes |
| CRM | `pfaas:demo:crm` | `demoCrmSchema` | yes |
| KYC | `pfaas:demo:kyc` | `demoKycSchema` | yes |
| Payouts | `pfaas:demo:payouts` | `demoPayoutsSchema` | yes |
| Breaches | `pfaas:demo:breaches` | `demoBreachesSchema` (array) | yes |
| Risk Cases | `pfaas:demo:risk-cases` | `demoRiskCasesSchema` | yes |
| Announcements | `pfaas:demo:announcements` | `demoAnnouncementsSchema` | yes |
| Tickets | `pfaas:demo:tickets` | `demoTicketsSchema` | yes |
| Evaluations | `pfaas:demo:evaluations` | `demoEvaluationsSchema` | yes |

Audit trail (`pfaas:auditSession`) and user identity (`pfaas:demoUser`) are preserved across reset (only `pfaas:demo:*` cleared).

## Control Matrix

- **Write**: `saveDemoState()` — best-effort, SSR-safe (no-op without `window`).
- **Read**: `loadDemoState()` — validates against zod; corrupt payload → graceful fallback to seed.
- **Clear**: `resetDemoState()` — removes all 9 store keys + `pfaas:auditSession`, then reloads.
- **Access**: `localStorage` only; never read outside these stores.
- **Convention**: `toast()` for mock actions; never `alert()`.

## Verification
- Playwright script `/tmp/opencode/pw/verify-persistence.js` passes 12/12.
- Commit `90c8301` lands the fix + persistence.
