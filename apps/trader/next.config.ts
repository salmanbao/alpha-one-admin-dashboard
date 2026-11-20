import type { NextConfig } from "next";

// Resolve @pfaas/ui and @pfaas/platform-core at build time
// Relative to apps/trader, packages/ui sits at ../../packages/ui/src/components
export default {
  // Next.js 16.3 + output:"standalone" fails Vercel builds in onBuildComplete
  // (ENOENT .next/next-server.js.nft.json — vercel/next.js#96646). Keep
  // standalone for self-hosted/Docker builds; let Vercel use native packaging.
  output: process.env.VERCEL ? undefined : "standalone",
  transpilePackages: ["@pfaas/ui", "@pfaas/platform-core"],
  reactStrictMode: false,
} satisfies NextConfig;