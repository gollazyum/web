import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "Gollazyum의 개인정보 수집 항목과 이용 목적, 외부 예약 사이트 이동 시 쿠키 처리 안내입니다.",
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return (
    <>
      <SiteHeader />
      <main className="wrap legal">
        <h1>개인정보처리방침</h1>
        <p>Gollazyum(이하 “서비스”)은 현재 회원가입 없이 이용할 수 있으며, 이름·연락처 등 개인정보를 직접 수집하지 않습니다.</p>
        <h2>브라우저에 저장하는 정보</h2>
        <p>
          Gollazyum은 로그인 없이도 이어서 이용하실 수 있도록 최근 검색 조건(목적지·날짜·인원), 보관함, 취향 설정을 이용자의
          브라우저(로컬 저장소)에만 저장합니다. 이 저장 내용은 그 자체로 회사 서버에 올려 두지 않습니다. 다만 숙소나 항공권을 검색하면
          입력한 조건은 가격을 조회하기 위해 서버로 전송됩니다. AI에게 보낸 대화는 답변을 만들기 위해 서버와 AI 제공자에게 전송되며,
          브라우저에 따로 저장하지 않아 화면을 닫으면 남지 않습니다. 호텔 후기 주제 숫자는 비교 화면에 다시 쓰려고 브라우저에 최대 7일
          보관했다가 자동으로 지웁니다. 이용자는 언제든 홈 화면 이어서 보기 배너의 &apos;기록 지우기&apos; 버튼이나 브라우저 설정에서
          저장된 정보를 삭제할 수 있습니다.
        </p>
        <h2>자동으로 수집될 수 있는 정보</h2>
        <p>
          서비스 개선을 위해 방문 기록, 브라우저 종류 같은 접속 정보가 수집될 수 있습니다. Gollazyum의 링크를 통해 예약 사이트로
          이동하면, 해당 사이트가 제휴 수수료 정산을 위해 쿠키를 사용할 수 있으며 이는 각 사이트의 개인정보처리방침을 따릅니다.
        </p>
        <h2>문의</h2>
        <p>
          {site.contactEmail ? (
            <>
              개인정보 관련 문의: <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>
            </>
          ) : (
            "문의처는 서비스 오픈 시 안내됩니다."
          )}
        </p>
        <p className="muted">시행일: 2026년 10월 31일</p>
      </main>
      <SiteFooter />
    </>
  );
}
