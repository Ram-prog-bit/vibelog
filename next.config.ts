import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // hide the floating Next.js dev indicator ("N" badge, bottom corner)
  devIndicators: false,
  // a stray lockfile in the home dir makes Next infer the wrong workspace root
  turbopack: { root: path.join(__dirname) },
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
