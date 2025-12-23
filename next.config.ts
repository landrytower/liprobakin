import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  turbopack: {
    root: __dirname,
  },
  images: {
    unoptimized: true,
  },
  trailingSlash: false,
};

export default nextConfig;
