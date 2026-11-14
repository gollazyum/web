// 탐색 탭 아이콘 (선 아이콘, 글자색을 따른다)
type P = { size?: number };
const base = (size = 22) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true });

export const IconBed = ({ size }: P) => (
  <svg {...base(size)}><path d="M3 6v13M3 10h15a3 3 0 0 1 3 3v6M3 16h18" /></svg>
);
export const IconPlane = ({ size }: P) => (
  <svg {...base(size)}><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" /></svg>
);
export const IconSpark = ({ size }: P) => (
  <svg {...base(size)}><path d="M11 3c.6 3.7 2.3 5.4 6 6-3.7.6-5.4 2.3-6 6-.6-3.7-2.3-5.4-6-6 3.7-.6 5.4-2.3 6-6zM18.5 15v5M16 17.5h5" /></svg>
);
export const IconWifi = ({ size }: P) => (
  <svg {...base(size)}><path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0" /><circle cx="12" cy="19.5" r="1" fill="currentColor" stroke="none" /></svg>
);
export const IconCompass = ({ size }: P) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></svg>
);
export const IconPin = ({ size }: P) => (
  <svg {...base(size)}><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
);
export const IconBag = ({ size }: P) => (
  <svg {...base(size)}><rect x="4" y="7" width="16" height="13" rx="3" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M9 11v5M15 11v5" /></svg>
);
export const IconUp = ({ size }: P) => (
  <svg {...base(size)}><path d="M12 19V5M6 11l6-6 6 6" /></svg>
);
export const IconClose = ({ size }: P) => (
  <svg {...base(size)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconBack = ({ size }: P) => (
  <svg {...base(size)}><path d="M15 5l-7 7 7 7" /></svg>
);
export const IconPlus = ({ size }: P) => (
  <svg {...base(size)}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconOut = ({ size = 16 }: P) => (
  <svg {...base(size)}><path d="M7 17 17 7M9 7h8v8" /></svg>
);
export const IconHeart = ({ size, on }: P & { on?: boolean }) => (
  <svg {...base(size)} fill={on ? "currentColor" : "none"}><path d="M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7.3 4.5 4.5 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" /></svg>
);
export const IconCheck = ({ size = 14 }: P) => (
  <svg {...base(size)} strokeWidth={2.4}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);
export const IconList = ({ size }: P) => (
  <svg {...base(size)}><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></svg>
);
export const IconMap = ({ size }: P) => (
  <svg {...base(size)}><path d="M9 4 3 6.5v13.5L9 17.5l6 2.5 6-2.5V4l-6 2.5zM9 4v13.5M15 6.5V20" /></svg>
);
