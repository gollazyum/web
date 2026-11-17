// Pretendard 정적 분할 폰트(@font-face) 중 실제로 쓰는 굵기만 골라 app/pretendard.css 를 만든다.
// 사용: node scripts/build-pretendard-css.mjs  (굵기를 바꾸려면 WEIGHTS를 고치고 다시 돌린 뒤 결과 파일을 커밋한다)
// 가변 폰트는 분할 파일 하나에 모든 굵기가 들어 있어 무겁다 (첫 화면 14개 357KiB → 굵기 2개 정적 폰트 약 280KiB).
// 목록에 없는 굵기(700·800·900)는 브라우저가 가까운 굵기 600으로 그린다 (P2: 굵기는 500·600만 쓴다)
import { readFileSync, writeFileSync } from "node:fs";

const WEIGHTS = [400, 500, 600];
const css = readFileSync("node_modules/pretendard/dist/web/static/pretendard-dynamic-subset.css", "utf8");
const license = css.match(/^\/\*[\s\S]*?\*\//)[0];
const faces = [...css.matchAll(/@font-face\s*\{[\s\S]*?\}/g)]
  .map((m) => m[0])
  .filter((f) => WEIGHTS.includes(Number(f.match(/font-weight:\s*(\d+)/)[1])))
  // woff 대체 파일은 빼고 woff2만. 빌드할 때 Next가 node_modules 의 파일을 복사하고 이름에 해시를 붙인다
  .map((f) =>
    f.replace(/src:[^;]+;/, (s) => {
      const file = s.match(/url\(\.\/(woff2-dynamic-subset\/[^)]+)\)/)[1];
      return `src: url(../node_modules/pretendard/dist/web/static/${file}) format('woff2');`;
    }),
  );
writeFileSync("app/pretendard.css", `${license}\n/* scripts/build-pretendard-css.mjs 가 만든 파일 (굵기 ${WEIGHTS.join(", ")}). 직접 고치지 말 것 */\n${faces.join("\n")}\n`);
console.log(`app/pretendard.css: ${faces.length} @font-face, weights ${WEIGHTS.join(", ")}`);
