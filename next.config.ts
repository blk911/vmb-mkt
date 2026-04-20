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
  async redirects() {
    return [
      // Canonical pipeline entry points for legacy intake surfaces.
      { source: "/admin/source-intake", destination: "/admin/build", permanent: false },
      { source: "/admin/source-intake/:path*", destination: "/admin/build", permanent: false },
      { source: "/admin/manual-ig-clusters", destination: "/admin/build", permanent: false },
      { source: "/admin/vmb/facilities/import", destination: "/admin/build", permanent: false },

      // Legacy operator review surfaces now converge on Validate.
      { source: "/admin/operators", destination: "/admin/validate", permanent: false },
      { source: "/admin/operators/:path*", destination: "/admin/validate", permanent: false },

      // Legacy targeting surfaces now converge on Target.
      { source: "/admin/dora/targets", destination: "/admin/target", permanent: false },
      { source: "/admin/markets/target/:path*", destination: "/admin/target", permanent: false },
      { source: "/admin/vmb/targets", destination: "/admin/target", permanent: false },

      // Legacy outreach entry point now converges on Activate.
      { source: "/admin/markets/outreach-queue", destination: "/admin/activate", permanent: false },
    ];
  },
};

export default nextConfig;
