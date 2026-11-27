import "server-only";
import { sb, supabaseOn } from "@/lib/supabase-server";
import { type AmenityKind, type Amenities, type AmenityItem, gridKey, parseOverpass } from "@/lib/amenity-shape";

// 숙소 상세 페이지 '도보 5분 내 편의점·약국·병원'. OpenStreetMap(Overpass)에서 반경 400m만 한 번 찾고
// nearby_amenities_cache에 30일 저장한다 (약 100m 격자 단위). 오류일 때는 저장하지 않고 null (화면은 줄을 숨김)

export const AMENITY_CACHE_DAYS = 30;
const RADIUS_M = 400;
const TIMEOUT_MS = 4_000;
const ENDPOINTS = ["https://overpass.private.coffee/api/interpreter", "https://overpass-api.de/api/interpreter"];
const DEFAULT_UA = "Gollazyum/1.0 (+https://www.gollazyum.com; mailto:gollazyum@gmail.com)";

type Row = { grid_key: string; mart_count: number; pharmacy_count: number; hospital_count: number; items: AmenityItem[]; fetched_at: string };

export function overpassQuery(lat: number, lng: number): string {
  const a = `(around:${RADIUS_M},${lat},${lng})`;
  return `[out:json][timeout:4];(` +
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

async function fetchOverpass(lat: number, lng: number): Promise<Amenities | null> {
  const body = new URLSearchParams({ data: overpassQuery(lat, lng) }).toString();
  const ua = process.env.OVERPASS_USER_AGENT || DEFAULT_UA;
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": ua, Accept: "application/json" },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const json = (await res.json().catch(() => null)) as unknown;
      const out = parseOverpass(json, lat, lng);
      if (out) return out;
    } catch {
      // 다음 주소로
    }
  }
  return null;
}

// 저장분 먼저, 없으면 Overpass 한 번. 실패는 null (0곳으로 저장하지 않는다)
export async function nearbyAmenities(lat: number, lng: number): Promise<{ data: Amenities | null; hit: boolean }> {
  const key = gridKey(lat, lng);
  if (supabaseOn()) {
    const c = await readCache(key).catch(() => null);
    if (c) return { data: c, hit: true };
  }
  const data = await fetchOverpass(lat, lng);
  if (data && supabaseOn()) await writeCache(key, data).catch(() => undefined);
  return { data, hit: false };
}

export type { AmenityKind };
