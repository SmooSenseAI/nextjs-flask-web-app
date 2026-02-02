import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // Only use static export for production builds
  ...(isDev ? {} : { output: "export" }),
  distDir: "dist",
  assetPrefix: process.env.ASSET_PREFIX || "",
  images: {
    unoptimized: true,
  },
  // Proxy API requests to Flask in dev mode
  rewrites: async () => [
    {
      source: "/api/:path*",
      destination: "http://127.0.0.1:8000/api/:path*",
    },
  ],
};

export default nextConfig;
