"use client";

import { useEffect, useRef, useState } from "react";

// 브랜드 키트의 "살아 움직이는 모찌": 혼자 두리번거리고, 마우스를 따라보고, 세 번 누르면 점프하며 한 바퀴 돈다
const BODY = "M12 70 C9 44 27 17 51 17 C76 17 92 41 90 67 C89 85 77 91 50 91 C24 91 13 86 12 70Z";
const BLUE = "#1D4ED8";

const mouths = {
  normal: "M37 66 Q48 76 59 66",
  happy: "M35 65 Q48 80 61 65",
  curious: "M42 69 Q48 66 54 69",
  surprised: "M45 69 A3 3 0 1 0 51 69 A3 3 0 1 0 45 69",
};

const talks = [
  "🍡 안녕하세요! 여행에 관한 건 뭐든 물어보세요.",
  "👀 두리번두리번... 숨은 특가가 어디 있나?",
  "🔍 돋보기 눈으로 가격을 꼼꼼히 살펴봐요!",
  "✈️ 다음 여행은 어디로 떠나세요?",
  "💡 아래 예시 질문을 눌러 봐도 좋아요!",
  "🙌 저를 세 번 콕콕콕 눌러 보세요!",
];

type Props = { thinking?: boolean };

export function LiveMochi({ thinking = false }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const mochiRef = useRef<HTMLDivElement>(null);
  const rigRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const eyesRef = useRef<SVGGElement>(null);
  const mouthRef = useRef<SVGGElement>(null);
  const pctRef = useRef<SVGGElement>(null);
  const smileRef = useRef<SVGPathElement>(null);
  const [bubble, setBubble] = useState(talks[0]);
  const [swap, setSwap] = useState(false);
  const [tracking, setTracking] = useState(false);
  const api = useRef<{ say: (t: string) => void; mouth: (m: keyof typeof mouths) => void; look: (...a: number[]) => void } | null>(null);
  const thinkingRef = useRef(thinking);

  useEffect(() => {
    const stage = stageRef.current!, mochi = mochiRef.current!, rig = rigRef.current!, shadow = shadowRef.current!;
    const eyes = eyesRef.current!, mouth = mouthRef.current!, pct = pctRef.current!, smile = smileRef.current!;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
      return t;
    };

    let current = talks[0];
    let lastTalk = "";
    let isTracking = false;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;

    function say(text: string) {
      if (current === text) return;
      current = text;
      setSwap(true);
      later(() => {
        setBubble(text);
        setSwap(false);
      }, 180);
    }
    const clearAct = () => rig.classList.remove("act-spin", "act-jiggle", "act-wiggle");
    const setMouth = (m: keyof typeof mouths) => smile.setAttribute("d", mouths[m]);
    function look(x: number, y: number, tilt = 0, pctRot = 0) {
      eyes.style.transform = `translate(${x}px, ${y}px)`;
      mouth.style.transform = `translate(${x * 0.55}px, ${y * 0.55}px)`;
      rig.style.transform = `rotate(${tilt}deg)`;
      pct.style.transform = `rotate(${pctRot}deg)`;
    }
    function play(el: HTMLElement, cls: string) {
      if (reduceMotion) return;
      el.classList.remove(cls);
      if (el === rig) clearAct(); // 꿈틀 중에 점프가 와도 점프가 이기게
      void el.offsetWidth;
      el.classList.add(cls);
    }
    api.current = { say, mouth: setMouth, look: (...a) => look(a[0], a[1], a[2], a[3]) };

    rig.addEventListener("animationend", clearAct);

    function spin() {
      look(0, -3, 0, 360);
      setMouth("happy");
      say("🤸 얏호~! 점프해서 한 바퀴 빙그르르!");
      play(rig, "act-spin");
      play(shadow, "jump");
      later(() => {
        pct.classList.add("no-anim"); // %가 거꾸로 되감기지 않게
        pct.style.transform = "rotate(0deg)";
        void pct.getBoundingClientRect();
        pct.classList.remove("no-anim");
        shadow.classList.remove("jump");
      }, 900);
    }

    // 혼자 노는 중
    function lifeTick() {
      if (isTracking || document.hidden || thinkingRef.current) return;
      const r = Math.random();
      let t = talks[Math.floor(Math.random() * talks.length)];
      if (t === lastTalk) t = talks[(talks.indexOf(t) + 1) % talks.length];
      lastTalk = t;
      if (r < 0.06) return spin();
      say(t);
      if (r < 0.3) {
        look(-6.5, -2, -4, -15);
        setMouth("normal");
      } else if (r < 0.56) {
        look(6.5, -1, 4, 18);
        setMouth("normal");
      } else if (r < 0.74) {
        look(2, -5.5, 2, -10);
        setMouth("curious");
      } else if (r < 0.9) {
        look(-4, 3, -6, 30);
        setMouth("happy");
        play(rig, "act-wiggle");
      } else {
        look(0, 0, 0, 0);
        setMouth("happy");
      }
    }
    const life = setInterval(lifeTick, 4200);

    // 마우스 따라보기 (터치는 콕 찌르기만)
    function track(on: boolean) {
      isTracking = on;
      setTracking(on);
    }
    function onMove(e: PointerEvent) {
      if (e.pointerType !== "mouse" || thinkingRef.current) return;
      if (!isTracking) {
        track(true);
        say("👀 어? 오셨군요! 무엇이 궁금하세요?");
        setMouth("happy");
      }
      const r = mochi.getBoundingClientRect();
      const dx = Math.max(-7.5, Math.min(7.5, (e.clientX - (r.left + r.width / 2)) / 16));
      const dy = Math.max(-5.5, Math.min(5.5, (e.clientY - (r.top + r.height / 2)) / 16));
      look(dx, dy, dx * 0.6, dx * 2);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        track(false);
        lifeTick();
      }, 2200);
    }
    function onLeave() {
      clearTimeout(idleTimer);
      track(false);
      if (!thinkingRef.current) look(0, 0, 0, 0);
    }
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerleave", onLeave);

    // 콕 찌르기, 1.5초 안에 3번이면 점프
    let pokes = 0;
    let pokeTimer: ReturnType<typeof setTimeout> | undefined;
    function poke() {
      pokes++;
      clearTimeout(pokeTimer);
      pokeTimer = setTimeout(() => (pokes = 0), 1500);
      if (pokes >= 3) {
        pokes = 0;
        return spin();
      }
      play(rig, "act-jiggle");
      setMouth("surprised");
      say(pokes === 1 ? "😆 헤헤, 모찌 볼이 간지러워요!" : "😳 한 번만 더 누르면...!");
      later(() => setMouth("happy"), 420);
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
      clearInterval(life);
      clearTimeout(idleTimer);
      clearTimeout(pokeTimer);
      timers.forEach(clearTimeout);
      rig.removeEventListener("animationend", clearAct);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", onLeave);
      mochi.removeEventListener("click", poke);
      mochi.removeEventListener("keydown", onKey);
      api.current = null;
    };
  }, []);

  // 질문을 보내면 생각하는 표정, 답이 오면 웃는 표정
  useEffect(() => {
    const was = thinkingRef.current;
    thinkingRef.current = thinking;
    const a = api.current;
    if (!a) return;
    if (thinking) {
      a.look(3, -5.5, 3, -20);
      a.mouth("curious");
      a.say("🤔 음... 잠깐만요, 생각 중이에요!");
    } else if (was) {
      a.look(0, 0, 0, 0);
      a.mouth("happy");
      a.say("😊 답을 드렸어요! 더 궁금한 건 없으세요?");
    }
  }, [thinking]);

  return (
    <div ref={stageRef} className={`mochi-stage${tracking ? " fast" : ""}`}>
      <span className={`mochi-badge${tracking ? " tracking" : ""}${thinking ? " thinking" : ""}`}>
        <i /> {thinking ? "생각하는 중" : tracking ? "보고 있어요!" : "혼자 노는 중"}
      </span>
      <p className={`mochi-bubble${swap ? " swap" : ""}`} aria-live="polite">
        {bubble}
      </p>
      <div ref={mochiRef} className="mochi" role="button" tabIndex={0} aria-label="로보티 쓰다듬기">
        <div ref={rigRef} className="mochi-rig">
          <svg width="150" height="126" viewBox="-12 -6 124 104" aria-hidden="true">
            <path d={BODY} fill="#fff" stroke="#D6E2F5" strokeWidth="2" />
            <g transform="translate(-1 0)">
              <g ref={eyesRef} className="mochi-eyes">
                <circle className="mochi-eye" cx="42" cy="51" r="6.2" fill={BLUE} />
                <path d="M70.5 56.5 L76.5 62.5" stroke={BLUE} strokeWidth="5.6" strokeLinecap="round" />
                <circle cx="63" cy="49" r="10.5" fill={BLUE} />
                <g ref={pctRef} className="mochi-pct">
                  <path d="M66.4 44.6 L59.6 53.4" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
                  <circle cx="60.1" cy="46" r="1.85" fill="#fff" />
                  <circle cx="65.9" cy="52" r="1.85" fill="#fff" />
                </g>
              </g>
              <g ref={mouthRef} className="mochi-mouth">
                <path ref={smileRef} d={mouths.normal} stroke="#10B981" strokeWidth="6" fill="none" strokeLinecap="round" />
              </g>
            </g>
          </svg>
        </div>
      </div>
      <div ref={shadowRef} className="mochi-shadow" />
    </div>
  );
}
