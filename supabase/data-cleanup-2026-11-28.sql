-- 2026-11-28 데이터 정리 (도시 키 통일 · 가격 기록 place 채우기 · 사용량 확인).
-- 이 파일은 앱이 실행하지 않는다. 초록이 Supabase SQL Editor에서 직접, 위에서부터 순서대로 실행한다.
-- 0번·3번은 읽기만 하고, 1~2번이 데이터를 바꾼다. 바꾸기 전에 0번 결과를 꼭 한 번 보고 진행한다.

-- ───────────────────────── 0. 지금 상태 보기 (읽기만) ─────────────────────────
-- 0-1. 슬러그가 아닌 city_key 목록
SELECT city_key, count(*) AS hotels
FROM hotels_master
WHERE city_key !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
GROUP BY city_key ORDER BY hotels DESC;

-- 0-2. place가 비어 있는 가격 기록 수
SELECT count(*) AS empty_place_rows FROM hotel_price_history WHERE place IS NULL OR btrim(place) = '';

-- ───────────────────────── 1. hotels_master.city_key → 영어 소문자 슬러그 ─────────────────────────
-- 앱의 lib/city-key.ts 표와 같은 이름 목록 (대표 한글·영문 이름). prio가 작을수록 먼저 맞춘다
BEGIN;

CREATE TEMP TABLE city_alias (name TEXT, slug TEXT, prio INT) ON COMMIT DROP;
INSERT INTO city_alias (name, slug, prio) VALUES
  ('도쿄', 'tokyo', 0),
  ('동경', 'tokyo', 0),
  ('tokyo', 'tokyo', 0),
  ('오사카', 'osaka', 1),
  ('osaka', 'osaka', 1),
  ('후쿠오카', 'fukuoka', 2),
  ('fukuoka', 'fukuoka', 2),
  ('교토', 'kyoto', 3),
  ('kyoto', 'kyoto', 3),
  ('삿포로', 'sapporo', 4),
  ('sapporo', 'sapporo', 4),
  ('오키나와', 'okinawa', 5),
  ('나하', 'okinawa', 5),
  ('okinawa', 'okinawa', 5),
  ('naha', 'okinawa', 5),
  ('방콕', 'bangkok', 6),
  ('bangkok', 'bangkok', 6),
  ('다낭', 'danang', 7),
  ('da nang', 'danang', 7),
  ('danang', 'danang', 7),
  ('나트랑', 'nhatrang', 8),
  ('냐짱', 'nhatrang', 8),
  ('nha trang', 'nhatrang', 8),
  ('nhatrang', 'nhatrang', 8),
  ('타이베이', 'taipei', 9),
  ('타이페이', 'taipei', 9),
  ('taipei', 'taipei', 9),
  ('파리', 'paris', 10),
  ('paris', 'paris', 10),
  ('런던', 'london', 11),
  ('london', 'london', 11),
  ('벳푸', 'beppu', 12),
  ('벳부', 'beppu', 12),
  ('베푸', 'beppu', 12),
  ('beppu', 'beppu', 12),
  ('유후인', 'yufuin', 13),
  ('yufuin', 'yufuin', 13),
  ('오이타', 'oita', 14),
  ('oita', 'oita', 14),
  ('기타큐슈', 'kitakyushu', 15),
  ('키타큐슈', 'kitakyushu', 15),
  ('kitakyushu', 'kitakyushu', 15),
  ('나가사키', 'nagasaki', 16),
  ('nagasaki', 'nagasaki', 16),
  ('구마모토', 'kumamoto', 17),
  ('쿠마모토', 'kumamoto', 17),
  ('kumamoto', 'kumamoto', 17),
  ('가고시마', 'kagoshima', 18),
  ('kagoshima', 'kagoshima', 18),
  ('나고야', 'nagoya', 19),
  ('nagoya', 'nagoya', 19),
  ('고베', 'kobe', 20),
  ('kobe', 'kobe', 20),
  ('나라', 'nara', 21),
  ('nara', 'nara', 21),
  ('요코하마', 'yokohama', 22),
  ('yokohama', 'yokohama', 22),
  ('하코네', 'hakone', 23),
  ('hakone', 'hakone', 23),
  ('히로시마', 'hiroshima', 24),
  ('hiroshima', 'hiroshima', 24),
  ('가나자와', 'kanazawa', 25),
  ('kanazawa', 'kanazawa', 25),
  ('하코다테', 'hakodate', 26),
  ('hakodate', 'hakodate', 26),
  ('오타루', 'otaru', 27),
  ('otaru', 'otaru', 27),
  ('다카마쓰', 'takamatsu', 28),
  ('다카마츠', 'takamatsu', 28),
  ('takamatsu', 'takamatsu', 28),
  ('마쓰야마', 'matsuyama', 29),
  ('마츠야마', 'matsuyama', 29),
  ('matsuyama', 'matsuyama', 29),
  ('시즈오카', 'shizuoka', 30),
  ('shizuoka', 'shizuoka', 30),
  ('서울', 'seoul', 31),
  ('seoul', 'seoul', 31),
  ('부산', 'busan', 32),
  ('busan', 'busan', 32),
  ('제주', 'jeju', 33),
  ('jeju', 'jeju', 33),
  ('강릉', 'gangneung', 34),
  ('gangneung', 'gangneung', 34),
  ('경주', 'gyeongju', 35),
  ('gyeongju', 'gyeongju', 35),
  ('여수', 'yeosu', 36),
  ('yeosu', 'yeosu', 36),
  ('속초', 'sokcho', 37),
  ('sokcho', 'sokcho', 37),
  ('홍콩', 'hong-kong', 38),
  ('hong kong', 'hong-kong', 38),
  ('hongkong', 'hong-kong', 38),
  ('마카오', 'macau', 39),
  ('macau', 'macau', 39),
  ('macao', 'macau', 39),
  ('싱가포르', 'singapore', 40),
  ('싱가폴', 'singapore', 40),
  ('singapore', 'singapore', 40),
  ('상하이', 'shanghai', 41),
  ('상해', 'shanghai', 41),
  ('shanghai', 'shanghai', 41),
  ('베이징', 'beijing', 42),
  ('북경', 'beijing', 42),
  ('beijing', 'beijing', 42),
  ('칭다오', 'qingdao', 43),
  ('qingdao', 'qingdao', 43),
  ('하노이', 'hanoi', 44),
  ('hanoi', 'hanoi', 44),
  ('호치민', 'ho-chi-minh', 45),
  ('호찌민', 'ho-chi-minh', 45),
  ('ho chi minh', 'ho-chi-minh', 45),
  ('hochiminh', 'ho-chi-minh', 45),
  ('saigon', 'ho-chi-minh', 45),
  ('푸꾸옥', 'phu-quoc', 46),
  ('푸쿠옥', 'phu-quoc', 46),
  ('phu quoc', 'phu-quoc', 46),
  ('phuquoc', 'phu-quoc', 46),
  ('달랏', 'dalat', 47),
  ('dalat', 'dalat', 47),
  ('da lat', 'dalat', 47),
  ('치앙마이', 'chiang-mai', 48),
  ('chiang mai', 'chiang-mai', 48),
  ('chiangmai', 'chiang-mai', 48),
  ('푸켓', 'phuket', 49),
  ('phuket', 'phuket', 49),
  ('파타야', 'pattaya', 50),
  ('pattaya', 'pattaya', 50),
  ('가오슝', 'kaohsiung', 51),
  ('kaohsiung', 'kaohsiung', 51),
  ('세부', 'cebu', 52),
  ('cebu', 'cebu', 52),
  ('보라카이', 'boracay', 53),
  ('boracay', 'boracay', 53),
  ('마닐라', 'manila', 54),
  ('manila', 'manila', 54),
  ('발리', 'bali', 55),
  ('bali', 'bali', 55),
  ('쿠알라룸푸르', 'kuala-lumpur', 56),
  ('kuala lumpur', 'kuala-lumpur', 56),
  ('코타키나발루', 'kota-kinabalu', 57),
  ('kota kinabalu', 'kota-kinabalu', 57),
  ('괌', 'guam', 58),
  ('guam', 'guam', 58),
  ('사이판', 'saipan', 59),
  ('saipan', 'saipan', 59),
  ('호놀룰루', 'honolulu', 60),
  ('하와이', 'honolulu', 60),
  ('honolulu', 'honolulu', 60),
  ('hawaii', 'honolulu', 60),
  ('뉴욕', 'new-york', 61),
  ('new york', 'new-york', 61),
  ('로스앤젤레스', 'los-angeles', 62),
  ('엘에이', 'los-angeles', 62),
  ('los angeles', 'los-angeles', 62),
  ('로마', 'rome', 63),
  ('rome', 'rome', 63),
  ('바르셀로나', 'barcelona', 64),
  ('barcelona', 'barcelona', 64),
  ('프라하', 'prague', 65),
  ('prague', 'prague', 65);

-- 1-1. 이름이 그대로 같거나(대소문자·공백 무시) 이름이 들어 있는 값 ('도쿄 신주쿠' → tokyo)
UPDATE hotels_master m
SET city_key = s.slug, updated_at = now()
FROM (
  SELECT DISTINCT ON (h.property_token) h.property_token, a.slug
  FROM hotels_master h
  JOIN city_alias a
    ON lower(regexp_replace(btrim(h.city_key), '\s+', ' ', 'g')) = a.name
    OR (a.name ~ '[가-힣]' AND position(a.name IN lower(h.city_key)) > 0)
    OR (a.name !~ '[가-힣]' AND lower(regexp_replace(btrim(h.city_key), '\s+', ' ', 'g')) ~ ('(^|[^a-z0-9])' || a.name || '($|[^a-z0-9])'))
  WHERE h.city_key !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ORDER BY h.property_token,
           (lower(regexp_replace(btrim(h.city_key), '\s+', ' ', 'g')) = a.name) DESC,
           a.prio
) s
WHERE m.property_token = s.property_token;

-- 1-2. 표에 없는 값: 앱과 같은 규칙으로 (한글은 로마자로 바꾸고) 소문자, 공백·기호는 '-' ('Ho Chi Minh' → ho-chi-minh, '가나다' → ganada)
--      악센트가 있는 영문('San Sebastián' 등)은 여기서 바꾸지 않고 1-3에 남긴다
CREATE FUNCTION pg_temp.romanize(v TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  ini TEXT[] := ARRAY['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h'];
  med TEXT[] := ARRAY['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i'];
  fin TEXT[] := ARRAY['','k','k','k','n','n','n','t','l','k','m','l','l','l','p','l','m','p','p','t','t','ng','t','t','k','t','p','t'];
  out TEXT := '';
  c INT;
BEGIN
  FOR i IN 1..char_length(v) LOOP
    c := ascii(substr(v, i, 1)) - 44032;
    IF c BETWEEN 0 AND 11171 THEN
      out := out || ini[c / 588 + 1] || med[(c % 588) / 28 + 1] || fin[c % 28 + 1];
    ELSE
      out := out || substr(v, i, 1);
    END IF;
  END LOOP;
  RETURN out;
END $$;

UPDATE hotels_master
SET city_key = left(trim(BOTH '-' FROM regexp_replace(lower(pg_temp.romanize(btrim(city_key))), '[^a-z0-9]+', '-', 'g')), 100), updated_at = now()
WHERE city_key !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  AND pg_temp.romanize(btrim(city_key)) ~ '^[ -~]+$'
  AND regexp_replace(lower(pg_temp.romanize(city_key)), '[^a-z0-9]+', '', 'g') <> '';

COMMIT;

-- 1-3. 아직 남은 값 확인 (보통 0줄. 악센트가 있는 영문 같은 값이 남으면 결과를 Claude에게 붙여 주세요. 그 값만 바꾸는 SQL을 만들어 드려요)
SELECT city_key, count(*) FROM hotels_master WHERE city_key !~ '^[a-z0-9]+(-[a-z0-9]+)*$' GROUP BY 1 ORDER BY 2 DESC;

-- ───────────────────────── 2. hotel_price_history.place 빈 칸 채우기 ─────────────────────────
-- 1번을 먼저 실행해야 슬러그로 채워진다
UPDATE hotel_price_history h
SET place = m.city_key
FROM hotels_master m
WHERE m.property_token = h.property_token
  AND (h.place IS NULL OR btrim(h.place) = '');

-- 확인: 남은 빈 칸 (hotels_master에 없는 숙소라 채울 수 없는 줄)
SELECT count(*) AS still_empty FROM hotel_price_history WHERE place IS NULL OR btrim(place) = '';

-- ───────────────────────── 3. 사용량 확인 (읽기만) ─────────────────────────
SELECT usage_date, paid_check_count, updated_at FROM daily_api_usage ORDER BY usage_date DESC LIMIT 7;
