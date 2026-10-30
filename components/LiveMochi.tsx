"use client";

import { useEffect, useRef, useState } from "react";
import { LowbotiBot } from "./LowbotiBot";

// 브랜드 키트의 "살아 움직이는 로보티": 혼자 두리번거리고, 마우스를 따라보고,
// 누르면 말랑하게 찌그러지고, 세 번 누르면 깡충 뛴다. 오래 두면 졸고, 질문을 받으면 갸우뚱한다.
const talks = [
  "👀 두리번두리번... 숨은 특가 어디 있지?",
  "🔍 저쪽에 더 싼 방이 있을지도!",
  "✈️ 오늘은 어디로 떠나 볼까요?",
  "💡 아래 예시 질문을 눌러 봐도 좋아요!",
  "🙌 저를 세 번 콕콕콕 눌러 보세요!",
];
const SLEEP_AFTER_MS = 30000;

// talks·greeting을 주면 그 화면에 맞는 혼잣말을 한다. compact는 작은 칸(결과 화면 도우미)용
type Props = { thinking?: boolean; talks?: string[]; greeting?: string; compact?: boolean };

export function LiveMochi({ thinking = false, talks: customTalks, greeting, compact = false }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const mochiRef = useRef<HTMLDivElement>(null);
  const actRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const [bubble, setBubble] = useState(greeting ?? "🍡 안녕하세요! 여행에 관한 건 뭐든 물어보세요.");
  const talksRef = useRef(customTalks ?? talks);
  talksRef.current = customTalks ?? talks;
  const [swap, setSwap] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [sleeping, setSleeping] = useState(false);
  const [zoom, setZoom] = useState(false);
  const api = useRef<{ say: (t: string) => void; look: (x: number, y: number) => void; hop: () => void; wake: () => void } | null>(null);
  const thinkingRef = useRef(thinking);

  useEffect(() => {
    const stage = stageRef.current!, mochi = mochiRef.current!, act = actRef.current!, shadow = shadowRef.current!;
    const eyes = act.querySelector<SVGGElement>(".lb-eyes")!;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
    };

    let current = "";
    let isTracking = false;
    let isSleeping = false;
    let trackTimer: ReturnType<typeof setTimeout> | undefined;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let sleepTimer: ReturnType<typeof setTimeout> | undefined;

    function say(text: string) {
      if (current === text) return;
      current = text;
      setSwap(true);
      later(() => {
        setBubble(text);
        setSwap(false);
      }, 180);
    }
    const look = (x: number, y: number) => (eyes.style.transform = `translate(${x}px, ${y}px)`);
    // 한 번만 하는 동작은 몸(lb-act)에 붙였다 끝나면 뗀다
    const clearAct = () => act.classList.remove("lb-hop", "lb-poke", "lb-tilt");
    function play(cls: "lb-hop" | "lb-poke" | "lb-tilt") {
      if (reduceMotion) return;
      clearAct();
      void act.offsetWidth;
      act.classList.add(cls);
      if (cls === "lb-hop") {
        shadow.classList.remove("jump");
        void shadow.offsetWidth;
        shadow.classList.add("jump");
      }
    }
    const onActEnd = (e: AnimationEvent) => {
      if (e.target !== act) return; // 눈 깜빡임 같은 안쪽 애니메이션은 무시
      clearAct();
      shadow.classList.remove("jump");
    };
    act.addEventListener("animationend", onActEnd);

    function hop() {
      look(0, -1.5);
      setZoom(true);
      play("lb-hop");
      later(() => setZoom(false), 1400);
    }

    // 한동안 아무도 안 건드리면 꾸벅꾸벅 존다
    function armSleep() {
      clearTimeout(sleepTimer);
      sleepTimer = setTimeout(() => {
        if (thinkingRef.current || document.hidden) return armSleep();
        isSleeping = true;
        setSleeping(true);
        look(0, 1);
        say("😴 쿨쿨... 저를 깨워 주세요");
      }, SLEEP_AFTER_MS);
    }
    function wake(quiet = false) {
      if (isSleeping) {
        isSleeping = false;
        setSleeping(false);
        look(0, 0);
        if (!quiet) say("😳 앗, 깼어요! 무엇이 궁금하세요?");
      }
      armSleep();
    }
    armSleep();
    api.current = { say, look, hop, wake: () => wake(true) };

    const line = (i: number) => talksRef.current[i % talksRef.current.length];
    // 혼자 노는 중: 2.5~5.5초마다 하나씩
    const IDLE = [
      () => {
        look(-4.5, -1);
        say(line(0));
      },
      () => {
        look(4.5, -1);
        say(line(1));
      },
      () => {
        look(1, -3);
        play("lb-tilt");
        say(line(2));
      },
      () => {
        look(0, 0);
        say(line(3));
      },
      () => {
        look(0, 0);
        play("lb-hop");
        say(line(4));
      },
    ];
    function scheduleIdle() {
      idleTimer = setTimeout(() => {
        if (!isTracking && !isSleeping && !thinkingRef.current && !document.hidden) {
          IDLE[Math.floor(Math.random() * IDLE.length)]();
        }
        scheduleIdle();
      }, 2500 + Math.random() * 3000);
    }
    scheduleIdle();

    // 마우스 따라보기 (터치는 콕 찌르기만)
    function onMove(e: PointerEvent) {
      if (e.pointerType !== "mouse") return;
      wake();
      if (thinkingRef.current) return;
      if (!isTracking) {
        isTracking = true;
        setTracking(true);
      }
      const r = mochi.getBoundingClientRect();
      const dx = Math.max(-5, Math.min(5, (e.clientX - (r.left + r.width / 2)) / 22));
      const dy = Math.max(-3.5, Math.min(3.5, (e.clientY - (r.top + r.height / 2)) / 22));
      look(dx, dy);
      clearTimeout(trackTimer);
      trackTimer = setTimeout(() => {
        isTracking = false;
        setTracking(false);
      }, 1800);
    }
    function onLeave() {
      clearTimeout(trackTimer);
      isTracking = false;
      setTracking(false);
      if (!thinkingRef.current && !isSleeping) look(0, 0);
    }
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerleave", onLeave);

    // 콕 찌르기, 1.2초 안에 3번이면 깡충
    let taps = 0;
    let tapTimer: ReturnType<typeof setTimeout> | undefined;
    function poke() {
      if (isSleeping) return wake();
      armSleep();
      taps++;
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => (taps = 0), 1200);
      if (taps >= 3) {
        taps = 0;
        hop();
        say("🎉 깡충! 콕콕콕 성공이에요!");
        return;
      }
      play("lb-poke");
      say(taps === 1 ? "😆 헤헤, 간지러워요!" : "😳 한 번만 더 누르면...!");
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        poke();
      }
    }
    mochi.addEventListener("click", poke);
    mochi.addEventListener("keydown", onKey);

    return () => {
      clearTimeout(idleTimer);
      clearTimeout(trackTimer);
      clearTimeout(sleepTimer);
      clearTimeout(tapTimer);
      timers.forEach(clearTimeout);
      act.removeEventListener("animationend", onActEnd);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", onLeave);
      mochi.removeEventListener("click", poke);
      mochi.removeEventListener("keydown", onKey);
      api.current = null;
    };
  }, []);

  // 질문을 보내면 갸우뚱, 답이 오면 깡충
  useEffect(() => {
    const was = thinkingRef.current;
    thinkingRef.current = thinking;
    const a = api.current;
    if (!a) return;
    if (thinking) {
      a.wake();
      a.look(0, 0);
      a.say("🤔 음... 잠깐만요, 생각 중이에요!");
    } else if (was) {
      a.hop();
      a.say("😊 답을 드렸어요! 더 궁금한 건 없으세요?");
    }
  }, [thinking]);

  const states = [thinking && "lb-st-ask", sleeping && !thinking && "lb-st-sleep", zoom && "lb-st-zoom", tracking && "fast"]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={stageRef} className={`mochi-stage${compact ? " compact" : ""} ${states}`}>
      <span className={`mochi-badge${tracking ? " tracking" : ""}${thinking ? " thinking" : ""}${sleeping && !thinking ? " sleeping" : ""}`}>
        <i /> {thinking ? "생각하는 중" : sleeping ? "조는 중" : tracking ? "보고 있어요!" : "혼자 노는 중"}
      </span>
      <p className={`mochi-bubble${swap ? " swap" : ""}`} aria-live="polite">
        {bubble}
      </p>
      <div ref={mochiRef} className="mochi" role="button" tabIndex={0} aria-label="Gollazyum 캐릭터 쓰다듬기">
        <div className="lb-breathe">
          <div ref={actRef} className="lb-act">
            <LowbotiBot />
          </div>
        </div>
      </div>
      <div ref={shadowRef} className="mochi-shadow" />
    </div>
  );
}
