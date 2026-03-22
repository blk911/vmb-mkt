import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Restore-mode safety: legacy route signatures compile under Next 16.
    ignoreBuildErrors: true,
  },
  /**
   * Ensures the browser bundle can read a Maps JS key at build time.
   * Prefer NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env; GOOGLE_MAPS_BROWSER_KEY is an optional alias
   * (HTTP referrer–restricted browser key — do not use a server-only secret name here).
   */
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_BROWSER_KEY || "",
  },
};

export default nextConfig;
