import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // lowboti.kr 접속은 메인 도메인 www.lowboti.com으로 보낸다
    // (lowboti.com → www.lowboti.com 리디렉트는 Vercel 도메인 설정에서 처리)
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "(www\\.)?lowboti\\.kr" }],
        destination: "https://www.lowboti.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
