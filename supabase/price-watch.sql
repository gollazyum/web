-- 가격 지킴이 1단계 (예약한 숙소 가격 지켜보기). Supabase SQL Editor에 붙여 넣고 실행한다. 여러 번 실행해도 안전하다.
-- 실행 전에 할 일: Supabase → Project Settings → Vault 에서 이름 'cron_secret' 으로 Vercel의 CRON_SECRET 과 같은 값을 저장한다.
-- 서버만 SUPABASE_SERVICE_ROLE_KEY로 쓴다. RLS를 켜고 정책을 두지 않아 브라우저(anon) 키로는 읽기·쓰기가 모두 막힌다.

-- 1. 지켜보는 예약
CREATE TABLE IF NOT EXISTS watched_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token TEXT NOT NULL,                     -- 이 기기에서 만든 임의 번호 (로그인 없음, 개인을 알 수 있는 값이 아님)
  property_token TEXT NOT NULL,
  hotel_name TEXT NOT NULL,
  place TEXT,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  adults INT NOT NULL CHECK (adults BETWEEN 1 AND 9),
  booked_price INT NOT NULL CHECK (booked_price > 0), -- 사용자가 입력한 결제 총액 (원, 전체 숙박)
  booked_vendor TEXT,
  free_cancel_until TIMESTAMPTZ,                  -- 무료 취소 마감 (모르면 null → 체크인 전날 18시 기준)
  watch_until TIMESTAMPTZ NOT NULL,               -- 지켜보기 끝 (마감 6시간 전)
  latest_lowest_price INT,
  latest_lowest_vendor TEXT,
  latest_free_cancel BOOLEAN,                     -- 최저가 예약처가 무료 취소라고 확인된 경우만 true, 모르면 null
  last_alerted_price INT,
  alerted_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  next_check_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'stopped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_watched_due ON watched_bookings (status, next_check_at);
CREATE INDEX IF NOT EXISTS idx_watched_device ON watched_bookings (device_token, status);
ALTER TABLE watched_bookings ENABLE ROW LEVEL SECURITY;

-- 2. 하루 유료 가격 조회 횟수 (한국 날짜)
CREATE TABLE IF NOT EXISTS daily_api_usage (
  usage_date DATE PRIMARY KEY,
  paid_check_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE daily_api_usage ENABLE ROW LEVEL SECURITY;

-- 조회하기 직전에 먼저 1 올리고 올린 값을 돌려준다 (여러 곳이 동시에 불러도 상한을 넘지 않게)
CREATE OR REPLACE FUNCTION increment_daily_api_usage(target_date DATE, delta INT DEFAULT 1)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INT;
BEGIN
  INSERT INTO daily_api_usage (usage_date, paid_check_count, updated_at)
  VALUES (target_date, delta, now())
  ON CONFLICT (usage_date)
  DO UPDATE SET paid_check_count = daily_api_usage.paid_check_count + delta, updated_at = now()
  RETURNING paid_check_count INTO new_count;
  RETURN new_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION increment_daily_api_usage(DATE, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_daily_api_usage(DATE, INT) TO service_role;

-- 최근 Supabase 프로젝트는 SQL로 만든 테이블에 서버 키(service_role) 권한을 자동으로 주지 않을 수 있다 (없으면 403)
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON watched_bookings, daily_api_usage TO service_role;

-- 3. 15분마다 가격 확인 (Supabase Cron). 비밀값은 Vault의 cron_secret
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('price-watch-every-15m');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'price-watch-every-15m',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://www.gollazyum.com/api/cron/check-prices',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
