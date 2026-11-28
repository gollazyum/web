"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DEVICE_MAX, kstLocalToMs, tooLate, watchUntil } from "@/lib/booking-watch";
import { maskText, PARSE_DAILY_MAX, PARSE_FAIL_MESSAGE, PARSE_IMAGE_TYPES, PARSE_LIMIT_MESSAGE, PARSE_MAX_IMAGE_BYTES, PARSE_MAX_TEXT, PARSE_PRIVACY_NOTE, type ParsedBooking } from "@/lib/booking-parse";
import { sameHotelName } from "@/lib/booking-match";
import { today as localToday } from "@/lib/dates";
import { HOTEL_SELLER_ALLOWLIST } from "@/lib/hotel-sellers";
import type { PublicWatch } from "@/lib/booking-watch-server";
import { device, post, vendorKo, watchesChanged } from "./BookingWatch";
import { Sheet } from "./Sheet";
import type { SavedLike } from "./saved-price";
import { cityLabel } from "@/lib/city-key";

// 내 여행 '+ 예약 완료한 숙소 등록하기' 창 (2026-11-27).
// [직접 입력] 숙소명(검색에 나온 숙소·찜 목록에서 자동완성, 유료 검색 0회)·날짜·인원·총액·예약처·무료 취소 기한
// [이메일/영수증 AI 자동 입력] 예약 확인서 이미지나 글 → 칸을 채워 직접 입력 탭으로 넘긴다. 실패·한도 초과도 직접 입력으로 이어 간다
// 저장할 때 숙소 번호(property_token)를 찾으면 가격 지킴이(서버)에 등록하고, 못 찾거나 지켜볼 수 없는 예약이면 이 기기에만 저장한다

// ---------- 이 기기에만 저장한 예약 (가격 추적 없음) ----------
export type LocalBooking = {
  id: string;
  name: string;
  place: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  bookedPrice: number;
  bookedVendor: string | null;
  freeCancelUntil: string | null;
  why: string; // 가격 추적을 못 하는 이유 (화면에 그대로)
  at: number;
};
const LOCAL_KEY = "tb-my-bookings-v1";
const localSubs = new Set<() => void>();
let localCache: { raw: string | null; v: LocalBooking[] } = { raw: null, v: [] };
function readLocal(): LocalBooking[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LOCAL_KEY);
  } catch {
    return localCache.v;
  }
  if (raw !== localCache.raw) {
    let v: LocalBooking[] = [];
    try {
      const j = raw ? (JSON.parse(raw) as unknown) : [];
      v = Array.isArray(j) ? (j as LocalBooking[]).filter((x) => x && typeof x.id === "string" && typeof x.name === "string") : [];
    } catch {
      v = [];
    }
    localCache = { raw, v };
  }
  return localCache.v;
}
function writeLocal(v: LocalBooking[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(v.slice(0, 30)));
  } catch {
    localCache = { raw: "mem", v };
  }
  localSubs.forEach((f) => f());
}
export const removeLocalBooking = (id: string) => writeLocal(readLocal().filter((x) => x.id !== id));
const EMPTY: LocalBooking[] = [];
export function useLocalBookings(): LocalBooking[] {
  return useSyncExternalStore(
    (f) => {
      localSubs.add(f);
      return () => localSubs.delete(f);
    },
    readLocal,
    () => EMPTY,
  );
}

// ---------- AI 자동 입력 하루 횟수 (이 기기 기준 안내용. 서버도 따로 센다) ----------
const PARSE_COUNT_KEY = "tb-parse-count-v1";
function parseCount(): { day: string; n: number } {
  const day = localToday();
  try {
    const v = JSON.parse(localStorage.getItem(PARSE_COUNT_KEY) ?? "null") as { day?: string; n?: number } | null;
    return v?.day === day && typeof v.n === "number" ? { day, n: v.n } : { day, n: 0 };
  } catch {
    return { day, n: 0 };
  }
}
function bumpParse() {
  const c = parseCount();
  try {
    localStorage.setItem(PARSE_COUNT_KEY, JSON.stringify({ day: c.day, n: c.n + 1 }));
  } catch {
    // 저장소를 못 쓰면 서버 한도만
  }
}

// 이미지를 긴 변 1600px JPEG로 줄인다 (서버 요청 크기 한도 안으로, 사진 속 위치 정보(EXIF)도 이때 빠진다)
async function shrinkImage(file: File): Promise<{ type: "image/jpeg"; data: string }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * scale));
  c.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  const url = c.toDataURL("image/jpeg", 0.85);
  c.width = c.height = 0;
  return { type: "image/jpeg", data: url.slice(url.indexOf(",") + 1) };
}

type Match = { token: string; name: string; city: string; image?: string | null };
type Form = {
  name: string;
  place: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  price: string;
  vendor: string;
  fcu: string;
  refundable: boolean;
};
const blank = (): Form => ({ name: "", place: "", checkIn: "", checkOut: "", adults: 2, price: "", vendor: "agoda", fcu: "", refundable: true });

const cityKo = cityLabel; // 도시 슬러그 → 한글 이름 (lib/city-key.ts)

async function findMatches(q: string): Promise<Match[]> {
  try {
    const r = await fetch(`/api/bookings/match?q=${encodeURIComponent(q)}`);
    const j = (await r.json()) as { hotels?: Match[] };
    return Array.isArray(j.hotels) ? j.hotels : [];
  } catch {
    return [];
  }
}

type Props = { open: boolean; onClose: () => void; saved: SavedLike[]; watches: PublicWatch[] | null };

export function BookingRegister({ open, onClose, saved, watches }: Props) {
  const [tab, setTab] = useState<"manual" | "ai">("manual");
  const [f, setF] = useState<Form>(blank);
  const [pick, setPick] = useState<Match | null>(null);
  const [sugs, setSugs] = useState<Match[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setTab("manual");
    setF(blank());
    setPick(null);
    setSugs([]);
    setMsg(null);
    setDone(false);
  }, [open]);

  // 숙소명 자동완성: 찜 목록 먼저, 그다음 검색에 나온 적 있는 숙소 (입력이 멈추고 0.3초 뒤 한 번)
  useEffect(() => {
    if (!open || pick || f.name.trim().length < 2) {
      setSugs([]);
      return;
    }
    const q = f.name.trim();
    const mine: Match[] = saved
      .filter((s) => s.hotel.name.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 3)
      .map((s) => ({ token: s.hotel.token, name: s.hotel.name, city: s.query.place, image: s.hotel.image }));
    setSugs(mine);
    const t = setTimeout(async () => {
      const more = await findMatches(q);
      setSugs((cur) => [...mine, ...more.filter((m) => !mine.some((x) => x.token === m.token))].slice(0, 6));
    }, 300);
    return () => clearTimeout(t);
  }, [f.name, open, pick]); // eslint-disable-line react-hooks/exhaustive-deps

  function fill(b: ParsedBooking) {
    setF((x) => ({
      ...x,
      name: b.hotelName ?? x.name,
      place: b.city ?? x.place,
      checkIn: b.checkIn ?? x.checkIn,
      checkOut: b.checkOut ?? x.checkOut,
      adults: b.adults ?? x.adults,
      price: b.totalKrw !== null ? String(b.totalKrw) : "",
      vendor: b.vendor && HOTEL_SELLER_ALLOWLIST.some((s) => s.key === b.vendor) ? b.vendor : b.vendor ? "" : x.vendor,
      fcu: b.freeCancelUntil ?? "",
      refundable: b.refundable !== false,
    }));
    setPick(null);
  }

  async function save() {
    if (busy) return;
    const name = f.name.trim();
    const n = Number(f.price.replace(/[^\d]/g, ""));
    if (!name) return setMsg({ ok: false, text: "숙소 이름을 적어 주세요" });
    if (!f.checkIn || !f.checkOut || f.checkOut <= f.checkIn) return setMsg({ ok: false, text: "체크인·체크아웃 날짜를 확인해 주세요" });
    if (!(n >= 1000 && n <= 100_000_000)) return setMsg({ ok: false, text: "예약한 총액을 원 단위로 적어 주세요 (세금 포함)" });
    if (f.fcu && kstLocalToMs(f.fcu) === null) return setMsg({ ok: false, text: "무료 취소 기한을 다시 확인해 주세요" });
    setBusy(true);
    setMsg(null);

    // 1) 숙소 번호 찾기: 고른 자동완성 → 찜 목록 → 검색에 나온 숙소에서 이름이 같은 곳
    let m: Match | null = pick && pick.name === name ? pick : null;
    if (!m) {
      const s = saved.find((x) => sameHotelName(x.hotel.name, name));
      if (s) m = { token: s.hotel.token, name: s.hotel.name, city: s.query.place };
    }
    if (!m) m = (await findMatches(name)).find((x) => sameHotelName(x.name, name)) ?? null;

    const place = f.place.trim() || (m ? cityKo(m.city) : "");
    const fcuMs = f.fcu ? kstLocalToMs(f.fcu) : null;
    const until = watchUntil(f.checkIn, fcuMs);
    const active = (watches ?? []).filter((w) => w.status === "active").length;
    let why = "";
    if (!m) why = "검색 기록에서 같은 숙소를 찾지 못해 가격 추적 없이 저장했어요";
    else if (!f.refundable) why = "무료 취소가 안 되는 예약이라 가격 추적 없이 저장했어요";
    else if (tooLate(f.checkIn, until, Date.now())) why = "무료 취소 마감이 가까워 가격 추적 없이 저장했어요";
    else if (active >= DEVICE_MAX) why = `가격 지킴이는 ${DEVICE_MAX}개까지라 가격 추적 없이 저장했어요`;

    // 2) 지켜볼 수 있으면 서버 가격 지킴이에 등록
    if (!why && m) {
      const id = device(true);
      const r = id
        ? await post<{ watch: PublicWatch }>("/api/bookings/watch", {
            device: id,
            token: m.token,
            name: m.name,
            place,
            checkIn: f.checkIn,
            checkOut: f.checkOut,
            adults: f.adults,
            bookedPrice: n,
            bookedVendor: f.vendor || null,
            freeCancelUntil: f.fcu || null,
          })
        : ({ ok: false, message: "이 브라우저에서는 가격 지킴이를 쓸 수 없어요" } as const);
      if (r.ok) {
        setBusy(false);
        setDone(true);
        setMsg({ ok: true, text: `${m.name} 예약을 등록했어요. 무료 취소 기한 전까지 가격을 지켜보고, 내려가면 내 여행 맨 위에 알려 드려요` });
        watchesChanged();
        return;
      }
      why = `${r.message} · 가격 추적 없이 저장했어요`;
    }

    // 3) 이 기기에만 저장 (입력한 값 그대로)
    writeLocal([
      {
        id: Math.random().toString(36).slice(2, 10),
        name: m?.name ?? name.slice(0, 200),
        place: place.slice(0, 60),
        checkIn: f.checkIn,
        checkOut: f.checkOut,
        adults: f.adults,
        bookedPrice: n,
        bookedVendor: f.vendor || null,
        freeCancelUntil: f.fcu || null,
        why,
        at: Date.now(),
      },
      ...readLocal(),
    ]);
    setBusy(false);
    setDone(true);
    setMsg({ ok: true, text: `내 여행에 저장했어요. ${why}` });
  }

  return (
    <Sheet open={open} onClose={onClose} label="예약 완료한 숙소 등록하기" title="예약 완료한 숙소 등록하기" tall>
      <div className="tb-breg">
        <div className="tb-breg-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "manual"} onClick={() => setTab("manual")}>
            직접 입력
          </button>
          <button type="button" role="tab" aria-selected={tab === "ai"} onClick={() => setTab("ai")}>
            이메일/영수증 AI 자동 입력
          </button>
        </div>

        {tab === "ai" ? (
          <AiTab
            onParsed={(b, note) => {
              fill(b);
              setTab("manual");
              setMsg({ ok: true, text: note });
            }}
            onFallback={(text) => {
              setTab("manual");
              setMsg({ ok: false, text });
            }}
          />
        ) : (
          <form
            className="tb-bw-form tb-breg-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <label className="tb-breg-name">
              <span>숙소 이름</span>
              <input
                value={f.name}
                onChange={(e) => {
                  set("name", e.target.value);
                  setPick(null);
                }}
                placeholder="예: 호텔 그레이스리 신주쿠"
                autoComplete="off"
                maxLength={200}
              />
              {sugs.length > 0 && !pick && (
                <ul className="tb-breg-sugs" role="listbox" aria-label="숙소 이름 추천">
                  {sugs.map((s) => (
                    <li key={s.token}>
                      <button
                        type="button"
                        onClick={() => {
                          setPick(s);
                          setF((x) => ({ ...x, name: s.name, place: x.place || cityKo(s.city) }));
                          setSugs([]);
                        }}
                      >
                        <strong>{s.name}</strong>
                        <small>{cityKo(s.city)}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {pick && <small className="tb-breg-ok">✓ 검색한 숙소와 연결했어요. 가격을 지켜볼 수 있어요</small>}
            </label>
            <div className="tb-breg-row">
              <label>
                <span>체크인</span>
                <input type="date" value={f.checkIn} onChange={(e) => set("checkIn", e.target.value)} />
              </label>
              <label>
                <span>체크아웃</span>
                <input type="date" value={f.checkOut} min={f.checkIn || undefined} onChange={(e) => set("checkOut", e.target.value)} />
              </label>
            </div>
            <div className="tb-breg-row">
              <label>
                <span>인원 (성인)</span>
                <select value={f.adults} onChange={(e) => set("adults", Number(e.target.value))}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((x) => (
                    <option key={x} value={x}>
                      {x}명
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>예약처</span>
                <select value={f.vendor} onChange={(e) => set("vendor", e.target.value)}>
                  {HOTEL_SELLER_ALLOWLIST.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.ko}
                    </option>
                  ))}
                  <option value="">그 밖의 곳</option>
                </select>
              </label>
            </div>
            <label>
              <span>예약한 총액 (세금 포함, 원)</span>
              <input inputMode="numeric" value={f.price} onChange={(e) => set("price", e.target.value)} placeholder="예: 320000" className="tb-num" />
            </label>
            <label>
              <span>무료 취소 기한 (한국 시간, 모르면 비워 두세요)</span>
              <input type="datetime-local" value={f.fcu} onChange={(e) => set("fcu", e.target.value)} max={f.checkIn ? `${f.checkIn}T23:59` : undefined} />
            </label>
            <label className="tb-bw-check">
              <input type="checkbox" checked={f.refundable} onChange={(e) => set("refundable", e.target.checked)} />
              <span>무료 취소가 되는 예약이에요 (가격 추적은 무료 취소 예약만 해요)</span>
            </label>
            {msg && <p className={`tb-bw-msg${msg.ok ? "" : " bad"}`}>{msg.text}</p>}
            {done ? (
              <button type="button" className="tb-cta small" onClick={onClose}>
                확인
              </button>
            ) : (
              <button type="submit" className="tb-cta small" disabled={busy}>
                {busy ? "저장하는 중" : "저장하기"}
              </button>
            )}
            <p className="tb-note">입력한 내용은 가격 확인에만 써요. 이름·예약번호는 받지 않아요.</p>
          </form>
        )}
      </div>
    </Sheet>
  );
}

// ---------- AI 자동 입력 탭 ----------
function AiTab({ onParsed, onFallback }: { onParsed: (b: ParsedBooking, note: string) => void; onFallback: (text: string) => void }) {
  const [agree, setAgree] = useState(false);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function run() {
    if (busy) return;
    setErr("");
    if (!agree) return setErr("안내를 읽고 동의에 체크해 주세요");
    if (!file && !text.trim()) return setErr("예약 확인서 이미지를 고르거나 메일 내용을 붙여 넣어 주세요");
    if (parseCount().n >= PARSE_DAILY_MAX) return onFallback(PARSE_LIMIT_MESSAGE);
    const id = device(true);
    if (!id) return onFallback(PARSE_FAIL_MESSAGE);
    let body: Record<string, unknown>;
    if (file) {
      if (!PARSE_IMAGE_TYPES.includes(file.type as (typeof PARSE_IMAGE_TYPES)[number])) return setErr("jpg·png·webp 이미지만 올릴 수 있어요");
      if (file.size > PARSE_MAX_IMAGE_BYTES) return setErr("이미지는 5MB까지 올릴 수 있어요");
      setBusy(true);
      try {
        body = { device: id, consent: true, image: await shrinkImage(file) };
      } catch {
        setBusy(false);
        return onFallback("이미지를 열지 못했어요. 직접 입력으로 이어서 등록해 주세요");
      }
    } else {
      if (text.length > PARSE_MAX_TEXT) return setErr(`글은 ${PARSE_MAX_TEXT.toLocaleString("ko-KR")}자까지 붙여 넣을 수 있어요`);
      setBusy(true);
      body = { device: id, consent: true, text: maskText(text) };
    }
    bumpParse();
    try {
      const r = await fetch("/api/bookings/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => ({}))) as { booking?: ParsedBooking; error?: string; code?: string };
      setBusy(false);
      body = {}; // 보낸 원본은 이 화면에서도 바로 버린다
      setFile(null);
      setText("");
      if (fileRef.current) fileRef.current.value = "";
      if (!r.ok || !j.booking) {
        if (j.code === "not_booking") return setErr(j.error ?? "숙소 예약 내역서만 분석할 수 있어요");
        return onFallback(j.error ?? PARSE_FAIL_MESSAGE);
      }
      const b = j.booking;
      const notes = ["AI가 읽은 내용을 채웠어요. 맞는지 확인하고 저장해 주세요"];
      if (b.totalKrw === null && b.currency && b.currency !== "KRW") notes.push(`총액이 원화가 아니라(${b.currency}) 비워 뒀어요. 결제한 원화 금액을 적어 주세요`);
      if (b.refundable === false) notes.push("환불 불가 예약으로 읽었어요");
      if (b.vendor && !HOTEL_SELLER_ALLOWLIST.some((s) => s.key === b.vendor)) notes.push(`예약처: ${vendorKo(b.vendor)}`);
      onParsed(b, notes.join(" · "));
    } catch {
      setBusy(false);
      onFallback("연결이 불안정해요. 직접 입력으로 이어서 등록해 주세요");
    }
  }

  return (
    <div className="tb-breg-ai">
      <p className="tb-breg-warn">{PARSE_PRIVACY_NOTE}</p>
      <label className="tb-breg-file">
        <span>예약 확인서 이미지 (jpg·png·webp, 5MB까지)</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setErr("");
          }}
        />
      </label>
      <label className="tb-breg-text">
        <span>또는 예약 확정 메일 내용 붙여 넣기 ({PARSE_MAX_TEXT.toLocaleString("ko-KR")}자까지)</span>
        <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, PARSE_MAX_TEXT + 1))} rows={6} placeholder="메일 본문을 붙여 넣으면 보내기 전에 이메일·전화번호·카드번호를 자동으로 가려요" disabled={!!file} />
        <small className="tb-num">
          {text.length.toLocaleString("ko-KR")} / {PARSE_MAX_TEXT.toLocaleString("ko-KR")}자
        </small>
      </label>
      <label className="tb-bw-check tb-breg-agree">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>
          (필수) 올린 이미지·글을 예약 정보 추출을 위해 AI 분석 서비스(Anthropic, 미국)로 보내는 데 동의해요. 분석 직후 폐기되며 저장되지 않아요.
        </span>
      </label>
      {err && <p className="tb-bw-msg bad">{err}</p>}
      <button type="button" className="tb-cta small" onClick={() => void run()} disabled={busy || !agree}>
        {busy ? "읽는 중..." : "AI로 칸 채우기"}
      </button>
      <p className="tb-note">하루 {PARSE_DAILY_MAX}번까지 쓸 수 있어요. 잘 안 되면 직접 입력으로 바로 이어서 등록할 수 있어요.</p>
    </div>
  );
}
