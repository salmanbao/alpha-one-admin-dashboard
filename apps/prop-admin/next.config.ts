import type { NextConfig } from "next";

// Shared UI components physically live in packages/ui/src/components, but
// prop-admin imports them via the @/components/ui and @/components/platform
// path style. Resolve those at build time so Turbopack can find the real
// source files (the @pfaas/ui package.json only exposes named entrypoints).
// Relative to the app root (apps/prop-admin), packages/ui/src/components sits
// at ../../packages/ui/src/components.
export default {
  output: "standalone",
  transpilePackages: ["@pfaas/ui"],
  reactStrictMode: false,
} satisfies NextConfig;
