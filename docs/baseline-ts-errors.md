# TypeScript Baseline Error Report

Command: `npx tsc --noEmit` (ignoreBuildErrors: off / not set)

**Total errors: 70**

**Breakdown by top-level folder:**

| Folder | Error Count |
|---|---|
| `src/modules/stitch` | 70 |
| **Total** | **70** |

**All 70 errors originate from `src/modules/stitch/`.** No errors from `src/components/`, `src/lib/`, `src/app/`, or other top-level folders.

**Error types (sample):**
- `TS1127: Invalid character.` (most frequent)
- `TS1381: Unexpected token. Did you mean {'}'} or &rbrace;?`

**Root cause:** JSX parsing failures in generated Stitch conversion files. These are not traditional type errors — they are syntax/parsing errors in the Turbopack/Next.js 16 JSX parser regarding the stitch-generated JSX. All errors are confined to the stitch pages directory.

**Note:** These errors predate this session and are not caused by changes made during this task. The `next.config.ts` has `ignoreBuildErrors: true`, which masks these during Next.js builds. Running `tsc --noEmit` without that flag exposes them.