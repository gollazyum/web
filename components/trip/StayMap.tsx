"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LMap, LayerGroup } from "leaflet";
import type { HotelOption } from "@/lib/hotels";
import { man, stayTotal } from "@/lib/trip";

type Props = {
  hotels: HotelOption[];
  nights: number;
  picked: Set<string>; // AI가 먼저 보여 준 곳 (민트 핀)
  active: string | null;
  onPick: (token: string) => void;
};

// v4 07번 전체 지도: 숙소 위치에 '2박 총액' 핀. 지도 그림은 OpenStreetMap (화면 구석에 표기)
export function StayMap({ hotels, nights, picked, active, onPick }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  // 지도 만들기 (한 번)
  useEffect(() => {
    let dead = false;
    import("leaflet").then((mod) => {
      if (dead || !box.current || map.current) return;
      L.current = mod;
      const m = mod.map(box.current, { zoomControl: false, attributionControl: true });
      mod.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(m);
      mod.control.zoom({ position: "topright" }).addTo(m);
      map.current = m;
      layer.current = mod.layerGroup().addTo(m);
      draw(true);
    });
    return () => {
      dead = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw(fit: boolean) {
    const mod = L.current;
    const m = map.current;
    if (!mod || !m || !layer.current) return;
    layer.current.clearLayers();
    const pts: [number, number][] = [];
    for (const h of hotels) {
      if (!h.gps) continue;
      const t = stayTotal(h, nights);
      const cls = `tb-pin${picked.has(h.token) ? " pick" : ""}${active === h.token ? " on" : ""}`;
      const icon = mod.divIcon({ className: "tb-pin-wrap", html: `<span class="${cls}">${t ? man(t.value) : "가격 확인"}</span>`, iconSize: [0, 0] });
      const mk = mod.marker(h.gps, { icon, zIndexOffset: active === h.token ? 1000 : picked.has(h.token) ? 500 : 0, keyboard: true, title: h.name });
      mk.on("click", () => onPickRef.current(h.token));
      mk.addTo(layer.current);
      pts.push(h.gps);
    }
    if (fit && pts.length) m.fitBounds(pts, { padding: [48, 48], maxZoom: 16 });
  }

  useEffect(() => {
    draw(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotels, nights]);

  useEffect(() => {
    draw(false);
    const h = hotels.find((x) => x.token === active);
    if (h?.gps && map.current) map.current.panTo(h.gps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, picked]);

  // 패널 크기가 바뀌면 (시트가 열릴 때 등) 지도 크기를 다시 잰다
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(() => map.current?.invalidateSize());
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  return <div ref={box} className="tb-map" role="region" aria-label="숙소 지도" />;
}
