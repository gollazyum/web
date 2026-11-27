// 편의시설 응답 모양 (서버·화면 같이 씀). Overpass 응답을 종류별 개수와 가까운 순 핀(종류마다 최대 8개)으로 바꾼다
export type AmenityKind = "mart" | "pharmacy" | "hospital";
export type AmenityItem = { kind: AmenityKind; name: string; lat: number; lng: number; m: number };
export type Amenities = { counts: Record<AmenityKind, number>; items: AmenityItem[] };

export const AMENITY_KO: Record<AmenityKind, string> = { mart: "편의점·마트", pharmacy: "약국", hospital: "병원" };
export const PINS_PER_KIND = 8;
export const WALK5_M = 400;

// 약 100m 격자 (소수점 3자리)
export const gridKey = (lat: number, lng: number) => `${lat.toFixed(3)}:${lng.toFixed(3)}`;

export function distM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
}

function kindOf(t: Record<string, string>): AmenityKind | null {
  if (/^(convenience|supermarket|grocery)$/.test(t.shop ?? "")) return "mart";
  if (t.amenity === "pharmacy" || t.shop === "chemist") return "pharmacy";
  if (/^(hospital|clinic|doctors)$/.test(t.amenity ?? "")) return "hospital";
  return null;
}

const NAME_FALLBACK: Record<AmenityKind, string> = { mart: "편의점·마트", pharmacy: "약국", hospital: "병원·의원" };

// 모양이 맞지 않으면 null (오류로 보고 저장하지 않는다). elements가 빈 배열이면 진짜 0곳
export function parseOverpass(json: unknown, lat: number, lng: number): Amenities | null {
  const els = (json as { elements?: unknown } | null)?.elements;
  if (!Array.isArray(els)) return null;
  const seen = new Set<string>();
  const all: AmenityItem[] = [];
  for (const e of els as { type?: string; id?: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[]) {
    const p = e.center ?? (typeof e.lat === "number" && typeof e.lon === "number" ? { lat: e.lat, lon: e.lon } : null);
    const kind = kindOf(e.tags ?? {});
    if (!p || !kind) continue;
    const id = `${e.type}:${e.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const m = Math.round(distM(lat, lng, p.lat, p.lon));
    if (m > WALK5_M) continue;
    const t = e.tags ?? {};
    all.push({ kind, name: (t["name:ko"] || t.name || t["name:en"] || NAME_FALLBACK[kind]).slice(0, 40), lat: +p.lat.toFixed(6), lng: +p.lon.toFixed(6), m });
  }
  all.sort((a, b) => a.m - b.m);
  const counts: Record<AmenityKind, number> = { mart: 0, pharmacy: 0, hospital: 0 };
  const items: AmenityItem[] = [];
  for (const it of all) {
    counts[it.kind]++;
    if (counts[it.kind] <= PINS_PER_KIND) items.push(it);
  }
  return { counts, items };
}

export const amenityTotal = (a: Amenities) => a.counts.mart + a.counts.pharmacy + a.counts.hospital;

// "도보 5분 내 · 편의점·마트 3곳 · 약국 1곳 · 병원 0곳"
export function amenityLine(a: Amenities): string {
  if (!amenityTotal(a)) return "도보 5분 내 등록된 편의점·약국 정보가 없어요";
  return `도보 5분 내 · 편의점·마트 ${a.counts.mart}곳 · 약국 ${a.counts.pharmacy}곳 · 병원 ${a.counts.hospital}곳`;
}
