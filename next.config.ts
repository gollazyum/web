import type { NextConfig } from "next";

// 대표 주소. lib/site.ts의 url과 같아야 한다
const canonical = "https://www.gollazyum.com";

const nextConfig: NextConfig = {
  async redirects() {
    // 옛 주소(lowboti.com, lowboti.kr), www 없는 gollazyum.com, http:// 접속은 모두 https://www.gollazyum.com 으로 보낸다.
    // Vercel 도메인 설정에서도 처리하지만, 요청이 앱까지 들어온 경우를 위해 여기서도 막는다
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "(www\\.)?lowboti\\.(com|kr)" }],
        destination: `${canonical}/:path*`,
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "gollazyum\\.com" }],
        destination: `${canonical}/:path*`,
        permanent: true,
      },
      {
        source: "/:path*",
        has: [
          { type: "host", value: "www\\.gollazyum\\.com" },
          { type: "header", key: "x-forwarded-proto", value: "http" },
        ],
        destination: `${canonical}/:path*`,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
