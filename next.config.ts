import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Lowboti.kr, www 접속은 메인 도메인 lowboti.com으로 보낸다
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "(www\\.)?lowboti\\.kr" }],
        destination: "https://lowboti.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www\\.lowboti\\.com" }],
        destination: "https://lowboti.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
