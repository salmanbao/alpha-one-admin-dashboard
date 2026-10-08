import type { NextConfig } from "next";

// Resolve @pfaas/ui and @pfaas/platform-core at build time
// Relative to apps/trader, packages/ui sits at ../../packages/ui/src/components
export default {
  output: "standalone",
  transpilePackages: ["@pfaas/ui", "@pfaas/platform-core"],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
} satisfies NextConfig;