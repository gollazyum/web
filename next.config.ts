import type { NextConfig } from "next";

// 대표 주소. lib/site.ts의 url과 같아야 한다
const canonical = "https://www.gollazyum.com";

// 보안 헤더 (모든 화면·API)
// CSP: 제휴 스크립트(Travelpayouts Drive, emrldtp.com)가 어느 주소에서 추가 스크립트·요청을 부르는지 바뀔 수 있어
// 스크립트·요청·프레임 주소는 https 전체를 허용하고, 대신 http·플러그인(object)·<base> 바꿔치기·다른 사이트에 끼워 넣기(frame-ancestors)·
// 외부로 폼 보내기는 막는다. Next가 페이지에 넣는 인라인 스크립트 때문에 'unsafe-inline'이 필요하다.
// 개발 서버(next dev)는 eval을 쓰므로 그때만 'unsafe-eval'을 더한다
const dev = process.env.NODE_ENV !== "production";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} https:`,
  "style-src 'self' 'unsafe-inline' https:",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  `connect-src 'self' https:${dev ? " ws:" : ""}`,
  "frame-src https:",
  "media-src 'self' https:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 카메라·마이크·위치·결제 등은 지금 쓰지 않는다. 음성 모드나 '지금' 탭에서 쓰게 되면 그 항목만 (self)로 연다
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()" },
  { key: "X-Frame-Options", value: "DENY" },
  // Vercel이 기본으로 붙이는 Access-Control-Allow-Origin: * 대신 우리 주소만 (다른 사이트가 화면·API 응답을 읽어 가지 못하게)
  { key: "Access-Control-Allow-Origin", value: canonical },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // 공유 미리보기를 만드는 봇에게는 og 태그를 <head>에 바로 넣어 보낸다 (스트리밍하면 못 읽는다).
  // 카카오톡(kakaotalk-scrap), 네이버(Yeti), 페이스북·트위터·슬랙 등
  htmlLimitedBots: /kakaotalk-scrap|kakaostory-og-reader|Kakao|Yeti|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|TelegramBot|SkypeUriPreview|bingbot|Googlebot|applebot/i,
  async redirects() {
    // 옛 주소(lowboti.com, lowboti.kr), www 없는 gollazyum.com, http:// 접속은 모두 https://www.gollazyum.com 으로 보낸다.
    // Vercel 도메인 설정에서도 처리하지만, 요청이 앱까지 들어온 경우를 위해 여기서도 막는다
    return [
      // 1차 여행 앱 오픈 동안 쇼핑 화면은 숨긴다 (서버 API /api/shopping 과 코드는 그대로 둔다). 다시 열려면 이 두 줄을 지운다
      { source: "/shop", destination: "/", permanent: false },
      { source: "/shop/:path*", destination: "/", permanent: false },
      // 예전 결과 페이지는 새 앱 홈으로 보낸다. 검색 조건(?q=&checkin=…, ?from=&to=…)은 그대로 따라가서 같은 검색이 열린다
      { source: "/hotels", destination: "/", permanent: true },
      { source: "/flights", destination: "/?tab=flight", permanent: true },
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
