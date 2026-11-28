"use client";

import { useEffect, useState } from "react";
import { ALERT_MIN_WON, CAP_MESSAGE, DEVICE_MAX, kstLocalToMs, LATE_MESSAGE, tooLate, watchUntil } from "@/lib/booking-watch";
import { HOTEL_SELLER_ALLOWLIST, linkRel, sellerDef, sellerSearchUrl, type HotelSellerKey } from "@/lib/hotel-sellers";
import type { SellerRow } from "@/lib/hotels";
import { won, type StayQuery } from "@/lib/trip";
import type { PublicWatch } from "@/lib/booking-watch-server";
import { IconOut } from "./icons";
import { BookingRegister, removeLocalBooking, useLocalBookings } from "./BookingRegister";
import type { SavedLike } from "./saved-price";

// 가격 지킴이 (예약한 숙소 가격 지켜보기) 화면.
// 로그인 없이 이 기기에서 만든 임의 번호로 등록한 예약을 찾는다. 가격 확인은 서버가 하루 한 번(체크인이 멀면 3.5일에 한 번) 한다

const DEVICE_KEY = "tb-device-v1";
const subs = new Set<() => void>();
const changed = () => subs.forEach((f) => f());
export const watchesChanged = changed;

export function device(create: boolean): string | null {
  try {
    const got = localStorage.getItem(DEVICE_KEY);
    if (got || !create) return got;
    const id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return null;
  }
}

export async function post<T>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json().catch(() => ({}))) as T & { message?: string };
    return r.ok ? { ok: true, data: j } : { ok: false, message: j.message ?? "지금은 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요" };
  } catch {
    return { ok: false, message: "연결이 불안정해요. 잠시 뒤 다시 시도해 주세요" };
  }
}

const md = (iso: string) => `${Number(iso.slice(5, 7))}.${Number(iso.slice(8, 10))}`;
const kstText = (iso: string) => {
  const d = new Date(Date.parse(iso) + 9 * 3_600_000);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};
export const vendorKo = (k: string | null) => (k && HOTEL_SELLER_ALLOWLIST.some((s) => s.key === k) ? sellerDef(k as HotelSellerKey).ko : k ?? "");

// ---------- 비교창: 예약했어요 ----------
export function BookedWatch({ hotel, query, rows }: { hotel: { token: string; name: string }; query: StayQuery; rows: SellerRow[] }) {
  const [open, setOpen] = useState(registering);
  const [price, setPrice] = useState(String(rows[0]?.cost ?? ""));
  const [vendor, setVendor] = useState<string>(rows[0]?.key ?? "");
  const [fcu, setFcu] = useState("");
  const [refundable, setRefundable] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // 객실 2개 이상·아이 포함 검색은 같은 조건의 가격을 정확히 받기 어려워 아직 받지 않는다
  if ((query.rooms ?? 1) > 1 || (query.childAges?.length ?? 0) > 0) return null;

  const until = watchUntil(query.checkIn, fcu ? kstLocalToMs(fcu) : null);
  const late = tooLate(query.checkIn, until, Date.now());
  const n = Number(price.replace(/[^\d]/g, ""));

  async function submit() {
    if (busy) return;
    if (!refundable) return setMsg({ ok: false, text: "무료 취소가 되는 예약만 지켜볼 수 있어요. 환불이 안 되면 더 싼 가격으로 다시 예약하기 어려워요" });
    if (!(n >= 1000)) return setMsg({ ok: false, text: "결제한 총액을 원 단위로 적어 주세요" });
    if (late) return setMsg({ ok: false, text: LATE_MESSAGE });
    const id = device(true);
    if (!id) return setMsg({ ok: false, text: "이 브라우저에서는 저장할 수 없어요" });
    setBusy(true);
    const r = await post<{ watch: PublicWatch }>("/api/bookings/watch", {
      device: id,
      token: hotel.token,
      name: hotel.name,
      place: query.place,
      checkIn: query.checkIn,
      checkOut: query.checkOut,
      adults: query.adults,
      bookedPrice: n,
      bookedVendor: vendor || null,
      freeCancelUntil: fcu || null,
    });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.message });
    setMsg({ ok: true, text: "가격 지킴이에 등록했어요. 가격이 내리면 내 여행 탭 맨 위에 알려 드려요" });
    endRegister(); // changed()도 부른다
  }

  if (!open)
    return (
      <div className="tb-bw-entry">
        <button type="button" className="tb-bw-pill" onClick={() => setOpen(true)}>
          예약 등록하고 취소 기한까지 지켜보기
        </button>
        <small>이미 무료 취소로 예약했다면, 취소 기한 전에 더 낮은 총액이 나오는지 지켜보고 내 여행에서 알려 드려요</small>
      </div>
    );
  return (
    <form
      className="tb-bw-form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <strong>예약한 내용을 적어 주세요</strong>
      <label>
        <span>결제한 총액 ({query.checkIn.slice(5).replace("-", ".")}–{query.checkOut.slice(5).replace("-", ".")}, 세금 포함)</span>
        <input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="예: 320000" />
      </label>
      <label>
        <span>예약한 곳</span>
        <select value={vendor} onChange={(e) => setVendor(e.target.value)}>
          {HOTEL_SELLER_ALLOWLIST.map((s) => (
            <option key={s.key} value={s.key}>
              {s.ko}
            </option>
          ))}
          <option value="">그 밖의 곳</option>
        </select>
      </label>
      <label>
        <span>무료 취소 마감 (한국 시간, 모르면 비워 두세요)</span>
        <input type="datetime-local" value={fcu} onChange={(e) => setFcu(e.target.value)} max={`${query.checkIn}T23:59`} />
      </label>
      <label className="tb-bw-check">
        <input type="checkbox" checked={refundable} onChange={(e) => setRefundable(e.target.checked)} />
        <span>무료 취소가 되는 예약이에요</span>
      </label>
      {late ? <p className="tb-bw-msg bad">{LATE_MESSAGE}</p> : <p className="tb-note">마감 6시간 전({kstText(new Date(until).toISOString())})까지 지켜봐요. 마감을 비워 두면 체크인 전날 18시까지예요.</p>}
      {msg && <p className={`tb-bw-msg${msg.ok ? "" : " bad"}`}>{msg.text}</p>}
      {!msg?.ok && (
        <button type="submit" className="tb-cta small" disabled={busy || late}>
          {busy ? "등록하는 중" : "가격 지킴이 등록"}
        </button>
      )}
    </form>
  );
}

// ---------- 이 기기의 가격 지킴이 목록 (홈 배너·내 여행 탭이 같이 쓴다) ----------
// 등록한 적이 없는 기기(번호 없음)는 서버에 묻지 않는다. 서버는 Supabase만 읽는다 (외부 검색 호출 없음)
let shared: { at: number; list: PublicWatch[] } | null = null;
let loading: Promise<PublicWatch[]> | null = null;
async function fetchWatches(force = false): Promise<PublicWatch[]> {
  const id = device(false);
  if (!id) return [];
  if (!force && shared && Date.now() - shared.at < 60_000) return shared.list;
  if (!force && loading) return loading;
  loading = post<{ watches: PublicWatch[]; alertMinWon?: number }>("/api/bookings/list", { device: id }).then((r) => {
    loading = null;
    if (r.ok && typeof r.data.alertMinWon === "number" && r.data.alertMinWon > 0) alertMin = r.data.alertMinWon;
    const list = r.ok ? r.data.watches : (shared?.list ?? []);
    shared = { at: Date.now(), list };
    return list;
  });
  return loading;
}

// 알림 기준 금액 (서버 환경변수 값을 목록 응답으로 받는다. 받기 전에는 기본 5,000원)
let alertMin = ALERT_MIN_WON;

// ---------- 내 여행 탭 예약 상세: 예약 후 가격 지킴이 카드 ----------
// 무료 취소 마감 · 마지막 확인 시각 · 알림 안내. 가격은 정해진 때마다 확인하므로 '바로/실시간'이라고 쓰지 않는다
export function AfterBookingCard({ w }: { w: PublicWatch }) {
  const min = won(alertMin);
  return (
    <div className="tb-abw" role="group" aria-label="예약 후 가격 지킴이">
      <strong className="tb-abw-title">예약 후 가격 지킴이</strong>
      <dl>
        <div>
          <dt>무료 취소 마감</dt>
          <dd>{w.freeCancelUntil ? kstText(w.freeCancelUntil) : "입력하지 않았어요"}</dd>
        </div>
        <div>
          <dt>마지막 확인</dt>
          <dd>{w.checkedAt ? kstText(w.checkedAt) : "아직 확인 전이에요"}</dd>
        </div>
      </dl>
      <p className="tb-note">
        {w.status === "active"
          ? `예약한 가격보다 ${min} 이상 내려가면 여기에서 알려 드려요. 알린 뒤에는 그 가격보다 ${min} 이상 더 내려가면 다시 알려 드려요. 가격은 정해진 때마다 확인해서 지금 가격과 조금 다를 수 있어요.`
          : "지켜보기가 끝난 예약이에요. 더는 가격을 확인하지 않아요."}
      </p>
    </div>
  );
}

export function useWatches(): [PublicWatch[] | null, (fn: (l: PublicWatch[] | null) => PublicWatch[] | null) => void] {
  const [list, setList] = useState<PublicWatch[] | null>(shared?.list ?? null);
  useEffect(() => {
    let live = true;
    const load = (force: boolean) => fetchWatches(force).then((l) => live && setList(l));
    void load(false);
    const onChange = () => void load(true);
    subs.add(onChange);
    return () => {
      live = false;
      subs.delete(onChange);
    };
  }, []);
  const update = (fn: (l: PublicWatch[] | null) => PublicWatch[] | null) =>
    setList((l) => {
      const next = fn(l);
      if (next) shared = { at: Date.now(), list: next };
      return next;
    });
  return [list, update];
}

// 내려간 예약: 지켜보는 중이고, 알림 기준 금액(기본 5,000원) 이상 내려가 알린 예약
export const droppedOf = (list: PublicWatch[]) => list.filter((w) => w.status === "active" && w.alerted && w.latest !== null && w.latest < w.bookedPrice);

// ---------- 홈: 내 가격 지킴이 요약 배너 ----------
export function WatchBanner({ onOpen }: { onOpen: () => void }) {
  const [list] = useWatches();
  const active = (list ?? []).filter((w) => w.status === "active");
  const drops = droppedOf(active);
  const saved = drops.reduce((a, w) => a + (w.bookedPrice - (w.latest as number)), 0);
  return (
    <button type="button" className="tb-wbanner" onClick={onOpen}>
      <span className="tb-wbanner-text">
        <small>내 가격 지킴이</small>
        {active.length ? (
          <>
            <strong>지켜보는 예약 {active.length}건</strong>
            {drops.length ? (
              <span>
                {drops.length}건이 내려갔어요 · 합계 <b>{won(saved)}</b>
              </span>
            ) : (
              <span>아직 내려간 예약은 없어요. 체크인 전까지 계속 지켜봐요</span>
            )}
          </>
        ) : (
          <strong>예약한 숙소가 더 싸졌는지 체크인 전까지 지켜봐 드려요</strong>
        )}
      </span>
      <span className="tb-wbanner-go" aria-hidden>
        {/* PC: 오른쪽 텍스트 링크 / 휴대폰: 화살표만 */}
        <span className="tb-only-pc">{active.length ? "지켜보는 예약 보기" : "예약 등록하기"} </span>→
      </span>
    </button>
  );
}

// ---------- 숙소 검색해서 내 예약 등록하기 ----------
// 내 여행 탭에서 시작하면 이 탭(sessionStorage)에 표시를 남긴다. 숙소 상세를 열면 등록 칸이 바로 펼쳐지고, 등록하면 표시를 지운다
const REG_KEY = "tb-bw-register";
export const startRegister = () => {
  try {
    sessionStorage.setItem(REG_KEY, "1");
  } catch {
    // 저장소를 못 쓰면 안내만
  }
};
export const registering = () => {
  try {
    return sessionStorage.getItem(REG_KEY) === "1";
  } catch {
    return false;
  }
};
export const endRegister = () => {
  try {
    sessionStorage.removeItem(REG_KEY);
  } catch {
    // 없음
  }
  changed();
};

// 홈 맨 위 안내 (등록 중일 때만)
export function RegisterHint() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const f = () => setOn(registering());
    f();
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  }, []);
  if (!on) return null;
  return (
    <div className="tb-reghint" role="status">
      <p>
        <b>내 예약 등록하기</b> 예약한 숙소를 <b>예약한 날짜·인원</b>으로 검색한 뒤, 그 숙소를 눌러 <b>가격 변동 알림 등록</b>을 눌러 주세요.
      </p>
      <button type="button" className="tb-link" onClick={endRegister}>
        그만하기
      </button>
    </div>
  );
}

// ---------- 내 여행 탭: 가격 지킴이 목록 ----------
export function BookingWatchBox({ saved }: { saved: SavedLike[] }) {
  const [list, setList] = useWatches();
  const locals = useLocalBookings();
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [reg, setReg] = useState(false);
  // 홈 '예약한 숙소 등록하기'에서 넘어오면 등록 창을 바로 연다
  useEffect(() => {
    if (registering()) {
      setReg(true);
      endRegister();
    }
  }, []);

  const modal = <BookingRegister open={reg} onClose={() => setReg(false)} saved={saved} watches={list} />;
  const addBtn = (
    <button type="button" className="tb-btn tb-bw-add" onClick={() => setReg(true)}>
      + 예약 완료한 숙소 등록하기
    </button>
  );
  const localList = locals.length > 0 && (
    <ul className="tb-bw-list tb-bw-local" aria-label="이 기기에만 저장한 예약">
      {locals.map((b) => (
        <li key={b.id}>
          <div className="tb-bw-row static">
            <span>
              <strong>{b.name}</strong>
              <small>
                {[b.place, `${md(b.checkIn)}–${md(b.checkOut)}`, `성인 ${b.adults}명`, `${won(b.bookedPrice)}${b.bookedVendor ? ` · ${vendorKo(b.bookedVendor)}` : ""}`].filter(Boolean).join(" · ")}
              </small>
              {b.why && <small className="tb-bw-why">{b.why}</small>}
            </span>
            <button type="button" className="tb-link" onClick={() => removeLocalBooking(b.id)}>
              지우기
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
  if (list === null && !locals.length)
    return (
      <>
        {addBtn}
        {modal}
      </>
    );
  const all = list ?? [];
  const active = all.filter((w) => w.status === "active");
  const drops = droppedOf(active);
  if (!all.length)
    return (
      <section className="tb-watch tb-bw" aria-label="예약한 숙소 가격 지킴이">
        <div className="tb-watch-head">
          <strong>내 예약 가격 지킴이</strong>
          <small>무료 취소로 예약한 숙소가 체크인 전에 더 싸지면 여기에서 알려 드려요</small>
        </div>
        {localList}
        {addBtn}
        <p className="tb-note">예약 확정 메일이나 영수증으로 칸을 채울 수도 있어요. 무료 취소 예약이면 체크인 전까지 가격 하락을 대신 확인해 드려요.</p>
        {modal}
      </section>
    );

  async function recheck(w: PublicWatch) {
    const id = device(false);
    if (!id || busy) return;
    setBusy(w.id);
    const r = await post<{ watch: PublicWatch; message?: string }>(`/api/bookings/${w.id}/recheck`, { device: id });
    setBusy(null);
    if (!r.ok) return setNote((n) => ({ ...n, [w.id]: r.message || CAP_MESSAGE }));
    setList((l) => l?.map((x) => (x.id === w.id ? r.data.watch : x)) ?? null);
    setNote((n) => ({ ...n, [w.id]: r.data.message ?? "방금 다시 확인했어요" }));
  }
  async function stop(w: PublicWatch) {
    const id = device(false);
    if (!id) return;
    const r = await post(`/api/bookings/${w.id}/stop`, { device: id });
    if (r.ok) setList((l) => l?.filter((x) => x.id !== w.id) ?? null);
  }

  return (
    <section className={`tb-watch tb-bw${drops.length ? " down" : ""}`} aria-label="예약한 숙소 가격 지킴이">
      <div className="tb-watch-head">
        <strong>{drops.length ? `예약한 뒤 가격이 내렸어요 ${drops.length}곳` : "예약한 숙소 가격 지킴이"}</strong>
        <small>
          무료 취소 마감 6시간 전까지 지켜봐요 · 최대 {DEVICE_MAX}개
        </small>
      </div>
      <ul className="tb-bw-list">
        {all.map((w) => {
          const diff = w.latest !== null ? w.bookedPrice - w.latest : null;
          const down = w.status === "active" && w.alerted && diff !== null && diff > 0;
          const q = { checkIn: w.checkIn, checkOut: w.checkOut, adults: w.adults };
          const vendorKey = (w.latestVendor && HOTEL_SELLER_ALLOWLIST.some((s) => s.key === w.latestVendor) ? w.latestVendor : null) as HotelSellerKey | null;
          return (
            <li key={w.id} className={down ? "down" : ""}>
              <button type="button" className="tb-bw-row" onClick={() => setOpen(open === w.id ? null : w.id)} aria-expanded={open === w.id}>
                <span>
                  <strong>{w.name}</strong>
                  <small>
                    {[w.place, `${md(w.checkIn)}–${md(w.checkOut)}`, `성인 ${w.adults}명`].filter(Boolean).join(" · ")}
                  </small>
                </span>
                <span className="tb-watch-price">
                  {down ? (
                    <>
                      <b>{won(w.latest!)}</b>
                      <em>{won(diff!)}↓</em>
                    </>
                  ) : w.status !== "active" ? (
                    <small>지켜보기 끝</small>
                  ) : w.checkedAt ? (
                    <small>아직 내리지 않았어요</small>
                  ) : (
                    <small>첫 확인 준비 중</small>
                  )}
                </span>
              </button>
              {open === w.id && (
                <div className="tb-bw-detail">
                  <AfterBookingCard w={w} />
                  <dl>
                    <div>
                      <dt>예약한 총액</dt>
                      <dd>
                        {won(w.bookedPrice)}
                        {w.bookedVendor ? ` · ${vendorKo(w.bookedVendor)}` : ""}
                      </dd>
                    </div>
                    <div>
                      <dt>지금 가장 낮은 총액</dt>
                      <dd>{w.latest !== null ? `${won(w.latest)}${w.latestVendor ? ` · ${vendorKo(w.latestVendor)}` : ""} (예상)` : "아직 확인 전"}</dd>
                    </div>
                    <div>
                      <dt>지켜보기 끝</dt>
                      <dd>{kstText(w.watchUntil)}</dd>
                    </div>
                  </dl>
                  {down && (
                    <>
                      <p className="tb-bw-warn">
                        {w.latestFreeCancel ? "무료 취소 요금으로 확인했어요." : "무료 취소 여부는 결제 화면에서 확인해 주세요."} 세금·객실 종류·조식 조건이 처음 예약과 같은지 꼭 확인해 주세요.
                      </p>
                      <ol className="tb-bw-steps">
                        <li>새 가격으로 먼저 예약해요</li>
                        <li>새 예약 확정 메일을 받았는지 확인해요</li>
                        <li>처음 예약을 직접 취소해요 (무료 취소 마감 전에)</li>
                      </ol>
                      <p className="tb-note">대신 예약하거나 취소해 드리지 않아요. 순서를 지키면 방이 없어지는 일을 막을 수 있어요.</p>
                      {vendorKey && (
                        <a className="tb-cta small" href={sellerSearchUrl(vendorKey, w.name, q)} target="_blank" rel={linkRel(vendorKey)}>
                          {sellerDef(vendorKey).ko}에서 새 가격 보기 <IconOut />
                        </a>
                      )}
                    </>
                  )}
                  {note[w.id] && <p className="tb-bw-msg">{note[w.id]}</p>}
                  <div className="tb-bw-actions">
                    {w.status === "active" && (
                      <button type="button" className="tb-link" onClick={() => void recheck(w)} disabled={busy === w.id}>
                        {busy === w.id ? "확인하는 중" : "지금 다시 확인"}
                      </button>
                    )}
                    <button type="button" className="tb-link" onClick={() => void stop(w)}>
                      {w.status === "active" ? "그만 지켜보기" : "목록에서 지우기"}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {localList}
      {addBtn}
      {modal}
    </section>
  );
}
