import type { NextConfig } from "next";
const config: NextConfig = {
  transpilePackages: ["@nexora/sdk", "@nexora/ui", "@nexora/shared"],
  poweredByHeader: false,
  experimental: { cpus: 2 },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_INTERNAL_URL ?? "http://api:4000"}/api/:path*`,
      },
    ];
  },
};
export default config;
