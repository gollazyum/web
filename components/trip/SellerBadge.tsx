// 예약처 첫 글자 배지 (2026-11-27 PR 3/3: 예약처 표에서 분리)
// 로고 이미지는 아직 쓰지 않는다. 글자 배지는 꾸밈이라 화면 읽기 프로그램에는 숨기고, 옆의 예약처 이름을 읽게 한다
// TODO(logo): 각 예약처에서 로고 사용 허락을 받으면 public/sellers/{key}.svg 를 두고 여기서 <img alt=""> 로 바꾼다

const TONE: Record<string, string> = {
  agoda: "#5B4BDB",
  trip: "#287DFA",
  expedia: "#1B2E5A",
  hotels: "#D32F2F",
  booking: "#003B95",
  yanolja: "#FF3478",
  yeogi: "#E6007E",
  interpark: "#6A3DF0",
  myrealtrip: "#0BB3E6",
  rakuten: "#BF0000",
  klook: "#FF5B00",
  official: "#18202B",
};

// 원형 배지 안 글자: 영문 이니셜 (한글 첫 글자보다 정돈돼 보인다)
const BADGE: Record<string, string> = {
  expedia: "EX",
  hotels: "H",
  booking: "B.",
  agoda: "AG",
  trip: "TR",
  yanolja: "Y",
  yeogi: "여기",
  interpark: "NOL",
  myrealtrip: "MRT",
  rakuten: "R",
  klook: "K",
  official: "공식",
};

export function SellerBadge({ sellerKey, ko }: { sellerKey: string; ko: string }) {
  return (
    <span className="tb-seller-badge" style={{ background: TONE[sellerKey] ?? "#5F5E59" }} aria-hidden>
      {BADGE[sellerKey] ?? ko.slice(0, 1)}
    </span>
  );
}
