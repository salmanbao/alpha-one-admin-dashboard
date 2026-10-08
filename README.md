# PFaaS Monorepo

Three Next.js dashboards served from a single Turborepo.

| App | Package | Port | Role |
|---|---|---|---|
| prop-admin | `@pfaas/prop-admin` | 3000 | Prop trader admin — payouts, risk, KYC, affiliates, trading, challenges |
| platform-admin | `@pfaas/platform-admin` | 3001 | Super-admin / platform operations — tenants, health, billing, compliance |
| trader | `@pfaas/trader` | 3002 | Trader workspace — positions, account detail, closed trades |

Shared packages live under `packages/`:
- `@pfaas/ui` — component library (Radix + Tailwind)
- `@pfaas/platform-core` — platform context, auth, routing, module engine

---

## Prerequisites

- **Node.js** >= 20
- **Bun** >= 1.2.0 (package manager / runtime)
- **Database** — `DATABASE_URL` must be set (see `.env`)

> The repo ships a `.env` file at the root. Copy `.env.example` to `.env` and
> fill in your connection string before running anything that touches the DB.

---

## Install

```bash
bun install --ignore-scripts
```

Workspace hoisting handles `@pfaas/ui` and `@pfaas/platform-core` automatically.

---

## Run all three dashboards (development)

```bash
bun run dev
```

This runs `turbo run dev`, which starts all three apps concurrently:

| App | URL |
|---|---|
| prop-admin | http://localhost:3000 |
| platform-admin | http://localhost:3001 |
| trader | http://localhost:3002 |

To run a single app:

```bash
bun run dev --filter=@pfaas/prop-admin
bun run dev --filter=@pfaas/platform-admin
bun run dev --filter=@pfaas/trader
```

Or from the app directory directly:

```bash
cd apps/prop-admin && bun run dev
cd apps/platform-admin && bun run dev
cd apps/trader && bun run dev
```

---

## Build (production)

All three:

```bash
bun run build
```

Single app:

```bash
bun run build:prop-admin        # prop-admin only
cd apps/platform-admin && bun run build   # platform-admin only
cd apps/trader && bun run build           # trader only
```

Each app's build script runs `next build --webpack`, then copies static assets
into `.next/standalone/` so the output is self-contained.

---

## Start (production)

After building, start any app with:

```bash
cd apps/prop-admin
NODE_ENV=production bun .next/standalone/server.js
```

`platform-admin` uses `node` instead of `bun` for its standalone server:

```bash
cd apps/platform-admin
NODE_ENV=production node .next/standalone/server.js
```

Trader uses `bun`:

```bash
cd apps/trader
NODE_ENV=production bun .next/standalone/server.js
```

---

## Type-check

Each app ships its own `tsconfig.json`. Run:

```bash
npx tsc --noEmit -p apps/prop-admin/tsconfig.json
npx tsc --noEmit -p apps/platform-admin/tsconfig.json
npx tsc --noEmit -p apps/trader/tsconfig.json
```

Or all three via turbo:

```bash
turbo run build   # build includes tsc via next build
```

`strict: true` is enabled in all three configs. `noImplicitAny` is `false`.
`@ts-ignore` / `as any` suppression is not used.

---

## Lint

All apps:

```bash
bun run lint          # turbo run lint
bun run lint:cross-app # eslint apps (cross-app import check)
```

Single app:

```bash
cd apps/prop-admin && bun run lint
```

---

## Database (prop-admin only)

```bash
cd apps/prop-admin
bun run db:generate    # regenerate Prisma client
bun run db:migrate     # apply pending migrations
bun run db:push        # push schema without migrations
bun run db:reset       # reset DB (destructive)
```

---

## Project layout

```
ui/
├── apps/
│   ├── prop-admin/       # port 3000
│   ├── platform-admin/   # port 3001
│   └── trader/           # port 3002
├── packages/
│   ├── ui/               # @pfaas/ui — shared components
│   └── platform-core/    # @pfaas/platform-core — auth, routing, modules
├── docs/                 # verification and bundle reports
├── turbo.json            # turbo pipeline config
└── package.json          # root workspace
```

Each app's entry points are under `apps/<app>/src/app/`. View routing is
handled by `apps/<app>/src/lib/platform/view-router.tsx`, which maps view IDs
to lazy-loaded page components via `next/dynamic`.

---

## Notes

- All three view routers already lazy-load pages with `next/dynamic` and a
  `Skeleton` from `@pfaas/ui`. No static page imports at module scope.
- `apps/prop-admin/src/modules/stitch/pages/` contains 162 orphaned stitch
  page components. They are not wired into any router yet and will be
  connected in a follow-up task.
