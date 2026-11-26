-- 숙소 고정 정보 카탈로그 (검색에 나온 숙소의 좌표·이름·성급·평점·사진). 2026-11-26 초록이 Supabase에서 실행함.
-- 서버(lib/hotels-master.ts)가 SUPABASE_SERVICE_ROLE_KEY로만 읽고 쓴다. 공개 정책 없음.
CREATE TABLE IF NOT EXISTS public.hotels_master (
  property_token text PRIMARY KEY,
  city_key text NOT NULL,
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  star_rating integer,
  rating numeric(3,1),
  reviews_count integer,
  thumbnail_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hotels_master_city_key ON public.hotels_master (city_key);
ALTER TABLE public.hotels_master ENABLE ROW LEVEL SECURITY;

-- 새 Supabase 프로젝트는 SQL로 만든 표에 service_role 권한이 자동으로 붙지 않는다 (없으면 403)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hotels_master TO service_role;
