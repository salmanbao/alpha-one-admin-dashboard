# Split Verification

All three apps built clean with `ignoreBuildErrors` removed. Results below.

## 1. Builds (exit 0, `ignoreBuildErrors: false`)

| App | Build ID | Status |
|---|---|---|
| prop-admin | VYLy5aEeNSwZk8JaPsn9l | PASS |
| platform-admin | kOcOT5A5nmals66JSOz9z | PASS |
| trader | QwwPRbk5nc-NJAajEdlHk | PASS |

## 2. First-Load JS Sizes (index.html client chunks, uncompressed)

| App | Bytes | KiB | Chunks |
|---|---|---|---|
| prop-admin | 1,172,643 | 1,145 | 7 |
| platform-admin | 738,809 | 721 | 7 |
| trader | 1,068,122 | 1,043 | 8 |

prop-admin's largest chunk (544 KB) is the operations console; trader's (445 KB) is the trader-detail page. Shared framework/polyfill chunks are byte-identical across apps.

## 3. Leakage Greps (shipped `.next` output, cache excluded)

| Check | prop-admin | trader | platform-admin |
|---|---|---|---|
| `tenant-lifecycle` | CLEAN | CLEAN | OWN FEATURE (lazy manifest + ops console) |
| `emergency-controls` | CLEAN | CLEAN | OWN FEATURE (ops console) |
| `cross-tenant-queues` | CLEAN | CLEAN | OWN FEATURE (ops console) |
| `module: "trading"` | N/A | OWN FEATURE | CLEAN |
| `module: "challenges"` | OWN FEATURE | CLEAN | CLEAN |
| `module: "payouts"` | OWN FEATURE | CLEAN | CLEAN |
| `module: "risk"` | OWN FEATURE | CLEAN | CLEAN |
| `module: "kyc"` | OWN FEATURE | CLEAN | CLEAN |
| `module: "affiliates"` | OWN FEATURE | CLEAN | CLEAN |

prop-admin legitimately owns payouts/challenges/risk/kyc/affiliates as its own modules — those are not leakage. platform-admin's hits are its own features (lazy-load manifest keys + the operations console in `chunks/453.js`).

## 4. Cross-App Lint (`bun run lint:cross-app`)

- Baseline: **PASS** (exit 0, no errors).
- Deliberate bad import test: added `import { payoutsModule } from "../../prop-admin/src/modules/payouts"` to `apps/trader/src/app/trader-detail/_leak-test.tsx`, ran lint → **FAILED** with:
  ```
  error  '../../prop-admin/src/modules/payouts' import is restricted from being used by a pattern.
         Cross-app imports are forbidden. Share code via @pfaas/ui or @pfaas/platform-core instead,
         or duplicate it locally with a TODO comment  no-restricted-imports
  ```
  Test file removed; tree clean.

## 5. `application ===` / `runtime.application` Enumeration

**prop-admin** (6 sites):
- `components/shell/onboarding-wizard.tsx:105` — `runtime.application` in useEffect deps
- `components/shell/topbar.tsx:115` — `u.application === user.application` (same-app comparison)
- `components/shell/command-menu.tsx:169` — same-app comparison
- `modules/settings/pages/group-management-page.tsx:60,61,165` — `(u as AuthUser).application === "prop-admin"` (own app filter)

**trader** (0 sites): No `application ===` checks. Trader routes are fixed (`trading` module only).

**platform-admin** (17 sites): All compare against `"super-admin"` or `"prop-admin"` — platform-admin is the super-admin app, so these are legitimate. Notable:
- `components/shell/onboarding-wizard.tsx:99` — `runtime.application === "super-admin"` early return
- `modules/super-admin/role-management-page.tsx:17-19` — counts roles by `super-admin` / `prop-admin` / `trader`
- `modules/super-admin/tenant-view-as-page.tsx:35-36,44,57` — view-as-role filtering
- `modules/super-admin/operator-directory-page.tsx:13,63` — operator directory filter
- `lib/platform/platform-context.tsx:524` — `u.application === "super-admin"`

No app checks `runtime.application === "trader"` or `=== "prop-admin"` at runtime to switch behavior — app identity is structural, not runtime-negotiable.

## 6. Git State

Three commits on current branch:
- `ac47d75` platform-admin
- `dde42b4` trader
- `67c7bcf` prop-admin

Working tree clean.
