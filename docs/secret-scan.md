# Secret scan report

Rewritten 2026-10-08 (task 1/4). The previous version of this file (commit `412964a`) printed full unmasked secrets and contained stale findings — see §6. All values below are masked; full values are never printed.

Scan state: HEAD `dcef237`, pre-remediation working tree. Task 2/4 replaces every working-tree match with `EXAMPLE_KEY_NOT_REAL`.

## 1. Scan scope and tooling

All reproduction commands use `[_]` character classes so this file itself never matches a raw scan.

```bash
# tracked files (same scan runs in CI: .github/workflows/secrets.yml)
git grep -nE '(sk|pk|rk)[_]live[_]|whsec[_]' -- .

# full working tree (source + docs), one regex = raw prefix + entropy filter
grep -rInE '(sk|pk|rk)[_]live[_][A-Za-z0-9_.•*-]*|whsec[_][A-Za-z0-9_.•*-]*' \
  --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.next \
  --exclude-dir=dist --exclude-dir=.turbo --exclude-dir=coverage \
  --exclude-dir=.vscode .

# history across all refs (incl. refs/original backup ref)
git log --all --oneline -G'(sk|pk|rk)[_]live[_]|whsec[_]'
```

Excluded from scan scope: `.git/`, `node_modules/` (1 third-party hit: bun-types docs example sk\_live\_xx…, resets on install), build artifacts (`.next/`, `.turbo/`, `dist/`), `.vscode/` (project policy: never scanned).

**Masking conventions**

- Masked column = first 8 characters, written backslash-escaped (`whsec\_9f`, `sk\_live\_`) so raw greps see no match; renders as the real prefix.
- `sha256:12` = first 12 hex chars of SHA-256 of the full string — the stable identifier. For `[_]live[_]` keys the first 8 chars are just the prefix, so rows are told apart by the hash only.
- ENT = length of the `[A-Za-z0-9_-]` run after the prefix (bullets/stars count 0 — the previous report wrongly counted them). ENT ≥ 24 → HIGH rotation candidate; 20–23 → borderline, manual review.

## 2. Working tree — tracked files (18 lines, 19 occurrences, 10 files)

| File:line | Masked (first 8) | sha256:12 | ENT | Judgment |
|---|---|---|---:|---|
| `apps/prop-admin/src/modules/settings/pages/marketing-integrations-page.tsx:124` | pk\_live\_ | `75e69ffe5ba2` | 12 | low |
| `apps/prop-admin/src/modules/stitch/pages/account-kyc-statuses.tsx:495` | sk\_live\_ | `0162476908fa` | 0 | placeholder (masked) |
| `apps/prop-admin/src/modules/stitch/pages/checkout-external.tsx:221` | whsec\_9f | `1571ce0fd7b2` | 40 | **HIGH — rotate** |
| `apps/prop-admin/src/modules/stitch/pages/checkout-external.tsx:810` | whsec\_94 | `75827f744df6` | 5 | placeholder (truncated) |
| `apps/prop-admin/src/modules/stitch/pages/checkout-providers.tsx:254` | sk\_live\_ | `f702713ba02a` | 15 | low — 2nd match on line: `f5b99d8800de` ENT 0 placeholder |
| `apps/prop-admin/src/modules/stitch/pages/checkout-psp-onboarding.tsx:148` | pk\_live\_ | `b00b916ff46c` | 29 | **HIGH — rotate** |
| `apps/prop-admin/src/modules/stitch/pages/checkout-psp-onboarding.tsx:159` | sk\_live\_ | `a88959a60a2a` | 0 | placeholder (masked) |
| `apps/prop-admin/src/modules/stitch/pages/checkout-psp-onboarding.tsx:168` | whsec\_7b | `8ed088b59c97` | 32 | **HIGH — rotate** |
| `apps/prop-admin/src/modules/stitch/pages/checkout-psp-onboarding.tsx:452` | rk\_live\_ | `098df8df55d1` | 0 | placeholder (masked) |
| `apps/prop-admin/src/modules/stitch/pages/checkout-psp-onboarding.tsx:481` | pk\_live\_ | `e7c5aeb7e218` | 4 | placeholder (truncated) |
| `apps/prop-admin/src/modules/stitch/pages/checkout.tsx:562` | whsec\_94 | `75827f744df6` | 5 | placeholder (truncated) |
| `apps/prop-admin/src/modules/stitch/pages/kyc-provider-marketplace.tsx:769` | whsec\_83 | `62f072dcc9f9` | 25 | **HIGH — rotate** |
| `apps/prop-admin/src/modules/stitch/pages/kyc-providers.tsx:435` | whsec\_li | `a675b2c73a35` | 27 | **HIGH — rotate** |
| `apps/prop-admin/src/modules/stitch/pages/kyc-providers.tsx:438` | whsec\_li | `a675b2c73a35` | 27 | **HIGH — rotate** (same value as :435) |
| `apps/prop-admin/src/modules/stitch/pages/kyc-providers.tsx:1254` | whsec\_•• | `334fba67db58` | 0 | placeholder (masked) |
| `apps/prop-admin/src/modules/stitch/pages/marketing-integrations.tsx:516` | pk\_live\_ | `ff36c281fa07` | 0 | placeholder (masked) |
| `apps/prop-admin/src/modules/stitch/pages/marketing-integrations.tsx:532` | pk\_live\_ | `0faa5505a2bc` | 23 | borderline |
| `apps/prop-admin/src/modules/stitch/pages/payout-methods-config.tsx:905` | whsec\_99 | `201da33b4048` | 30 | **HIGH — rotate** |

## 3. Working tree — gitignored `stitch_screens/` (29 occurrences, 16 files)

Never tracked by git (`git ls-files stitch_screens/` = empty), never scanned by the previous report.

| File | Occurrences | Unique values |
|---|---:|---:|
| `stitch_screens/account_kyc_statuses_document_detail_inspection_sheet_state/code.html` | 1 | 1 |
| `stitch_screens/account_kyc_statuses_mark_all_approved_confirmation_state/code.html` | 1 | 1 |
| `stitch_screens/account_kyc_statuses_mt5_882049_elena_althaus/code.html` | 1 | 1 |
| `stitch_screens/checkout_overview_external_headless_active_mode_state/code.html` | 1 | 1 |
| `stitch_screens/checkout_overview_switch_mode_confirmation_alertdialog_state/code.html` | 1 | 1 |
| `stitch_screens/external_checkout_integration/code.html` | 2 | 1 |
| `stitch_screens/external_checkout_integration_test_webhook_event_simulation_sheet_state/code.html` | 2 | 1 |
| `stitch_screens/kyc_provider_marketplace_connect_provider_sheet_state/code.html` | 1 | 1 |
| `stitch_screens/kyc_provider_settings/code.html` | 3 | 2 |
| `stitch_screens/kyc_providers_edit_configuration_sheet_state/code.html` | 1 | 1 |
| `stitch_screens/marketing_integrations/code.html` | 3 | 2 |
| `stitch_screens/payment_providers/code.html` | 2 | 2 |
| `stitch_screens/payout_methods_configuration_add_payout_method_sheet_state/code.html` | 1 | 1 |
| `stitch_screens/psp_onboarding_wizard/code.html` | 3 | 3 |
| `stitch_screens/psp_onboarding_wizard_connection_diagnostics_error_key_vault_modal_state/code.html` | 5 | 5 |
| `stitch_screens/trader_audit_log_event_subscription_sheet_state/code.html` | 1 | 1 |

## 4. Full unique-string inventory (28)

28 unique strings ever seen: 22 reachable from HEAD history, 1 reachable only from the `refs/original` backup ref, 5 never committed (disk only, all in `stitch_screens/`).

| ENT | sha256:12 | Masked (first 8) | Judgment | First introduced | Reachable from |
|---:|---|---|---|---|---|
| 40 | `1571ce0fd7b2` | whsec\_9f | **HIGH — rotate** | `d453d53` 2026-10-05 | HEAD history |
| 39 | `67806287364d` | sk\_live\_ | **HIGH — rotate** | `d453d53` 2026-10-05 | HEAD history |
| 32 | `1a5f2d0c3332` | sk\_live\_ | **HIGH — rotate** | `28f6164` 2026-10-05 | refs/original only |
| 32 | `8ed088b59c97` | whsec\_7b | **HIGH — rotate** | `d453d53` 2026-10-05 | HEAD history |
| 30 | `201da33b4048` | whsec\_99 | **HIGH — rotate** | `d453d53` 2026-10-05 | HEAD history |
| 29 | `b00b916ff46c` | pk\_live\_ | **HIGH — rotate** | `d453d53` 2026-10-05 | HEAD history |
| 27 | `a675b2c73a35` | whsec\_li | **HIGH — rotate** | `d453d53` 2026-10-05 | HEAD history |
| 25 | `62f072dcc9f9` | whsec\_83 | **HIGH — rotate** | `d453d53` 2026-10-05 | HEAD history |
| 24 | `0147858606dc` | whsec\_9f | **HIGH — rotate** | — | uncommitted (disk only) |
| 23 | `0faa5505a2bc` | pk\_live\_ | borderline | `d453d53` 2026-10-05 | HEAD history |
| 21 | `72841c05f2f4` | whsec\_01 | borderline | — | uncommitted (disk only) |
| 20 | `eca5c9d91899` | sk\_live\_ | PLACEHOLDER | `d453d53` 2026-10-05 | HEAD history |
| 19 | `959ee1b28b15` | pk\_live\_ | low | — | uncommitted (disk only) |
| 19 | `077cd41a888a` | rk\_live\_ | low | — | uncommitted (disk only) |
| 18 | `ce4ce76cd497` | pk\_live\_ | PLACEHOLDER | `a869289` 2026-10-05 | HEAD history |
| 16 | `ab5e0f5f359a` | whsec\_xx | PLACEHOLDER | `a869289` 2026-10-05 | HEAD history |
| 15 | `f702713ba02a` | sk\_live\_ | low | `d453d53` 2026-10-05 | HEAD history |
| 12 | `75e69ffe5ba2` | pk\_live\_ | low | `72e561c` 2026-09-23 | HEAD history |
| 5 | `75827f744df6` | whsec\_94 | PLACEHOLDER (truncated) | `d453d53` 2026-10-05 | HEAD history |
| 5 | `c94f385be0a9` | whsec\_li | low | `d453d53` 2026-10-05 | HEAD history |
| 4 | `e7c5aeb7e218` | pk\_live\_ | low | `d453d53` 2026-10-05 | HEAD history |
| 4 | `2d456caae267` | whsec\_94 | PLACEHOLDER (truncated) | — | uncommitted (disk only) |
| 0 | `ff36c281fa07` | pk\_live\_ | PLACEHOLDER | `d453d53` 2026-10-05 | HEAD history |
| 0 | `098df8df55d1` | rk\_live\_ | PLACEHOLDER | `d453d53` 2026-10-05 | HEAD history |
| 0 | `a88959a60a2a` | sk\_live\_ | PLACEHOLDER | `cffee95` 2026-10-06 | HEAD history |
| 0 | `f5b99d8800de` | sk\_live\_ | PLACEHOLDER | `d453d53` 2026-10-05 | HEAD history |
| 0 | `0162476908fa` | sk\_live\_ | PLACEHOLDER | `cffee95` 2026-10-06 | HEAD history |
| 0 | `334fba67db58` | whsec\_•• | PLACEHOLDER | `d453d53` 2026-10-05 | HEAD history |

Counts: 9 HIGH · 2 borderline · 11 PLACEHOLDER · 6 low.

## 5. Git history, rotation, backup ref

- **23 unique strings were ever committed** (22 reachable from HEAD + `1a5f2d0c3332` reachable only from `refs/original/refs/heads/main`). No history rewrite was performed — out of scope, user decision.
- Bulk first introduction: `d453d53` (2026-10-05, ancestor of HEAD). Older: `72e561c` 2026-09-23. Later masking passes: `a869289`, `cffee95`.
- **`refs/original/refs/heads/main`** (tip `edefb90`) is a filter-branch backup ref holding a pre-rewrite lineage, including `1a5f2d0c3332` (ENT 32) which exists nowhere else in git. Recommended after rotation, as a **user decision**: `git update-ref -d refs/original/refs/heads/main`. Do not delete before rotation — it is the only copy that records the original key.
- **HIGH rotation candidates (9)** — treat as compromised, rotate at the provider:

  | sha256:12 | ENT | Masked | Found pre-remediation (working tree) |
  |---|---:|---|---|
  | `1571ce0fd7b2` | 40 | whsec\_9f | `checkout-external.tsx`, old this-file, `stitch_screens/external_checkout_integration` |
  | `67806287364d` | 39 | sk\_live\_ | old this-file, 3 × `stitch_screens/account_kyc_statuses_*` (not in tracked code) |
  | `1a5f2d0c3332` | 32 | sk\_live\_ | `stitch_screens/psp_onboarding_wizard` + refs/original history |
  | `8ed088b59c97` | 32 | whsec\_7b | `checkout-psp-onboarding.tsx`, `stitch_screens/psp_onboarding_wizard` |
  | `201da33b4048` | 30 | whsec\_99 | `payout-methods-config.tsx`, old this-file, `stitch_screens/payout_methods_*` |
  | `b00b916ff46c` | 29 | pk\_live\_ | `checkout-psp-onboarding.tsx`, `stitch_screens/psp_onboarding_wizard` |
  | `a675b2c73a35` | 27 | whsec\_li | `kyc-providers.tsx` (×2), old this-file, `stitch_screens/kyc_provider_settings` |
  | `62f072dcc9f9` | 25 | whsec\_83 | `kyc-provider-marketplace.tsx`, old this-file, `stitch_screens/kyc_provider_marketplace_*` |
  | `0147858606dc` | 24 | whsec\_9f | `stitch_screens/trader_audit_log_event_subscription_sheet_state` only (never committed) |

  Locations are pre-remediation; task 2/4 removes every working-tree occurrence.
- Borderline (review manually): `0faa5505a2bc` ENT 23, `72841c05f2f4` ENT 21 (repeated-digit pattern — likely fabricated).

## 6. Corrections to the previous report (`412964a`)

1. **Self-contamination**: the old report printed full unmasked secrets (its only commit, `412964a`).
2. **Stale paths**: cited `src/…`; actual paths are `apps/prop-admin/src/…`. `checkout-platform-*.tsx` no longer exists.
3. **Stale line 495**: claimed `67806287364d` (ENT 39) there; actual value is masked placeholder `0162476908fa`. The ENT-39 string survives only in gitignored `stitch_screens/account_kyc_statuses_*` files (and git history).
4. **Stale lines 148/168**: called them placeholders; actual: `b00b916ff46c` ENT 29 and `8ed088b59c97` ENT 32 (both HIGH).
5. **False "history cleaned" claim**: "filter-branch ran, all strings replaced" — full values remain in HEAD history (first seen `d453d53`, ancestor of HEAD).
6. **Coverage gaps**: gitignored `stitch_screens/` (29 occurrences), `.next` build artifacts, and `node_modules` example were never scanned; no CI workflow existed (`.github/` absent).
7. **Broken entropy metric**: masked strings got ENT from bullet/star runs (masked rk\_live\_•••• reported ENT 32, actual 0). Real HIGH count corrected: 9, not "18 possibly real".

## 7. Remediation status

| Task | State |
|---|---|
| 1/4 — this report | rewritten, masked, self-scan-clean |
| 2/4 — working tree | all matches (tracked 10 files, `stitch_screens/*`, `.next`) → `EXAMPLE_KEY_NOT_REAL` |
| 3/4 — `docs/tools/stitch2tsx.py` | gains `scrub_text()` + `--check` / `--scrub` CLI |
| 4/4 — enforcement | `.gitleaks.toml`, `scripts/git-hooks/pre-commit` (committed, **not installed**), `.github/workflows/secrets.yml` |

Out of scope, user decisions: rotating the 9 HIGH keys; history rewrite; deleting `refs/original/refs/heads/main`.
