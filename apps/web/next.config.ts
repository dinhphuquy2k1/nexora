import { loadDeploymentPolicy } from "@nexora/shared";
import type { NextConfig } from "next";
import { resolveApiInternalUrl } from "./lib/api/config.ts";

loadDeploymentPolicy(process.env);
const apiInternalUrl = resolveApiInternalUrl(process.env.API_INTERNAL_URL);

const config: NextConfig = {
  transpilePackages: ["@nexora/sdk", "@nexora/ui", "@nexora/shared"],
  poweredByHeader: false,
  allowedDevOrigins: [
    "127.0.0.1",
    "127.0.0.1:3001",
    "localhost",
    "localhost:3001",
  ],
  experimental: { cpus: 2 },
  async headers() {
    return [
      {
        source: "/setup",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
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
