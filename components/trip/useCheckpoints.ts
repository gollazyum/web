"use client";

import { useEffect, useState } from "react";
import { checkKey, ruleCheckpoints, type CheckInput, type Checkpoints } from "@/lib/checkpoints";
import type { HotelOption } from "@/lib/hotels";
import type { StayQuery } from "@/lib/trip";
import { askChecks } from "./api";

// 숙소 + 검색 조건마다 한 번만 AI를 부른다. 결과는 이 탭(sessionStorage)에 담고, 같은 숙소를 동시에 부르면 한 번만 보낸다.
// AI가 없거나 실패하면 규칙 결과를 담아 두고 다시 부르지 않는다
const PREFIX = "tb-check-v1:";
const mem = new Map<string, Checkpoints>();
const flying = new Map<string, Promise<void>>();

function read(key: string): Checkpoints | null {
  const hit = mem.get(key);
  if (hit) return hit;
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const c = JSON.parse(raw) as Checkpoints;
    if (typeof c.pros !== "string" || !Array.isArray(c.checks)) return null;
    mem.set(key, c);
    return c;
  } catch {
    return null;
  }
}

function write(key: string, c: Checkpoints) {
  mem.set(key, c);
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(c));
  } catch {
    // 저장소를 못 쓰면 이 화면에서만 기억한다
  }
}

export type CheckItem = { h: HotelOption; input: CheckInput; withTopics?: boolean };

// items: 체크포인트를 보여 줄 숙소들 (최대 3). enabled가 false면 부르지 않는다. rulesOnly면 AI 없이 규칙 결과만 (AI가 이미 실패한 화면)
export function useCheckpoints(items: CheckItem[], q: StayQuery, enabled: boolean, rulesOnly = false): Map<string, Checkpoints> {
  const keys = items.slice(0, 3).map((it) => checkKey(it.h.token, q, !!it.withTopics));
  const sig = keys.join(",");
  const [, bump] = useState(0);

  useEffect(() => {
    if (!enabled || rulesOnly || !keys.length) return;
    let live = true;
    const missing = items.slice(0, 3).map((it, i) => ({ it, key: keys[i] })).filter(({ key }) => !read(key) && !flying.has(key));
    const waits = keys.map((k) => flying.get(k)).filter(Boolean) as Promise<void>[];
    if (missing.length) {
      const p = askChecks(missing.map((m) => m.it.input)).then((r) => {
        missing.forEach((m, i) => {
          const got = r.ok ? r.data.items?.[i] : null;
          write(m.key, got && typeof got.pros === "string" && Array.isArray(got.checks) ? got : ruleCheckpoints(m.it.input));
          flying.delete(m.key);
        });
      });
      missing.forEach((m) => flying.set(m.key, p));
      waits.push(p);
    }
    if (waits.length) Promise.all(waits).then(() => live && bump((n) => n + 1));
    return () => {
      live = false;
    };
  }, [sig, enabled, rulesOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const out = new Map<string, Checkpoints>();
  if (rulesOnly) {
    items.slice(0, 3).forEach((it) => out.set(it.h.token, ruleCheckpoints(it.input)));
    return out;
  }
  items.slice(0, 3).forEach((it, i) => {
    const c = read(keys[i]);
    if (c) out.set(it.h.token, c);
    // 상세에서 후기 주제가 오기 전 같은 숙소의 체크포인트가 이미 있으면 그걸 먼저 보여 준다
    else if (it.withTopics) {
      const prev = read(checkKey(it.h.token, q, false));
      if (prev) out.set(it.h.token, prev);
    }
  });
  return out;
}
