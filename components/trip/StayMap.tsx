"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import mapboxgl from "mapbox-gl";
import { useEffect, useRef } from "react";
import { circleRing } from "@/lib/map-pins";

// Mapbox 지도 본체. MapPanel이 지도를 실제로 띄울 때만 next/dynamic(ssr: false)으로 불러온다 (지도 로드 = Mapbox 과금 단위).
// 한 번 만든 지도는 그대로 두고, 핀·선택만 바꾼다 (필터를 바꿔도 지도를 다시 만들지 않는다).
// 오른쪽 아래 Mapbox 로고와 © Mapbox © OpenStreetMap 표기는 약관상 필요해 끄지 않는다
export type MapPin = { token: string; lat: number; lng: number; label: string; low: boolean; on: boolean; name: string };

type Props = { token: string; pins: MapPin[]; ring: [number, number] | null; onPick: (token: string) => void; onFail: (why: "rejected" | "error") => void };

const RING_SRC = "tb-rings";

export default function StayMap({ token, pins, ring, onPick, onFail }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef(new Map<string, mapboxgl.Marker>());
  const fitted = useRef(false);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    if (!box.current) return;
    let m: mapboxgl.Map;
    try {
      mapboxgl.accessToken = token;
      m = new mapboxgl.Map({
        container: box.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [pins[0]?.lng ?? 135.5, pins[0]?.lat ?? 34.68],
        zoom: 13,
        attributionControl: true,
        cooperativeGestures: false,
        language: "ko",
      });
    } catch (e) {
      console.warn("[map] init", e instanceof Error ? e.message : e);
      onFail("error");
      return;
    }
    map.current = m;
    m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    m.on("error", (e) => {
      // 토큰이 틀렸거나 스타일을 못 받으면 목록으로 돌아간다
      const status = (e.error as { status?: number } | undefined)?.status;
      console.warn("[map] error", status ?? "", e.error?.message ?? "");
      if (status === 401 || status === 403) onFail("rejected");
    });
    m.on("load", () => {
      m.addSource(RING_SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "tb-rings", type: "line", source: RING_SRC, paint: { "line-color": "#1B2A4A", "line-width": 1.5, "line-dasharray": [2, 2], "line-opacity": 0.55 } });
      m.addLayer({ id: "tb-ring-labels", type: "symbol", source: RING_SRC, layout: { "symbol-placement": "line", "text-field": ["get", "label"], "text-size": 11 }, paint: { "text-color": "#5D6475", "text-halo-color": "#FFFFFF", "text-halo-width": 1.5 } });
      drawRing(m, ring);
    });
    const ms = markers.current;
    return () => {
      ms.forEach((mk) => mk.remove());
      ms.clear();
      m.remove();
      map.current = null;
      fitted.current = false;
    };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // 핀: 새로 생긴 것만 만들고, 빠진 것은 지운다. 글자·강조는 매번 맞춘다
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const ms = markers.current;
    const keep = new Set(pins.map((p) => p.token));
    ms.forEach((mk, t) => {
      if (!keep.has(t)) {
        mk.remove();
        ms.delete(t);
      }
    });
    for (const p of pins) {
      let mk = ms.get(p.token);
      if (!mk) {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "tb-pin";
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          pickRef.current(p.token);
        });
        mk = new mapboxgl.Marker({ element: el, anchor: "bottom" }).setLngLat([p.lng, p.lat]).addTo(m);
        ms.set(p.token, mk);
      }
      const el = mk.getElement() as HTMLButtonElement;
      el.textContent = p.label;
      el.setAttribute("aria-label", `${p.name} ${p.label}`);
      el.setAttribute("aria-pressed", p.on ? "true" : "false");
      el.classList.toggle("low", p.low);
      el.classList.toggle("on", p.on);
      el.style.zIndex = p.on ? "3" : p.low ? "2" : "1";
    }
    // 처음 한 번은 모든 핀이 보이게 맞춘다
    if (!fitted.current && pins.length) {
      fitted.current = true;
      const b = new mapboxgl.LngLatBounds();
      pins.forEach((p) => b.extend([p.lng, p.lat]));
      m.fitBounds(b, { padding: { top: 60, bottom: 140, left: 40, right: 40 }, maxZoom: 15, duration: 0 });
    }
  }, [pins]);

  useEffect(() => {
    const m = map.current;
    if (m?.isStyleLoaded()) drawRing(m, ring);
    if (m && ring) m.easeTo({ center: [ring[1], ring[0]], duration: 400 });
  }, [ring]);

  return <div ref={box} className="tb-map-canvas" />;
}

function drawRing(m: mapboxgl.Map, ring: [number, number] | null) {
  const src = m.getSource(RING_SRC) as mapboxgl.GeoJSONSource | undefined;
  if (!src) return;
  src.setData({
    type: "FeatureCollection",
    features: ring
      ? [400, 800].map((r) => ({ type: "Feature" as const, properties: { label: `${r}m` }, geometry: { type: "LineString" as const, coordinates: circleRing(ring[0], ring[1], r) } }))
      : [],
  });
}
