"use client";

import { startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { StatusScreen } from "@/components/StatusScreen";

// 화면을 그리다 오류가 나면 보이는 화면. 오류 내용(error.message 등)은 화면에 보여 주지 않는다
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    // 원인 파악용으로 브라우저 콘솔에만 남긴다 (운영에서는 Next가 서버 오류 내용을 이미 가려서 보낸다)
    console.error(error);
  }, [error]);

  // 다시 시도: 서버에서 난 오류도 풀리도록 서버 데이터를 새로 받고(refresh) 오류 화면을 걷어 낸다(reset)
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });

  return (
    <StatusScreen icon="🛠️" title="잠시 문제가 생겼어요" message="화면을 불러오는 중에 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.">
      <button type="button" className="status-btn primary" onClick={retry}>
        다시 시도
      </button>
      <a href="/" className="status-btn">
        홈으로
      </a>
    </StatusScreen>
  );
}
