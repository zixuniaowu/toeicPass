import path from "node:path";
import type { NextConfig } from "next";

const apiProxyTarget = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8001";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@toeicpass/ad-system", "@toeicpass/conversation-ai"],
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@toeicpass/ad-system/web": path.resolve(__dirname, "../../packages/ad-system/web/index.ts"),
      "@toeicpass/conversation-ai/web": path.resolve(__dirname, "../../packages/conversation-ai/web/index.ts"),
    };

    return config;
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiProxyTarget}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
