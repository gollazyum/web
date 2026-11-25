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
    m.on("style.load", () => applyTheme(m));
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

// 사이트 색에 맞춘 지도 (추가 호출 없음: 받은 기본 스타일의 색·라벨만 바꾼다).
// 바탕 스톤 오프화이트, 물 북유럽 블루, 공원 세이지 그린, 도로 흰색. 라벨은 한국어 우선, 없으면 원래 이름.
// 다른 여행 사이트처럼 동네·구 이름, 역 이름, 큰 도로 이름만 남기고 골목 이름과 가게·식당 같은 작은 장소는 숨긴다.
// 레이어 이름은 스타일 판마다 다를 수 있어 source-layer와 type으로 고르고, 하나가 실패해도 나머지는 그대로 적용한다
const C = { land: "#F4F1EA", water: "#CBE3EE", park: "#DFECE0", road: "#FFFFFF", casing: "#E7E0D4", building: "#ECE7DE", ink: "#1B2A4A", sub: "#6E7486", halo: "#FFFFFF" };
const KO: mapboxgl.ExpressionSpecification = ["coalesce", ["get", "name_ko"], ["get", "name"]];
const BIG_ROADS = ["motorway", "trunk", "primary"];

function applyTheme(m: mapboxgl.Map) {
  const set = (fn: () => void) => {
    try {
      fn();
    } catch {
      /* 이 스타일에 없는 속성은 건너뛴다 */
    }
  };
  const layers = m.getStyle()?.layers ?? [];
  let font: unknown = null;
  for (const l of layers) {
    const src = (l as { "source-layer"?: string })["source-layer"] ?? "";
    const id = l.id;
    if (l.type === "background") set(() => m.setPaintProperty(id, "background-color", C.land));
    else if (l.type === "fill") {
      if (src === "water") set(() => m.setPaintProperty(id, "fill-color", C.water));
      else if (src === "landuse" || src === "landuse_overlay" || src === "landcover" || /park|national/.test(id)) {
        set(() => m.setPaintProperty(id, "fill-color", ["match", ["get", "class"], ["park", "grass", "cemetery", "pitch", "wood", "scrub", "national_park", "golf_course"], C.park, C.land]));
      } else if (src === "building") set(() => m.setPaintProperty(id, "fill-color", C.building));
      else if (/^land$|land-structure/.test(id)) set(() => m.setPaintProperty(id, "fill-color", C.land));
    } else if (l.type === "line") {
      if (src === "waterway") set(() => m.setPaintProperty(id, "line-color", C.water));
      else if (src === "road") set(() => m.setPaintProperty(id, "line-color", /case/.test(id) ? C.casing : C.road));
    } else if (l.type === "symbol") {
      const layout = (l as { layout?: Record<string, unknown> }).layout ?? {};
      if (!font && layout["text-font"]) font = layout["text-font"];
      if (src === "poi_label" || src === "transit_stop_label" || src === "airport_label" || src === "road" || /poi|transit|road-label|road-number|road-exit/.test(id)) {
        set(() => m.setLayoutProperty(id, "visibility", "none")); // 아래에서 역·큰 도로만 다시 그린다
      } else if (layout["text-field"] !== undefined) {
        set(() => m.setLayoutProperty(id, "text-field", KO));
        if (src === "place_label") {
          set(() => m.setPaintProperty(id, "text-color", C.sub));
          set(() => m.setPaintProperty(id, "text-halo-color", C.halo));
        }
      }
    }
  }
  const textFont = (font as string[] | null) ?? ["DIN Pro Medium", "Arial Unicode MS Regular"];
  const src = Object.keys(m.getStyle()?.sources ?? {}).find((k) => /composite|streets/.test(k));
  if (!src) return;
  set(() => {
    if (m.getLayer("tb-road-names")) return;
    m.addLayer({
      id: "tb-road-names",
      type: "symbol",
      source: src,
      "source-layer": "road",
      minzoom: 12,
      filter: ["match", ["get", "class"], BIG_ROADS, true, false],
      layout: { "symbol-placement": "line", "text-field": KO, "text-font": textFont, "text-size": 11, "text-max-angle": 30, "symbol-spacing": 400 },
      paint: { "text-color": C.sub, "text-halo-color": C.halo, "text-halo-width": 1.4 },
    });
  });
  set(() => {
    if (m.getLayer("tb-stations")) return;
    m.addLayer({
      id: "tb-stations",
      type: "symbol",
      source: src,
      "source-layer": "transit_stop_label",
      minzoom: 11.5,
      filter: ["match", ["get", "mode"], ["rail", "metro_rail", "light_rail", "monorail", "tram"], true, false],
      layout: {
        "text-field": KO,
        "text-font": textFont,
        "text-size": ["interpolate", ["linear"], ["zoom"], 12, 11, 16, 13],
        "text-anchor": "top",
        "text-offset": [0, 0.5],
        "text-optional": true,
      },
      paint: { "text-color": C.ink, "text-halo-color": C.halo, "text-halo-width": 1.6 },
    });
    m.addLayer({
      id: "tb-station-dots",
      type: "circle",
      source: src,
      "source-layer": "transit_stop_label",
      minzoom: 11.5,
      filter: ["match", ["get", "mode"], ["rail", "metro_rail", "light_rail", "monorail", "tram"], true, false],
      paint: { "circle-radius": 3.5, "circle-color": C.ink, "circle-stroke-color": "#FFFFFF", "circle-stroke-width": 1.5 },
    });
  });
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
