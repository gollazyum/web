"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import mapboxgl from "mapbox-gl";
import { useEffect, useRef } from "react";
import { circleRing } from "@/lib/map-pins";
import { VIBES, zonesGeoJSON, type City, type VibeKey } from "@/data/neighborhoodVibes";

// Mapbox 지도 본체. MapPanel이 지도를 실제로 띄울 때만 next/dynamic(ssr: false)으로 불러온다 (지도 로드 = Mapbox 과금 단위).
// 한 번 만든 지도는 그대로 두고, 핀·선택만 바꾼다 (필터를 바꿔도 지도를 다시 만들지 않는다).
// 오른쪽 아래 Mapbox 로고와 © Mapbox © OpenStreetMap 표기는 약관상 필요해 끄지 않는다
export type MapPin = { token: string; lat: number; lng: number; label: string; low: boolean; on: boolean; name: string; dim?: boolean };
// 동네 분위기: 도시(없으면 끔), 켜짐 여부, 고른 분위기 하나(없으면 전부)
export type VibeView = { city: City | null; on: boolean; pick: VibeKey | null };

type Props = { token: string; pins: MapPin[]; ring: [number, number] | null; vibe: VibeView; onPick: (token: string) => void; onVibe?: (k: VibeKey) => void; onFail: (why: "rejected" | "error") => void };

const RING_SRC = "tb-rings";

export default function StayMap({ token, pins, ring, vibe, onPick, onVibe, onFail }: Props) {
  const tags = useRef<mapboxgl.Marker[]>([]);
  const vibeRef = useRef(vibe);
  vibeRef.current = vibe;
  const vibePick = useRef(onVibe);
  vibePick.current = onVibe;
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
        style: "mapbox://styles/mapbox/streets-v12",
        pitch: 0,
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
    m.addControl(new ThreeDControl(), "top-right");
    m.on("error", (e) => {
      // 토큰이 틀렸거나 스타일을 못 받으면 목록으로 돌아간다
      const status = (e.error as { status?: number } | undefined)?.status;
      console.warn("[map] error", status ?? "", e.error?.message ?? "");
      if (status === 401 || status === 403) onFail("rejected");
    });
    m.on("style.load", () => applyTheme(m));
    m.on("load", () => {
      m.addSource(RING_SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "tb-rings", type: "line", source: RING_SRC, paint: { "line-color": "#1A1A18", "line-width": 1.5, "line-dasharray": [2, 2], "line-opacity": 0.55 } });
      m.addLayer({ id: "tb-ring-labels", type: "symbol", source: RING_SRC, layout: { "symbol-placement": "line", "text-field": ["get", "label"], "text-size": 11 }, paint: { "text-color": "#5D6475", "text-halo-color": "#FFFFFF", "text-halo-width": 1.5 } });
      drawRing(m, ring);
      drawVibes(m, vibeRef.current);
      placeTags(m, vibeRef.current);
    });
    // 동네 라벨은 중간 줌에서만 (멀면 지저분하고, 가까우면 가격 핀과 겹친다)
    const fade = () => {
      const z = m.getZoom();
      const hide = z < 10.5 || z >= 14.3;
      box.current?.classList.toggle("tb-vibe-hide", hide);
    };
    m.on("zoom", fade);
    m.on("moveend", () => declutter(m));
    m.once("load", fade);
    const ms = markers.current;
    const ts = tags.current;
    return () => {
      ts.forEach((mk) => mk.remove());
      ts.length = 0;
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
      el.classList.toggle("dim", !!p.dim && !p.on);
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

  useEffect(() => {
    const m = map.current;
    if (!m?.getSource(RING_SRC)) return; // 아직 load 전이면 load에서 그린다
    drawVibes(m, vibe);
    placeTags(m, vibe);
  }, [vibe.city?.id, vibe.on, vibe.pick]); // eslint-disable-line react-hooks/exhaustive-deps

  // 구역 이름표: 지도 글꼴은 컬러 이모지를 못 그려서 HTML 알약으로 띄운다. 누르면 그 분위기만 보기
  function placeTags(m: mapboxgl.Map, v: VibeView) {
    tags.current.forEach((mk) => mk.remove());
    tags.current = [];
    if (!v.city || !v.on) return;
    for (const z of v.city.zones) {
      if (v.pick && z.vibe !== v.pick) continue;
      const k = VIBES[z.vibe];
      const el = document.createElement("button");
      el.type = "button";
      el.className = "tb-vibe-tag";
      el.style.setProperty("--vc", k.color);
      el.dataset.r = String(z.radiusMeters);
      el.title = `${z.name} · ${z.desc}`;
      el.setAttribute("aria-label", `${z.name} ${k.label}: ${z.desc}`);
      const top = document.createElement("span");
      top.textContent = `${k.emoji} ${k.label}`;
      const sub = document.createElement("small");
      sub.textContent = z.name;
      el.append(top, sub);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        vibePick.current?.(z.vibe);
      });
      el.style.zIndex = "0";
      tags.current.push(new mapboxgl.Marker({ element: el, anchor: "center" }).setLngLat(z.center).addTo(m));
    }
    declutter(m);
  }

  // 이름표끼리 겹치면 큰 구역 것만 남긴다 (가까운 동네가 많은 난바·신주쿠에서 글자가 포개지지 않게). 확대하면 다시 보인다
  function declutter(m: mapboxgl.Map) {
    const list = [...tags.current].sort((a, b) => (b.getElement().dataset.r ? +b.getElement().dataset.r! : 0) - (a.getElement().dataset.r ? +a.getElement().dataset.r! : 0));
    const taken: { x0: number; y0: number; x1: number; y1: number }[] = [];
    for (const mk of list) {
      const el = mk.getElement();
      const pt = m.project(mk.getLngLat());
      const w = (el.offsetWidth || 140) / 2 + 4;
      const h = (el.offsetHeight || 36) / 2 + 2;
      const r = { x0: pt.x - w, y0: pt.y - h, x1: pt.x + w, y1: pt.y + h };
      const hit = taken.some((t) => r.x0 < t.x1 && r.x1 > t.x0 && r.y0 < t.y1 && r.y1 > t.y0);
      el.classList.toggle("tb-vibe-off", hit);
      if (!hit) taken.push(r);
    }
  }

  return <div ref={box} className="tb-map-canvas" />;
}

// 바탕은 streets-v12 그대로 (역 아이콘·철도·공원·도로 위계가 익숙하게 보이게). 추가 호출 없이 받은 스타일의 색·라벨만 조금 바꾼다.
// 물·공원은 부드럽게, 진한 주황 큰 도로는 지도 핀과 헷갈리지 않게 크림·앰버로.
// 라벨은 지명·장소 이름(name 계열)을 쓰는 레이어만 한국어 우선. 도로 번호판·출구 번호는 건드리지 않는다.
// 레이어 이름은 스타일 판마다 다를 수 있어 하나가 실패해도 나머지는 그대로 적용한다
const C = { water: "#BFE0F2", park: "#D8EBD6", motorway: "#F3D9A4", trunk: "#F7E4BE", motorwayCase: "#E2C48E", trunkCase: "#E8D3A8" };
const KO: mapboxgl.ExpressionSpecification = ["coalesce", ["get", "name_ko"], ["get", "name_en"], ["get", "name"]];
const NAME_REF = /"(name|name_en|name_local|name_ko|name_[a-z-]+)"/;
const NOT_NAME = /shield|road-number|motorway-junction|exit|ref|housenum|address/;

const set = (fn: () => void) => {
  try {
    fn();
  } catch {
    /* 이 스타일에 없는 레이어·속성은 건너뛴다 */
  }
};

function applyTheme(m: mapboxgl.Map) {
  const layers = m.getStyle()?.layers ?? [];
  for (const l of layers) {
    const src = (l as { "source-layer"?: string })["source-layer"] ?? "";
    const id = l.id;
    if (l.type === "fill") {
      if (src === "water" || id === "water") set(() => m.setPaintProperty(id, "fill-color", C.water));
      else if (/national-park/.test(id)) set(() => m.setPaintProperty(id, "fill-color", C.park));
    } else if (l.type === "line") {
      if (src === "waterway") set(() => m.setPaintProperty(id, "line-color", C.water));
      else if (/road-motorway-trunk|bridge-motorway-trunk|tunnel-motorway-trunk/.test(id)) {
        const cas = /case/.test(id);
        set(() => m.setPaintProperty(id, "line-color", ["match", ["get", "class"], "motorway", cas ? C.motorwayCase : C.motorway, cas ? C.trunkCase : C.trunk]));
      }
    } else if (l.type === "symbol") {
      const tf = (l as { layout?: Record<string, unknown> }).layout?.["text-field"];
      if (tf === undefined || NOT_NAME.test(id)) continue;
      if (NAME_REF.test(JSON.stringify(tf))) set(() => m.setLayoutProperty(id, "text-field", KO));
    }
  }
  // 공원·녹지: 기본 landuse 색 위에 같은 모양으로 한 번 덮는다 (원래 색 식을 건드리지 않게)
  const i = layers.findIndex((l) => l.id === "landuse");
  const src = Object.keys(m.getStyle()?.sources ?? {}).find((k) => /composite|streets/.test(k));
  if (i >= 0 && src && !m.getLayer("tb-parks")) {
    set(() =>
      m.addLayer(
        { id: "tb-parks", type: "fill", source: src, "source-layer": "landuse", filter: ["match", ["get", "class"], ["park", "grass", "cemetery", "pitch", "wood", "scrub", "garden", "golf_course"], true, false], paint: { "fill-color": C.park } },
        layers[i + 1]?.id,
      ),
    );
  }
}

// 첫 지명 라벨 레이어 (동네 구역 색은 이 아래에 깔아 글자를 가리지 않게)
function firstNameLayer(m: mapboxgl.Map): string | undefined {
  return (m.getStyle()?.layers ?? []).find((l) => l.type === "symbol" && NAME_REF.test(JSON.stringify((l as { layout?: Record<string, unknown> }).layout?.["text-field"] ?? "")))?.id;
}

// 3D 건물: 기본 꺼짐. 버튼을 누를 때만 기울이고 건물 레이어를 더한다
const B3D = "tb-3d-buildings";
function set3d(m: mapboxgl.Map, on: boolean) {
  if (on) {
    const src = Object.keys(m.getStyle()?.sources ?? {}).find((k) => /composite|streets/.test(k));
    if (src && !m.getLayer(B3D)) {
      set(() =>
        m.addLayer(
          {
            id: B3D,
            type: "fill-extrusion",
            source: src,
            "source-layer": "building",
            minzoom: 14.5,
            filter: ["==", ["get", "extrude"], "true"],
            paint: { "fill-extrusion-color": "#E8E4DC", "fill-extrusion-opacity": 0.55, "fill-extrusion-height": ["get", "height"], "fill-extrusion-base": ["get", "min_height"] },
          },
          firstNameLayer(m),
        ),
      );
    }
    m.easeTo({ pitch: 45, duration: 500 });
  } else {
    if (m.getLayer(B3D)) set(() => m.removeLayer(B3D));
    m.easeTo({ pitch: 0, duration: 400 });
  }
}

class ThreeDControl implements mapboxgl.IControl {
  private box: HTMLDivElement | null = null;
  onAdd(m: mapboxgl.Map) {
    const box = document.createElement("div");
    box.className = "mapboxgl-ctrl mapboxgl-ctrl-group tb-3d-ctrl";
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = "3D";
    b.setAttribute("aria-pressed", "false");
    b.setAttribute("aria-label", "건물 입체로 보기");
    b.addEventListener("click", () => {
      const on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", on ? "true" : "false");
      set3d(m, on);
    });
    box.appendChild(b);
    this.box = box;
    return box;
  }
  onRemove() {
    this.box?.remove();
    this.box = null;
  }
}

// 동네 분위기 구역: 도시 하나 = GeoJSON 소스 하나. 채우기는 지명 아래, 점선 외곽선. 투명도 기준은 줌 13 → 15 하나로
const VIBE_SRC = "tb-vibes";
function drawVibes(m: mapboxgl.Map, v: VibeView) {
  if (!m.getSource(VIBE_SRC)) {
    const before = firstNameLayer(m);
    set(() => {
      m.addSource(VIBE_SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "tb-vibe-fill", type: "fill", source: VIBE_SRC, paint: { "fill-color": ["get", "color"], "fill-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0.28, 15, 0.06] } }, before);
      m.addLayer({ id: "tb-vibe-line", type: "line", source: VIBE_SRC, paint: { "line-color": ["get", "color"], "line-width": 1.5, "line-dasharray": [2, 2], "line-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0.65, 15, 0.15] } }, before);
    });
  }
  const src = m.getSource(VIBE_SRC) as mapboxgl.GeoJSONSource | undefined;
  const data = v.city && v.on ? zonesGeoJSON(v.city) : { type: "FeatureCollection" as const, features: [] };
  if (v.pick) data.features = data.features.filter((f) => f.properties.vibe === v.pick);
  src?.setData(data);
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
