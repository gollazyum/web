-- 홈 첫 화면 '실제 검색 예시' 카드용: 숙소 한 곳의 예약처별 세금 포함 총액 스냅샷.
-- 상세 페이지·목록에서 예약처 가격을 새로 받았을 때(허용 예약처 3곳 이상, 성인만, 아이 없는 검색) 서버가 한 줄 남긴다.
-- 서버(lib/seller-snapshot.ts)가 SUPABASE_SERVICE_ROLE_KEY로만 읽고 쓴다. 공개 정책 없음.
CREATE TABLE IF NOT EXISTS public.seller_snapshots (
  id bigserial PRIMARY KEY,
  property_token text NOT NULL,
  hotel_name text NOT NULL,
  place text,
  check_in date NOT NULL,
  check_out date NOT NULL,
  adults integer NOT NULL,
  sellers jsonb NOT NULL,          -- [{"key":"booking","cost":238943,"fc":true}, ...] 총액 낮은 순
  seller_count integer NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seller_snapshots_recent ON public.seller_snapshots (recorded_at DESC);
ALTER TABLE public.seller_snapshots ENABLE ROW LEVEL SECURITY;

-- 새 Supabase 프로젝트는 SQL로 만든 표에 service_role 권한이 자동으로 붙지 않는다 (없으면 403)
GRANT SELECT, INSERT, DELETE ON public.seller_snapshots TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.seller_snapshots_id_seq TO service_role;
