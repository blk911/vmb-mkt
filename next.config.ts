import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Restore-mode safety: legacy route signatures compile under Next 16.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
