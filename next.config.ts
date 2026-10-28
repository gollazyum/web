import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // lowboti.kr, lowboti.com(www 없이), http:// 접속은 모두 https://www.lowboti.com 으로 보낸다.
    // Vercel 도메인 설정에서도 처리하지만, 요청이 앱까지 들어온 경우를 위해 여기서도 막는다
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "lowboti\\.com" }],
        destination: "https://www.lowboti.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [
          { type: "host", value: "www\\.lowboti\\.com" },
          { type: "header", key: "x-forwarded-proto", value: "http" },
        ],
        destination: "https://www.lowboti.com/:path*",
        permanent: true,
      },
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
