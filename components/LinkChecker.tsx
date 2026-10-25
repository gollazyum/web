"use client";

import { useState } from "react";
import { detectSite, site, supportedSites } from "@/lib/site";

type Result = { kind: "ok"; siteName: string } | { kind: "unknown" } | { kind: "invalid" };

export function LinkChecker() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^https?:\/\//i.test(url.trim())) {
      setResult({ kind: "invalid" });
      return;
    }
    const siteName = detectSite(url);
    setResult(siteName ? { kind: "ok", siteName } : { kind: "unknown" });
  }

  return (
    <div className="checker">
      <form onSubmit={onSubmit} className="checker-form">
        <input
          type="url"
          inputMode="url"
          placeholder="보고 있던 호텔 링크를 붙여넣어 보세요"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-label="호텔 링크"
        />
        <button type="submit">최저가 찾기</button>
      </form>
      <p className="checker-sites">
        비교 예정 사이트: {supportedSites.map((s) => s.name).join(" · ")}
      </p>
      {result && (
        <div className="checker-result" role="status">
          {result.kind === "ok" && (
            <>
              <strong>{result.siteName} 링크를 알아봤어요!</strong>
              <span>
                가격 비교 기능은 곧 오픈해요. 오픈하면 이 링크로 바로 최저가를 찾아드릴게요.
                {site.instagramUrl && (
                  <>
                    {" "}
                    <a href={site.instagramUrl} target="_blank" rel="noopener noreferrer">
                      인스타그램에서 오픈 소식 받기
                    </a>
                  </>
                )}
              </span>
            </>
          )}
          {result.kind === "unknown" && (
            <span>아직 이 사이트는 비교 목록에 없어요. 아고다, 부킹닷컴 같은 예약 사이트의 호텔 링크를 넣어 주세요.</span>
          )}
          {result.kind === "invalid" && <span>https:// 로 시작하는 링크를 붙여넣어 주세요.</span>}
        </div>
      )}
    </div>
  );
}
