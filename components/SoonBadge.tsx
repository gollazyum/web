"use client";

import { useEffect, useState } from "react";

// 아직 열리지 않은 기능에 붙이는 '준비 중' 배지. 누르면 잠깐 '곧 만나요!'로 바뀌고 다른 곳으로 가지 않는다
export function SoonBadge() {
  const [hi, setHi] = useState(false);

  useEffect(() => {
    if (!hi) return;
    const t = setTimeout(() => setHi(false), 2000);
    return () => clearTimeout(t);
  }, [hi]);

  return (
    <button type="button" className="badge soon-badge soon-btn" onClick={() => setHi(true)} aria-live="polite">
      {hi ? "곧 만나요! 👋" : "준비 중"}
    </button>
  );
}
