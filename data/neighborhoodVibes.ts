// 동네 분위기 (참고용). 사람이 직접 고른 정적 시드라 외부 호출이 없다.
// 상권 특성만 적는다: 치안·위험 판정이나 자극적인 표현은 쓰지 않는다.
// 좌표는 [lng, lat]. 한 동네 = 한 구역(원). 같은 도시 안에서 원이 겹치면 불러올 때 반경을 줄인다 (좌표는 그대로)

export type VibeKey = "shopping" | "hip" | "local" | "office" | "nightlife" | "luxury" | "value";
export type Vibe = { label: string; emoji: string; color: string };

export const VIBES: Record<VibeKey, Vibe> = {
  shopping: { label: "핵심 관광·쇼핑", emoji: "🛍️", color: "#FF8FAB" },
  hip: { label: "감성 카페·편집숍", emoji: "📸", color: "#A882DD" },
  local: { label: "조용한 로컬·휴식", emoji: "🏡", color: "#6BCB9F" },
  office: { label: "깔끔한 비즈니스", emoji: "💼", color: "#64B5F6" },
  nightlife: { label: "야간 번화가·맛집", emoji: "🍷", color: "#FFB74D" },
  luxury: { label: "하이엔드·호캉스", emoji: "💎", color: "#D4AF37" },
  value: { label: "실속 가성비·환승", emoji: "💰", color: "#4DB6AC" },
};
export const VIBE_KEYS = Object.keys(VIBES) as VibeKey[];
export const VIBE_NOTE = "표시되지 않은 곳도 좋은 숙소가 많아요. 동네 색은 분위기 참고용이에요.";

export type Zone = { id: string; name: string; vibe: VibeKey; center: [number, number]; radiusMeters: number; desc: string };
export type City = { id: string; name: string; center: [number, number]; matchKm: number; zones: Zone[] };

type Seed = [name: string, vibe: VibeKey, center: [number, number], radius: number, desc: string];
const city = (id: string, name: string, center: [number, number], seeds: Seed[]): City => ({
  id,
  name,
  center,
  matchKm: 15,
  zones: seeds.map(([n, vibe, c, r, desc], i) => ({ id: `${id}-${i + 1}`, name: n, vibe, center: c, radiusMeters: r, desc })),
});

const SEED: City[] = [
  city("osaka", "오사카", [135.5023, 34.6937], [
    ["신사이바시 쇼핑가", "shopping", [135.5013, 34.6751], 420, "백화점·아케이드 쇼핑 중심"],
    ["도톤보리·난바 중심", "shopping", [135.5014, 34.6687], 380, "먹거리·글리코상 랜드마크"],
    ["소에몬초·히가시신사이바시", "nightlife", [135.5062, 34.6712], 320, "심야 이자카야·네온사인 밀집"],
    ["나카자키초 카페거리", "hip", [135.5056, 34.7069], 450, "레트로 골목 카페·빈티지숍"],
    ["미나미호리에", "hip", [135.4925, 34.6718], 420, "감성 편집숍·브런치 거리"],
    ["우메다 백화점 타운", "luxury", [135.4983, 34.7025], 550, "대형 백화점·교통 환승 허브"],
    ["혼마치·요도야바시", "office", [135.5005, 34.6865], 600, "넓고 깔끔한 대로 · 가성비 숙소"],
    ["덴노지 공원 주변", "local", [135.5115, 34.6505], 550, "공원 인접 · 여유로운 분위기"],
    ["다이코쿠초 역세권", "value", [135.4975, 34.6558], 420, "난바 1정거장·조용한 가성비"],
    ["신오사카역 주변", "value", [135.5001, 34.7335], 550, "교토·신칸센 이동 편한 실속 구역"],
  ]),
  city("tokyo", "도쿄", [139.7528, 35.6852], [
    ["신주쿠 산초메·이세탄", "shopping", [139.7046, 35.6908], 400, "백화점·쇼핑 중심지"],
    ["가부키초 일대", "nightlife", [139.7028, 35.6953], 320, "화려한 네온사인·심야 식당가"],
    ["시모키타자와", "hip", [139.667, 35.6616], 500, "빈티지숍·소극장 산책 동네"],
    ["나카메구로·다이칸야마", "hip", [139.7008, 35.6465], 550, "강변 카페·감성 부티크"],
    ["마루노우치·도쿄역", "office", [139.7645, 35.6812], 600, "정돈된 빌딩 숲·쾌적한 보도"],
    ["우에노 공원·야나카", "local", [139.7712, 35.7175], 650, "공원 옆 차분한 옛 동네"],
    ["긴자·유라쿠초", "luxury", [139.7664, 35.6717], 550, "플래그십 명품·다이닝 거리"],
    ["오모테산도·아오야마", "luxury", [139.7126, 35.6652], 520, "건축미 돋보이는 하이엔드 거리"],
    ["아사쿠사바시·쿠라마에", "value", [139.786, 35.6975], 480, "공항 직통·합리적인 숙박비"],
    ["오시아게·스미다", "value", [139.8107, 35.7101], 500, "스카이트리·넓고 쾌적한 가성비"],
  ]),
  city("fukuoka", "후쿠오카", [130.4017, 33.5902], [
    ["텐진 핵심 상권", "shopping", [130.3989, 33.5903], 420, "백화점·지하상가 쇼핑 중심"],
    ["다이묘 골목", "hip", [130.3928, 33.5882], 360, "편집숍·디저트 카페 골목"],
    ["하카타역 주변", "office", [130.4207, 33.5897], 600, "공항 5분 컷 · 깔끔한 교통 허브"],
    ["나카스 강변", "nightlife", [130.4063, 33.5922], 330, "야타이(포장마차)·심야 번화가"],
    ["오호리공원 주변", "local", [130.3764, 33.5861], 650, "호수 산책로가 있는 조용한 동네"],
    ["기온·고후쿠마치", "value", [130.4125, 33.5955], 400, "하카타·텐진 사이 가성비 숙소"],
  ]),
  city("bangkok", "방콕", [100.538, 13.74], [
    ["시암·칫롬", "shopping", [100.5398, 13.7456], 600, "대형 쇼핑몰 스카이워크 연결"],
    ["통로·에까마이", "hip", [100.5815, 13.7308], 700, "감성 브런치 카페·라운지 거리"],
    ["사톤·실롬 오피스", "office", [100.5295, 13.7235], 650, "정돈된 빌딩·대사관 거리"],
    ["아속·나나 역세권", "nightlife", [100.5578, 13.7385], 520, "늦은 밤까지 활기찬 나이트 상권"],
    ["짜오프라야 리버사이드", "luxury", [100.5118, 13.7225], 650, "강변 5성급 리조트 호캉스"],
    ["온눗 역세권", "value", [100.601, 13.7055], 550, "BTS 역세권·대형마트 실속 숙소"],
  ]),
  city("seoul", "서울", [126.978, 37.5665], [
    ["명동 상권", "shopping", [126.985, 37.5636], 450, "쇼핑·환전·길거리 음식 중심"],
    ["홍대입구 중심", "shopping", [126.9237, 37.5558], 500, "버스킹·패션·쇼핑 번화가"],
    ["연남동 경의선숲길", "hip", [126.9252, 37.5628], 420, "공원 산책로·골목 디저트 카페"],
    ["성수동 카페거리", "hip", [127.0557, 37.5446], 650, "팝업스토어·로스터리 편집숍"],
    ["한남동", "hip", [127.0018, 37.5365], 480, "전시관·쇼룸 산책 동네"],
    ["광화문·시청", "office", [126.9784, 37.5704], 600, "고궁 옆 정돈된 대로·주말 가성비"],
    ["여의도", "office", [126.9265, 37.5255], 700, "한강공원 인접 쾌적한 빌딩가"],
    ["서촌·통인", "local", [126.9708, 37.5792], 480, "경복궁 서쪽 차분한 한옥·골목"],
    ["망원동", "local", [126.9056, 37.556], 480, "전통시장·조용한 로컬 동네"],
    ["이태원 중심", "nightlife", [126.9945, 37.5345], 400, "글로벌 다이닝·심야 펍 거리"],
    ["을지로3가 포차골목", "nightlife", [126.9918, 37.5663], 380, "노포·야장이 모인 저녁 핫플"],
    ["청담·압구정로데오", "luxury", [127.0415, 37.5258], 600, "플래그십 명품·파인다이닝"],
    ["마포·공덕 역세권", "value", [126.9515, 37.544], 520, "공항철도 직통·합리적 비즈니스 호텔"],
  ]),
];

// 두 점 사이 직선거리 (m). 인자는 [lng, lat]
export function haversine(a: [number, number], b: [number, number]): number {
  const R = 6_371_000;
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLng = (b[0] - a[0]) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export const GAP_M = 40; // 이웃 구역 사이에 남길 틈
export const MIN_R = 250; // 아무리 줄여도 이 반경은 남긴다

export type RadiusFix = { city: string; zone: string; from: number; to: number };

// 같은 도시 모든 구역 쌍에서 r1 + r2 > d - 40m 이면 두 반경을 비율대로 줄여 r1 + r2 = d - 40m 으로 맞춘다 (최소 250m).
// 반경은 줄기만 하므로, 더 바뀌는 쌍이 없을 때까지 몇 번 돌리면 끝난다. 좌표는 건드리지 않는다
export function fixRadii(cities: City[]): { cities: City[]; fixes: RadiusFix[] } {
  const out = cities.map((c) => ({ ...c, zones: c.zones.map((z) => ({ ...z })) }));
  const first = new Map<string, number>();
  for (const c of out) {
    for (let pass = 0; pass < 10; pass++) {
      let changed = false;
      for (let i = 0; i < c.zones.length; i++) {
        for (let j = i + 1; j < c.zones.length; j++) {
          const a = c.zones[i];
          const b = c.zones[j];
          const target = haversine(a.center, b.center) - GAP_M;
          const sum = a.radiusMeters + b.radiusMeters;
          if (sum <= target + 0.5) continue;
          let ra = Math.floor((a.radiusMeters * target) / sum);
          let rb = Math.floor((b.radiusMeters * target) / sum);
          if (ra < MIN_R) {
            ra = MIN_R;
            rb = Math.max(MIN_R, Math.floor(target) - MIN_R);
          } else if (rb < MIN_R) {
            rb = MIN_R;
            ra = Math.max(MIN_R, Math.floor(target) - MIN_R);
          }
          for (const [z, r] of [[a, ra], [b, rb]] as const) {
            const nr = Math.min(z.radiusMeters, r);
            if (nr !== z.radiusMeters) {
              if (!first.has(z.id)) first.set(z.id, z.radiusMeters);
              z.radiusMeters = nr;
              changed = true;
            }
          }
        }
      }
      if (!changed) break;
    }
  }
  const fixes: RadiusFix[] = [];
  for (const c of out) for (const z of c.zones) if (first.has(z.id)) fixes.push({ city: c.name, zone: z.name, from: first.get(z.id)!, to: z.radiusMeters });
  return { cities: out, fixes };
}

const fixed = fixRadii(SEED);
export const CITIES: City[] = fixed.cities;
export const RADIUS_FIXES = fixed.fixes;
if (process.env.NODE_ENV === "development" && typeof window !== "undefined" && RADIUS_FIXES.length) {
  console.info("[vibes] 겹침 때문에 줄인 반경", RADIUS_FIXES.map((f) => `${f.city} ${f.zone} ${f.from}→${f.to}m`).join(", "));
}

// 지점([lng, lat])에서 15km 안에 중심이 있는 가장 가까운 도시 (없으면 null: 요코하마처럼 옆 도시는 잡지 않는다)
export function cityNear(p: [number, number]): City | null {
  let best: City | null = null;
  let bd = Infinity;
  for (const c of CITIES) {
    const d = haversine(p, c.center);
    if (d <= c.matchKm * 1000 && d < bd) {
      best = c;
      bd = d;
    }
  }
  return best;
}

// 숙소 좌표가 들어가는 구역 (여러 개면 중심이 가장 가까운 것). 인자는 [lng, lat]
export function zoneAt(p: [number, number], c: City | null = cityNear(p)): Zone | null {
  if (!c) return null;
  let best: Zone | null = null;
  let bd = Infinity;
  for (const z of c.zones) {
    const d = haversine(p, z.center);
    if (d <= z.radiusMeters && d < bd) {
      best = z;
      bd = d;
    }
  }
  return best;
}

// 구역 원을 부드러운 32각형으로
export function createSmoothZonePolygon(center: [number, number], meters: number, steps = 32): [number, number][] {
  const [lng, lat] = center;
  const dLat = meters / 111_320;
  const dLng = meters / (111_320 * Math.cos((lat * Math.PI) / 180));
  const ring: [number, number][] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  ring.push(ring[0]);
  return ring;
}

// 지도에 올릴 한 도시의 구역 GeoJSON (소스 하나)
export function zonesGeoJSON(c: City) {
  return {
    type: "FeatureCollection" as const,
    features: c.zones.map((z) => ({
      type: "Feature" as const,
      id: z.id,
      properties: { id: z.id, name: z.name, vibe: z.vibe, color: VIBES[z.vibe].color },
      geometry: { type: "Polygon" as const, coordinates: [createSmoothZonePolygon(z.center, z.radiusMeters)] },
    })),
  };
}
