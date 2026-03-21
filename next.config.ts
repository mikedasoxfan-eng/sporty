import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.mlb.com",
        pathname: "/mlb-photos/**",
      },
    ],
  },
};

export default nextConfig;
