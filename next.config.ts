import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // stamped at build time, shown in Settings → About Popsicle
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    NEXT_PUBLIC_APP_ENV: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
  },
};

export default nextConfig;
