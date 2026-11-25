-- 숙소 가격 기록 (평소 가격 비교용). Supabase SQL Editor에 한 번 붙여 넣고 실행한다. 여러 번 실행해도 안전하다.
-- 서버만 SUPABASE_SERVICE_ROLE_KEY로 쓴다. RLS를 켜고 정책을 두지 않아 브라우저(anon) 키로는 읽기·쓰기가 모두 막힌다.

CREATE TABLE IF NOT EXISTS hotel_price_history (
  id BIGSERIAL PRIMARY KEY,
  property_token TEXT NOT NULL,
  hotel_name TEXT NOT NULL,
  place TEXT,                                  -- 검색한 목적지 글자 (상세 조회는 null)
  stay_date DATE NOT NULL,                     -- 체크인 날짜
  nights INT NOT NULL CHECK (nights BETWEEN 1 AND 30),
  adults INT NOT NULL CHECK (adults BETWEEN 1 AND 9),
  is_weekend BOOLEAN NOT NULL,                 -- 체크인이 금·토요일
  lead_days INT NOT NULL,                      -- 기록한 날부터 체크인까지 남은 날 (한 달 전 가격과 3일 전 가격을 나눠 보기 위해)
  price_kind TEXT NOT NULL CHECK (price_kind IN ('list', 'verified')), -- list: 목록 예상가, verified: 예약처에서 확인한 가격
  nightly_krw INT NOT NULL CHECK (nightly_krw > 0), -- 1객실 1박 금액 (원)
  total_krw INT,                               -- 1객실 전체 숙박 총액 (원, 없으면 null)
  best_vendor TEXT,                            -- 가장 싼 예약처 (목록 예상가처럼 확인 안 된 경우 null)
  is_refundable BOOLEAN DEFAULT NULL,          -- 무료 취소가 확인된 경우만 true, 모르면 null
  recorded_at DATE NOT NULL,                   -- 기록한 날 (한국 날짜)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT hotel_price_history_day_key UNIQUE (property_token, stay_date, nights, adults, price_kind, recorded_at)
);

CREATE INDEX IF NOT EXISTS idx_price_history_lookup ON hotel_price_history (property_token, adults, stay_date);

ALTER TABLE hotel_price_history ENABLE ROW LEVEL SECURITY;

-- 여러 숙소를 한 번에 저장한다. 같은 숙소·날짜·박 수·인원·종류·기록일이면 1행만 두고, 더 싼 가격이 들어올 때만 바꾼다
CREATE OR REPLACE FUNCTION record_hotel_prices(rows JSONB)
RETURNS VOID
LANGUAGE sql
SET search_path = public
AS $$
  INSERT INTO hotel_price_history AS h
    (property_token, hotel_name, place, stay_date, nights, adults, is_weekend, lead_days, price_kind,
     nightly_krw, total_krw, best_vendor, is_refundable, recorded_at)
  SELECT DISTINCT ON (r.property_token, r.stay_date, r.nights, r.adults, r.price_kind, r.recorded_at)
    r.property_token, r.hotel_name, r.place, r.stay_date, r.nights, r.adults, r.is_weekend, r.lead_days, r.price_kind,
    r.nightly_krw, r.total_krw, r.best_vendor, r.is_refundable, r.recorded_at
  FROM jsonb_to_recordset(rows) AS r(
    property_token TEXT, hotel_name TEXT, place TEXT, stay_date DATE, nights INT, adults INT, is_weekend BOOLEAN,
    lead_days INT, price_kind TEXT, nightly_krw INT, total_krw INT, best_vendor TEXT, is_refundable BOOLEAN, recorded_at DATE)
  ORDER BY r.property_token, r.stay_date, r.nights, r.adults, r.price_kind, r.recorded_at, r.nightly_krw
  ON CONFLICT ON CONSTRAINT hotel_price_history_day_key DO UPDATE SET
    nightly_krw = EXCLUDED.nightly_krw,
    total_krw = EXCLUDED.total_krw,
    best_vendor = EXCLUDED.best_vendor,
    is_refundable = EXCLUDED.is_refundable,
    lead_days = EXCLUDED.lead_days,
    updated_at = now()
  WHERE EXCLUDED.nightly_krw < h.nightly_krw;
$$;

REVOKE ALL ON FUNCTION record_hotel_prices(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION record_hotel_prices(JSONB) TO service_role;

-- 최근 Supabase 프로젝트는 SQL로 만든 테이블에 서버 키(service_role) 권한을 자동으로 주지 않을 수 있다 (없으면 403)
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON hotel_price_history TO service_role;
GRANT ALL ON SEQUENCE hotel_price_history_id_seq TO service_role;
