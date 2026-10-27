// 전 세계 공항 검색. 목록은 public/airports.json (scripts/build-airports.mjs로 생성)
type Metro = [code: string, en: string, ko: string, cc: string, airports: string[]];
type Airport = [iata: string, name: string, city: string, cc: string, koCity: string, size: number];
type Data = { countries: Record<string, string>; metros: Metro[]; airports: Airport[] };

export type Place = {
  kind: "city" | "airport";
  code: string;
  title: string; // 목록에 크게 보이는 이름
  sub: string; // 도시·나라
  label: string; // 고른 뒤 입력칸에 들어가는 글자
  child?: boolean; // 도시 아래에 묶인 공항
};

let loading: Promise<Data> | null = null;

export function loadAirports(): Promise<Data> {
  loading ??= fetch("/airports.json")
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<Data>;
    })
    .catch((e) => {
      loading = null;
      throw e;
    });
  return loading;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "");
}

function scoreText(q: string, text: string, starts: number, contains: number): number {
  if (!text) return 0;
  const t = norm(text);
  if (t.startsWith(q)) return starts;
  return t.includes(q) ? contains : 0;
}

function cityName(a: Airport): string {
  return a[4] || a[2] || a[1];
}

function airportPlace(a: Airport, d: Data, child = false): Place {
  const country = d.countries[a[3]] ?? a[3];
  return {
    kind: "airport",
    code: a[0],
    title: `${a[1]} (${a[0]})`,
    sub: `${cityName(a)}, ${country}`,
    label: `${cityName(a)} (${a[0]})`,
    child,
  };
}

export function searchPlaces(d: Data, input: string, limit = 8): Place[] {
  const q = norm(input);
  if (!q) return [];
  const upper = input.trim().toUpperCase();
  const byCode = new Map(d.airports.map((a) => [a[0], a]));

  const metros = d.metros
    .map((m) => {
      const s = Math.max(
        m[0] === upper ? 100 : 0,
        scoreText(q, m[2], 92, 50),
        scoreText(q, m[1], 90, 50),
        m[4].includes(upper) ? 96 : 0,
      );
      return { m, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);

  const airports = d.airports
    .map((a) => {
      const s = Math.max(
        a[0] === upper ? 98 : 0,
        scoreText(q, a[4], 85, 45),
        scoreText(q, a[2], 75, 40),
        scoreText(q, a[1], 65, 35),
        scoreText(q, d.countries[a[3]] ?? "", 30, 0),
      );
      // 큰 공항, 한국어 이름이 있는 인기 여행지를 위로
      return { a, s: s ? s + a[5] + (a[4] ? 3 : 0) : 0 };
    })
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s);

  const out: Place[] = [];
  const shown = new Set<string>();
  for (const { m } of metros.slice(0, 2)) {
    const country = d.countries[m[3]] ?? m[3];
    out.push({
      kind: "city",
      code: m[0],
      title: `${m[2]} · ${m[1]}`,
      sub: `${country} · 모든 공항 (${m[4].join(", ")})`,
      label: `${m[2]} 모든 공항 (${m[0]})`,
    });
    for (const code of m[4]) {
      const a = byCode.get(code);
      if (a && !shown.has(code)) {
        out.push(airportPlace(a, d, true));
        shown.add(code);
      }
    }
  }
  let extra = 0;
  for (const { a } of airports) {
    if (extra >= limit) break;
    if (shown.has(a[0])) continue;
    out.push(airportPlace(a, d));
    shown.add(a[0]);
    extra++;
  }
  return out;
}

// 도시 코드(SEL)는 그 도시 공항들(ICN,GMP)로 바꾼다. 실시간 가격 서버는 공항 코드만 받는다
export async function airportsFor(code: string): Promise<string> {
  try {
    const d = await loadAirports();
    const metro = d.metros.find((m) => m[0] === code);
    if (metro) return metro[4].slice(0, 4).join(",");
  } catch {
    // 목록을 못 받으면 코드 그대로 보낸다
  }
  return code;
}

// 주소에 코드만 있을 때 입력칸에 보여 줄 이름 ("서울 모든 공항 (SEL)", "도쿄 (NRT)")
export function labelForCode(d: Data, code: string): string {
  const metro = d.metros.find((m) => m[0] === code);
  if (metro) return `${metro[2] || metro[1]} 모든 공항 (${code})`;
  const a = d.airports.find((x) => x[0] === code);
  return a ? `${cityName(a)} (${code})` : code;
}

// "도쿄 모든 공항 (TYO)", "nrt" 처럼 이미 코드가 보이면 바로 꺼낸다
export function codeFromText(input: string): string | null {
  const text = input.trim();
  const inParens = text.match(/\(([A-Za-z]{3})\)\s*$/);
  if (inParens) return inParens[1].toUpperCase();
  if (/^[A-Za-z]{3}$/.test(text)) return text.toUpperCase();
  return null;
}

// 숙소 검색창용 도시 추천. 공항 목록의 도시 이름을 모아 쓴다 (호텔 이름은 /api/places에서)
export type CityHit = { name: string; sub: string };

export function searchCities(d: Data, input: string, limit = 6): CityHit[] {
  const q = norm(input);
  if (!q) return [];
  const best = new Map<string, { hit: CityHit; s: number }>();
  for (const a of d.airports) {
    const s = Math.max(scoreText(q, a[4], 90, 45), scoreText(q, a[2], 80, 40));
    if (!s) continue;
    const name = cityName(a);
    const key = `${name}|${a[3]}`;
    const score = s + a[5] + (a[4] ? 3 : 0);
    const prev = best.get(key);
    if (!prev || prev.s < score) {
      const country = d.countries[a[3]] ?? a[3];
      best.set(key, { hit: { name, sub: a[4] && a[2] ? `${a[2]}, ${country}` : country }, s: score });
    }
  }
  return [...best.values()]
    .sort((x, y) => y.s - x.s)
    .slice(0, limit)
    .map((x) => x.hit);
}
