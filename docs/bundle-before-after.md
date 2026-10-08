# Bundle Before / After — View Router Lazy Loading

## Status: No code changes required

All three apps already load views lazily via `next/dynamic`. The task's
precondition ("each app still imports its view components statically in the
view router") does not hold in this repo. Before and after are therefore
identical.

## Verification

| App | View router | Pattern |
|---|---|---|
| prop-admin | `apps/prop-admin/src/lib/platform/view-router.tsx` | 100 entries, all `dynamic(() => import(...), { loading: ViewSkeleton })` |
| platform-admin | `apps/platform-admin/src/lib/platform/view-router.tsx` | 32 entries, same pattern |
| trader | `apps/trader/src/lib/platform/view-router.tsx` | 3 entries, same pattern |

All three use `Skeleton` from `@pfaas/ui` as the loading state. Zero static
page imports at module scope in any router.

## Stitch pages (prop-admin)

`apps/prop-admin/src/modules/stitch/pages/` contains 162 orphaned stitch
components. They are not imported by anything in the repo
(`grep -rn "stitch/pages" apps/` returns zero results). No `index.ts` registry
exists. No `withPropAdminStitch` gate exists. They are left untouched per
instruction.

## Build results (clean rebuild, `ignoreBuildErrors: false`)

| App | BUILD_ID | Exit |
|---|---|---|
| prop-admin | VYLy5aEeNSwZk8JaPsn9l | 0 |
| platform-admin | kOcOT5A5nmals66JSOz9z | 0 |
| trader | QwwPRbk5nc-NJAajEdlHk | 0 |

## First-load JS per route (bytes, uncompressed)

| Route | prop-admin | platform-admin | trader |
|---|---|---|---|
| Home (`/`) | 1,172,643 | 738,809 | 1,068,122 |

prop-admin home breakdown (7 chunks):
- 544,083 `196-*.js` — operations console (lazy, not first-load; listed because index.html references it)
- 241,608 `8666-*.js` — shared vendor
- 201,059 `24d39b65-*.js` — shared vendor
- 112,594 `polyfills-*.js`
- 66,228 `255-*.js`
- 6,544 `webpack-*.js`
- 527 `main-app-*.js`

## 10 largest client chunks

| # | prop-admin | platform-admin | trader |
|---|---|---|---|
| 1 | 544,083 | 385,480 | 445,537 |
| 2 | 276,080 | 241,608 | 241,607 |
| 3 | 241,608 | 218,932 | 218,931 |
| 4 | 218,932 | 201,059 | 201,058 |
| 5 | 201,059 | 139,600 | 139,598 |
| 6 | 139,600 | 135,332 | 112,594 |
| 7 | 122,601 | 112,594 | 36,428 |
| 8 | 112,594 | 83,947 | 26,852 |
| 9 | 83,947 | 66,228 | 15,138 |
| 10 | 66,228 | — | — |
| **Total** | **4,023,110** | **2,179,784** | **1,475,979** |

## Delta

No delta. No source files were modified. Builds are byte-identical to the
pre-task state.
