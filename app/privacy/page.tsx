import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "개인정보처리방침 | Lowboti" };

export default function Privacy() {
  return (
    <main className="wrap legal">
      <Link href="/" aria-label="Lowboti 홈">
        <Logo height={28} />
      </Link>
      <h1>개인정보처리방침</h1>
      <p>Lowboti(이하 “로보티”)는 현재 회원가입 없이 이용할 수 있으며, 이름·연락처 등 개인정보를 직접 수집하지 않습니다.</p>
      <h2>자동으로 수집될 수 있는 정보</h2>
      <p>
        서비스 개선을 위해 방문 기록, 브라우저 종류 같은 접속 정보가 수집될 수 있습니다. 로보티의 링크를 통해 예약 사이트로
        이동하면, 해당 사이트가 제휴 수수료 정산을 위해 쿠키를 사용할 수 있으며 이는 각 사이트의 개인정보처리방침을 따릅니다.
      </p>
      <h2>문의</h2>
      <p>{site.contactEmail ? `개인정보 관련 문의: ${site.contactEmail}` : "문의처는 서비스 오픈 시 안내됩니다."}</p>
      <p className="muted">시행일: 2026년 10월 25일</p>
    </main>
  );
}
