import type { ReactNode } from "react";

// 없는 페이지·오류 화면이 같이 쓰는 틀. 로고 마크 하나와 글자만 쓰는 가벼운 화면이다.
// 서버 화면(not-found)과 클라이언트 화면(error) 양쪽에서 쓰므로 훅이나 서버 전용 코드를 넣지 않는다
export function StatusScreen({ icon, title, message, children }: { icon: string; title: string; message: string; children: ReactNode }) {
  return (
    <main className="status-screen">
      <div className="status-card">
        <a href="/" className="status-brand" aria-label="Gollazyum 홈">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/gollazyum-mark.svg" alt="" width={36} height={36} />
          <span>Gollazyum</span>
        </a>
        <p className="status-icon" aria-hidden="true">
          {icon}
        </p>
        <h1>{title}</h1>
        <p className="status-message">{message}</p>
        <nav className="status-actions" aria-label="이동할 곳">
          {children}
        </nav>
      </div>
    </main>
  );
}
