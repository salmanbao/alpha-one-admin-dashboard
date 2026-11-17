import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/platform-admin",
  /* config options here */
  reactStrictMode: false,
};

export default nextConfig;
