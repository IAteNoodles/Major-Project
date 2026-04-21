import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow API requests to the backend
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"}/api/:path*`,
      },
    ];
  },
  // Suppress hydration warnings from browser extensions
  reactStrictMode: true,
  // @ts-ignore
  allowedDevOrigins: ["10.1.8.117", "192.168.137.1", "localhost", "127.0.0.1"],
};

export default nextConfig;
