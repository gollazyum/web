import type { NextConfig } from "next";

// 대표 주소. lib/site.ts의 url과 같아야 한다
const canonical = "https://www.gollazyum.com";

const nextConfig: NextConfig = {
  // 공유 미리보기를 만드는 봇에게는 og 태그를 <head>에 바로 넣어 보낸다 (스트리밍하면 못 읽는다).
  // 카카오톡(kakaotalk-scrap), 네이버(Yeti), 페이스북·트위터·슬랙 등
  htmlLimitedBots: /kakaotalk-scrap|kakaostory-og-reader|Kakao|Yeti|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|TelegramBot|SkypeUriPreview|bingbot|Googlebot|applebot/i,
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
