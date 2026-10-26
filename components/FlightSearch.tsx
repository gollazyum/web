"use client";

import { useEffect, useRef } from "react";

// Travelpayouts 항공권 검색 위젯. 제휴 값(trs, shmarker, promo_id, campaign_id)은 그대로 두고 색만 로보티 블루로 맞춤
const params = new URLSearchParams({
  currency: "krw",
  trs: "591303",
  shmarker: "795762",
  show_hotels: "true",
  powered_by: "true",
  locale: "ko",
  searchUrl: "search.jetradar.com",
  primary_override: "#1d4ed8",
  color_button: "#1d4ed8",
  color_icons: "#1d4ed8",
  dark: "#0b1220",
  light: "#FFFFFF",
  secondary: "#FFFFFF",
  special: "#C4C4C4",
  color_focused: "#1d4ed8",
  border_radius: "12",
  plain: "false",
  promo_id: "7879",
  campaign_id: "100",
});
const WIDGET_SRC = `https://tpwidg.com/content?${params}`;

export function FlightSearch() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = ref.current;
    if (!box || box.childElementCount > 0) return; // 탭을 오갈 때 중복 생성 방지

    const script = document.createElement("script");
    script.async = true;
    script.charset = "utf-8";
    script.src = WIDGET_SRC;
    box.appendChild(script);
  }, []);

  return (
    <div className="flight-widget">
      <div ref={ref} />
    </div>
  );
}
