import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16.3 + output:"standalone" fails Vercel builds in onBuildComplete
  // (ENOENT .next/next-server.js.nft.json — vercel/next.js#96646). Keep
  // standalone for self-hosted/Docker builds; let Vercel use native packaging.
  output: process.env.VERCEL ? undefined : "standalone",
  // basePath removed for independent Vercel project deployment
  /* config options here */
  reactStrictMode: false,
};

export default nextConfig;
