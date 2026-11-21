import type { NextConfig } from "next";

// Shared UI components physically live in packages/ui/src/components, but
// prop-admin imports them via the @/components/ui and @/components/platform
// path style. Resolve those at build time so Turbopack can find the real
// source files (the @pfaas/ui package.json only exposes named entrypoints).
// Relative to the app root (apps/prop-admin), packages/ui/src/components sits
// at ../../packages/ui/src/components.
export default {
  // Next.js 16.3 + output:"standalone" fails Vercel builds in onBuildComplete
  // (ENOENT .next/next-server.js.nft.json — vercel/next.js#96646). Keep
  // standalone for self-hosted/Docker builds; let Vercel use native packaging.
  output: process.env.VERCEL ? undefined : "standalone",
  // basePath removed for independent Vercel project deployment
  transpilePackages: ["@pfaas/ui"],
  reactStrictMode: true,
} satisfies NextConfig;
