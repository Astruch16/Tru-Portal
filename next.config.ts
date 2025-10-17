import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Disable ESLint during production builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Disable type checking during production builds (optional, can remove if you want type checking)
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
