import { VIBES, zoneAt } from "@/data/neighborhoodVibes";

// 숙소가 동네 분위기 구역 안에 있으면 작은 태그 (참고용). gps는 [lat, lng]
export function VibeTag({ gps, detail }: { gps: [number, number] | null | undefined; detail?: boolean }) {
  if (!gps || !Number.isFinite(gps[0]) || !Number.isFinite(gps[1])) return null;
  const z = zoneAt([gps[1], gps[0]]);
  if (!z) return null;
  const v = VIBES[z.vibe];
  if (!detail) {
    return (
      <span className="tb-vibe-line" style={{ ["--vc" as string]: v.color }}>
        {v.emoji} {v.label} · {z.name}
      </span>
    );
  }
  return (
    <p className="tb-vibe-detail" style={{ ["--vc" as string]: v.color }}>
      <b>
        {v.emoji} {v.label} · {z.name}
      </b>
      <span>{z.desc}</span>
      <small>참고용 동네 분위기예요 (상권 특성 기준)</small>
    </p>
  );
}
