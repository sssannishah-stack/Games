import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/dashboard", destination: "/admin", permanent: false },
      { source: "/login", destination: "/admin", permanent: false },
      { source: "/signup", destination: "/admin", permanent: false },
      { source: "/join/:code", destination: "/play/:code", permanent: false },
      { source: "/participant", destination: "/join", permanent: false },
      { source: "/participant/:path*", destination: "/join", permanent: false },
      { source: "/host/drawing", destination: "/admin", permanent: false },
    ];
  },
};

export default nextConfig;
