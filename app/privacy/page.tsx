import type { Metadata } from "next";
import { brandCopy } from "@/lib/brand-mode";
import { PageFooter, PageHeader } from "@/components/PageShell";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "Gollazyum의 개인정보 수집 항목과 이용 목적, 처리 위탁·국외 이전, 보유 기간, 이용자 권리 안내입니다.",
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return (
    <div className="pg">
      <PageHeader />
      <main className="pg-wrap legal">
        <h1>개인정보처리방침</h1>
        <p>Gollazyum(이하 “서비스”)은 현재 회원가입 없이 이용할 수 있으며, 이름·연락처 등 개인정보를 직접 수집하지 않습니다.</p>
        <h2>브라우저에 저장하는 정보</h2>
        <p>
          Gollazyum은 로그인 없이도 이어서 이용하실 수 있도록 최근 검색 조건(목적지·날짜·인원), 보관함, 취향 설정을 이용자의
          브라우저(로컬 저장소)에만 저장합니다. 이 저장 내용은 그 자체로 회사 서버에 올려 두지 않습니다. 다만 숙소나 항공권을 검색하면
          입력한 조건은 가격을 조회하기 위해 서버로 전송됩니다. AI에게 보낸 대화는 답변을 만들기 위해 서버와 AI 제공자에게 전송되며,
          브라우저에 따로 저장하지 않아 화면을 닫으면 남지 않습니다. {brandCopy("privacyReviewTopics")} 브라우저에 최대 7일
          보관했다가 자동으로 지웁니다. 이용자는 언제든 마이 화면 맨 아래의 &apos;기록 지우기&apos; 버튼이나 브라우저 설정에서
          저장된 정보를 삭제할 수 있습니다.
        </p>
        <h2>자동으로 수집될 수 있는 정보</h2>
        <p>
          서비스 개선을 위해 방문 기록, 브라우저 종류 같은 접속 정보가 수집될 수 있습니다. Gollazyum의 링크를 통해 예약 사이트로
          이동하면, 해당 사이트가 제휴 수수료 정산을 위해 쿠키를 사용할 수 있으며 이는 각 사이트의 개인정보처리방침을 따릅니다.
        </p>
        <h2>제휴 링크 스크립트와 쿠키</h2>
        <p>
          Gollazyum의 모든 화면에는 제휴 마케팅 서비스 Travelpayouts의 &lsquo;Travelpayouts Drive&rsquo; 스크립트(emrldtp.com에서
          불러옴)가 함께 로드됩니다. 이 스크립트는 예약 사이트로 가는 링크를 제휴 링크로 바꾸고 수수료 정산을 위해 링크 클릭과 예약
          전환을 추적합니다. 이 과정에서 IP 주소, 브라우저·기기 정보, 방문한 페이지 주소, 누른 링크 같은 접속 정보가 Travelpayouts로
          전송되고, 이용자의 브라우저에 쿠키 또는 이와 비슷한 저장 정보가 저장될 수 있습니다. 브라우저 설정에서 쿠키를 거부하거나
          삭제할 수 있으며, 거부해도 검색과 예약 사이트 이동은 그대로 이용할 수 있습니다. 자세한 처리 방식은 Travelpayouts의
          개인정보처리방침을 따릅니다.
        </p>
        <h2>개인정보 처리 위탁 및 국외 이전</h2>
        <p>서비스 제공을 위해 아래 업체에 개인정보 처리를 위탁하며, 이 과정에서 정보가 국외로 이전됩니다.</p>
        <ol>
          <li>Vercel Inc. / 미국 / 웹사이트 호스팅, 접속 기록 처리</li>
          <li>Anthropic, PBC / 미국 / AI 대화 답변 생성(이용자가 입력한 대화 내용)</li>
          <li>Travelpayouts / 홍콩 / 제휴 링크 변환, 클릭·예약 전환 추적과 수수료 정산(IP 주소, 브라우저·기기 정보, 방문 페이지, 누른 링크, 쿠키 식별자)</li>
        </ol>
        <p>
          이전 시기·방법: 서비스 이용 시 네트워크로 전송됩니다. 보유 기간: 처리 목적 달성 시까지 또는 수탁사 정책에 따릅니다.
        </p>
        <h2>개인정보 보호책임자</h2>
        <p>
          담당: {site.business.privacyOfficer}
          <br />
          연락처: <a href="mailto:gollazyum@gmail.com">gollazyum@gmail.com</a>
        </p>
        <h2>보유 기간 및 파기</h2>
        <p>
          브라우저에 저장된 정보(검색 조건, 보관함, 취향 등)는 이용자가 마이 화면의 &apos;기록 지우기&apos;로 직접 지우거나 정해진 기간이 지나면
          자동으로 만료됩니다. 서버 접속 기록은 호스팅 업체의 보관 기간이 지나면 파기됩니다.
        </p>
        <h2>이용자의 권리와 행사 방법</h2>
        <p>
          이용자는 언제든 자신의 개인정보에 대해 열람, 정정, 삭제, 처리 정지를 요청할 수 있습니다. 요청은 위 이메일
          (<a href="mailto:gollazyum@gmail.com">gollazyum@gmail.com</a>)로 받으며, 지체 없이 처리합니다.
        </p>
        <h2>AI 대화 이용 시 유의사항</h2>
        <p>
          AI 대화 내용은 답변 생성을 위해 외부 AI 서비스로 전송됩니다. 이름·연락처 같은 개인정보는 대화창에 입력하지 마세요.
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
        <p className="muted">시행일: 2026년 11월 17일</p>
      </main>
      <PageFooter />
    </div>
  );
}
