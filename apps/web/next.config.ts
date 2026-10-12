import type { NextConfig } from "next";
import { resolveApiInternalUrl } from "./lib/api/config.ts";

const apiInternalUrl = resolveApiInternalUrl(process.env.API_INTERNAL_URL);

const config: NextConfig = {
  transpilePackages: ["@nexora/sdk", "@nexora/ui", "@nexora/shared"],
  poweredByHeader: false,
  experimental: { cpus: 2 },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiInternalUrl}/api/:path*`,
      },
    ];
  },
};
export default config;
