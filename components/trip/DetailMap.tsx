"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { webglOk } from "@/lib/map-pins";
import type { ExtraPin, NearStation } from "./StayMap";

// 상세 페이지 '위치' 지도. 페이지에 들어오자마자 만들지 않고, 지도 자리가 화면 근처(250px)에 오면 단 한 번만 만든다
// (가격표만 보고 예약처로 가는 사람은 Mapbox 지도 로드가 0번). 한 번 만든 뒤에는 관찰을 끊어 다시 스크롤해도 새로 만들지 않는다.
// 자리는 높이를 고정해 두어 지도가 뜰 때 화면이 밀리지 않는다
const StayMap = dynamic(() => import("./StayMap"), { ssr: false, loading: () => <div className="tb-map-canvas tb-map-loading" aria-hidden /> });



type Props = { gps: [number, number]; label: string; name: string; onStation: (s: NearStation) => void; extras?: ExtraPin[] };

const NO_VIBE = { city: null, on: false, pick: null } as const;

export function DetailMap({ gps, label, name, onStation, extras }: Props) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() ?? "";
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === "undefined") return setNear(true);
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          io.disconnect();
          setNear(true);
        }
      },
      { rootMargin: "250px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  const can = !!token && (typeof document === "undefined" || webglOk());
  const pins = useMemo(() => [{ token: "here", lat: gps[0], lng: gps[1], label, low: false, on: true, name }], [gps[0], gps[1], label, name]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div ref={box} className="tb-dmap" aria-label={`${name} 위치 지도`}>
      {!can || failed ? (
        <p className="tb-dmap-off">이 화면에서는 지도를 열 수 없어요.</p>
      ) : near ? (
        <StayMap token={token} pins={pins} ring={gps} vibe={NO_VIBE} fit={{ padding: 40, maxZoom: 14.6 }} onPick={() => undefined} onFail={() => setFailed(true)} onStation={onStation} extras={extras} />
      ) : (
        <div className="tb-map-canvas tb-map-loading" aria-hidden />
      )}
    </div>
  );
}
