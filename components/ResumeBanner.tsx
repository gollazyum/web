"use client";

import Link from "next/link";
import { addDays, daysBetween, today } from "@/lib/dates";
import { hotelsPath } from "@/lib/hotels";
import { hotelNameKo } from "@/lib/hotelText";
import { useLowbotiStore, type SearchParams } from "@/lib/lowbotiStore";

// 홈 검색창 아래 '지난번에 비교하던 숙소' 배너 (가입 없이 lowboti:v1만 본다).
// 홈에 올 때마다 가격을 부르지 않는다. 저장해 둔 이름·사진·담은 시점 가격만 보여 주고,
// '오늘 가격으로 이어서 보기'를 눌렀을 때만 검색(과 비교)을 다시 한다
export function ResumeBanner() {
  const { compare, lastSearch } = useLowbotiStore();
  const latest = [...compare].sort((a, b) => b.addedAt - a.addedAt)[0];
  const base: SearchParams | null = latest?.searchParams ?? lastSearch;
  if (!base) return null;

  // 지난 날짜면 같은 박 수로 내일부터 다시 찾는다
  const past = base.checkin < today();
  const nights = Math.max(1, daysBetween(base.checkin, base.checkout));
  const checkIn = past ? addDays(today(), 1) : base.checkin;
  const href =
    hotelsPath({ q: base.q, checkIn, checkOut: addDays(checkIn, nights), adults: base.adults }) + (compare.length >= 2 ? "&compare=1" : "");
  const city = base.q;

  return (
    <div className="resume">
      <div className="resume-text">
        <strong>
          🤖{" "}
          {compare.length
            ? `지난번에 담아 둔 ${city} 숙소 ${compare.length}곳이 남아 있어요`
            : `지난번에 찾던 ${city} 숙소, 이어서 볼까요?`}
        </strong>
        {compare.length > 0 && (
          <ul className="resume-list">
            {compare.map((c) => (
              <li key={c.token}>
                {c.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.thumbnail} alt="" />
                ) : null}
                <span>{hotelNameKo(c.name)}</span>
                {c.perNight !== null && <em>담을 때 1박 {c.perNight.toLocaleString("ko-KR")}원</em>}
              </li>
            ))}
          </ul>
        )}
        {past && <small>지난 날짜라 같은 {nights}박으로 내일부터 찾아볼게요.</small>}
      </div>
      <Link className="resume-go" href={href}>
        🔄 오늘 가격으로 이어서 보기
      </Link>
    </div>
  );
}
