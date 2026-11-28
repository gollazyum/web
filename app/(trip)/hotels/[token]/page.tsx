import type { Metadata } from "next";
import { hotelSeed } from "@/lib/hotel-seed-server";
import { ogBase } from "@/lib/site";

// 전용 숙소 상세 페이지. 화면은 (trip)/layout.tsx 의 앱이 주소를 보고 그린다.
// 여기서는 공유 미리보기(카카오톡 등)용 제목·사진과, 새 탭·공유 링크가 바로 그릴 기본 정보만 서버에서 넣는다 (유료 검색 0회)
type Params = { params: Promise<{ token: string }> };

const decode = (t: string) => {
  try {
    return decodeURIComponent(t);
  } catch {
    return t;
  }
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const seed = await hotelSeed(decode((await params).token));
  const title = seed ? seed.name : "숙소 상세";
  const description = seed
    ? `${[seed.stars ? `${seed.stars}성급` : "", seed.rating ? `후기 ${seed.rating.toFixed(1)}점` : ""].filter(Boolean).join(" · ")}${seed.stars || seed.rating ? " · " : ""}예약처별 예상 총액을 한 화면에서 비교하세요(최종 금액은 결제 화면에서 확인).`
    : "예약처별 예상 총액을 한 화면에서 비교하세요(최종 금액은 결제 화면에서 확인).";
  return {
    title,
    description,
    robots: { index: false, follow: true },
    openGraph: { ...ogBase, title, description, ...(seed?.image ? { images: [{ url: seed.image }] } : {}) },
  };
}

export default async function HotelPage({ params }: Params) {
  const seed = await hotelSeed(decode((await params).token));
  if (!seed) return null;
  return <script id="tb-hotel-seed" type="application/json" dangerouslySetInnerHTML={{ __html: JSON.stringify(seed).replace(/</g, "\\u003c") }} />;
}
