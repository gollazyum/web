import "server-only";
import { sb, supabaseOn } from "@/lib/supabase-server";
import { type AmenityKind, type Amenities, type AmenityItem, gridKey, parseOverpass } from "@/lib/amenity-shape";

// 숙소 상세 페이지 '도보 5분 내 편의점·약국·병원'. OpenStreetMap(Overpass)에서 반경 400m만 한 번 찾고
// nearby_amenities_cache에 30일 저장한다 (약 100m 격자 단위). 오류일 때는 저장하지 않고 null (화면은 줄을 숨김)

export const AMENITY_CACHE_DAYS = 30;
const RADIUS_M = 400;
// Overpass 공개 서버는 붐비면 몇 초 걸린다. 화면은 이 줄을 기다리지 않으므로 넉넉히 7초 (2026-11-27: 4초로는 실서버에서 모두 실패)
const TIMEOUT_MS = 7_000;
const ENDPOINTS = [
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const DEFAULT_UA = "Gollazyum/1.0 (+https://www.gollazyum.com; mailto:gollazyum@gmail.com)";

type Row = { grid_key: string; mart_count: number; pharmacy_count: number; hospital_count: number; items: AmenityItem[]; fetched_at: string };

export function overpassQuery(lat: number, lng: number): string {
  const a = `(around:${RADIUS_M},${lat},${lng})`;
  return `[out:json][timeout:7];(` +
    `nwr["shop"~"^(convenience|supermarket|grocery)$"]${a};` +
    `nwr["amenity"="pharmacy"]${a};nwr["shop"="chemist"]${a};` +
    `nwr["amenity"~"^(hospital|clinic|doctors)$"]${a};` +
    `);out center 40;`;
}

async function readCache(key: string): Promise<Amenities | null> {
  const since = new Date(Date.now() - AMENITY_CACHE_DAYS * 86_400_000).toISOString();
  const rows = await sb<Row[]>(`nearby_amenities_cache?grid_key=eq.${encodeURIComponent(key)}&fetched_at=gte.${encodeURIComponent(since)}&select=*&limit=1`);
  const r = rows?.[0];
  if (!r) return null;
  return { counts: { mart: r.mart_count, pharmacy: r.pharmacy_count, hospital: r.hospital_count }, items: Array.isArray(r.items) ? r.items : [] };
}

async function writeCache(key: string, a: Amenities) {
  const row: Row = { grid_key: key, mart_count: a.counts.mart, pharmacy_count: a.counts.pharmacy, hospital_count: a.counts.hospital, items: a.items, fetched_at: new Date().toISOString() };
  await sb("nearby_amenities_cache?on_conflict=grid_key", { method: "POST", body: [row], prefer: "resolution=merge-duplicates,return=minimal" });
}

// 여러 공개 서버에 동시에 묻고 먼저 온 올바른 응답을 쓴다 (한쪽이 느리거나 막혀도 7초 안에 끝남).
// 실패하면 이유를 남긴다 (Vercel 로그 · 응답 why)
async function askOne(url: string, body: string, ua: string, lat: number, lng: number): Promise<{ data: Amenities } | { why: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": ua, Accept: "application/json" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { why: `http ${res.status}` };
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      return { why: "not json" };
    }
    // 서버 쪽 시간 초과·메모리 부족이면 elements가 비어 와도 0곳이 아니다
    const remark = (json as { remark?: string } | null)?.remark ?? "";
    if (/error|timed out|runtime/i.test(remark)) return { why: `remark ${remark.slice(0, 80)}` };
    const data = parseOverpass(json, lat, lng);
    return data ? { data } : { why: "shape" };
  } catch (e) {
    const n = e instanceof Error ? e.name : "error";
    return { why: n === "TimeoutError" || n === "AbortError" ? "timeout" : n };
  }
}

async function fetchOverpass(lat: number, lng: number): Promise<{ data: Amenities | null; why: string }> {
  const body = new URLSearchParams({ data: overpassQuery(lat, lng) }).toString();
  const ua = process.env.OVERPASS_USER_AGENT || DEFAULT_UA;
  const tries = ENDPOINTS.map((u) => askOne(u, body, ua, lat, lng).then((r) => ("data" in r ? r.data : Promise.reject(new Error(`${new URL(u).host}: ${r.why}`)))));
  try {
    return { data: await Promise.any(tries), why: "" };
  } catch (e) {
    const why = e instanceof AggregateError ? e.errors.map((x) => (x instanceof Error ? x.message : String(x))).join(" / ") : "unknown";
    console.error("[amenities] overpass failed", why);
    return { data: null, why };
  }
}

// 저장분 먼저, 없으면 Overpass 한 번. 실패는 null (0곳으로 저장하지 않는다)
export async function nearbyAmenities(lat: number, lng: number): Promise<{ data: Amenities | null; hit: boolean; why?: string }> {
  const key = gridKey(lat, lng);
  if (supabaseOn()) {
    const c = await readCache(key).catch(() => null);
    if (c) return { data: c, hit: true };
  }
  const { data, why } = await fetchOverpass(lat, lng);
  if (data && supabaseOn()) await writeCache(key, data).catch((e) => console.error("[amenities] cache write", e instanceof Error ? e.message : e));
  return { data, hit: false, ...(why ? { why } : {}) };
}

export type { AmenityKind };
