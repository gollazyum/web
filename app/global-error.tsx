"use client";

import { useEffect } from "react";

// 루트 레이아웃 자체에서 오류가 나면 레이아웃 대신 이 화면이 통째로 그려진다.
// 그래서 html·body를 직접 넣고, 레이아웃의 CSS·글꼴·공용 컴포넌트에 기대지 않도록 스타일을 이 파일 안에 둔다.
// 오류 내용(error.message 등)은 화면에 보여 주지 않는다
const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Pretendard",-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic","맑은 고딕",system-ui,sans-serif;color:#1c2738;background:#f4f6fb;line-height:1.6;letter-spacing:-0.01em;word-break:keep-all;-webkit-font-smoothing:antialiased}
.ge{min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:32px 16px}
.ge-card{width:100%;max-width:440px;background:#fff;border:1px solid #e6e9f0;border-radius:20px;padding:36px 24px 28px;text-align:center;box-shadow:0 12px 32px rgba(11,18,32,.06)}
.ge-brand{display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:20px;color:#0b1220;text-decoration:none;letter-spacing:-0.03em}
.ge-icon{font-size:40px;line-height:1;margin:24px 0 12px}
h1{font-size:22px;font-weight:700;color:#0b1220}
.ge-msg{margin-top:8px;font-size:15px;color:#66728a}
.ge-actions{margin-top:24px;display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.ge-btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;min-width:120px;padding:0 20px;border-radius:999px;border:1px solid #e6e9f0;background:#fff;color:#1c2738;font:inherit;font-size:15px;font-weight:700;text-decoration:none;cursor:pointer}
.ge-btn.primary{background:#1d4ed8;border-color:#1d4ed8;color:#fff}
.ge-btn:hover{border-color:#1d4ed8}
.ge-btn:focus-visible,.ge-brand:focus-visible{outline:3px solid #0ea5e9;outline-offset:3px}
@media (max-width:400px){.ge-actions{flex-direction:column}.ge-btn{width:100%}}
`;

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // 다시 시도: 오류 화면을 걷어 내고(reset) 레이아웃을 서버에서 새로 받도록 화면을 다시 불러온다.
  // 레이아웃이 통째로 실패한 상태라 reset()만으로는 서버 쪽 오류가 풀리지 않는다
  const retry = () => {
    reset();
    window.location.reload();
  };

  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <title>잠시 문제가 생겼어요 | Gollazyum</title>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>
        <main className="ge">
          <div className="ge-card">
            <a href="/" className="ge-brand" aria-label="Gollazyum 홈">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/gollazyum-mark.svg" alt="" width={32} height={32} />
              <span>Gollazyum</span>
            </a>
            <p className="ge-icon" aria-hidden="true">
              🛠️
            </p>
            <h1>잠시 문제가 생겼어요</h1>
            <p className="ge-msg">화면을 불러오는 중에 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.</p>
            <nav className="ge-actions" aria-label="이동할 곳">
              <button type="button" className="ge-btn primary" onClick={retry}>
                다시 시도
              </button>
              <a href="/" className="ge-btn">
                홈으로
              </a>
            </nav>
          </div>
        </main>
      </body>
    </html>
  );
}
