# 첫 화면용 'UI 글꼴': 화면 문구(소스에 적힌 한글)와 영문·숫자·기호만 담은 Pretendard 작은 파일을 굵기마다 하나씩 만든다.
# 화면 문구는 이 파일 하나로 그리고, 숙소 이름처럼 그때그때 오는 글자만 기존 분할 폰트에서 받는다 (app/pretendard.css 의 unicode-range).
# 사용: pip install fonttools brotli && python3 scripts/build-ui-font.py && node scripts/build-pretendard-css.mjs
# 화면 문구를 바꾼 뒤 다시 돌리지 않아도 깨지지 않는다 (빠진 글자는 분할 폰트에서 받는다). 가끔 다시 돌려 결과를 커밋한다
import glob, hashlib, json, os, re
from fontTools import subset

WEIGHTS = {400: "Regular", 500: "Medium", 600: "SemiBold", 700: "Bold", 800: "ExtraBold"}
SRC = "node_modules/pretendard/dist/web/static/woff2/Pretendard-{}.woff2"
OUT = "public/fonts/pretendard-ui-{}.{}.woff2"  # 굵기, 내용 해시 (오래 캐시해도 바뀌면 이름이 달라진다)

chars = set(chr(c) for c in range(0x20, 0x7F))
chars |= set("·–—→←↗‘’“”…₩×✕ⓘ•※°")
# 여행 화면에서 쓰는 소스만 (예전 쇼핑 화면 등은 빼서 파일을 작게)
files = (
    glob.glob("components/trip/**/*.ts*", recursive=True)
    + ["components/AirportInput.tsx", "components/DateRangePicker.tsx", "components/PlaceInput.tsx", "app/layout.tsx", "app/not-found.tsx"]
    + glob.glob("app/(trip)/**/*.ts*", recursive=True)
    + [f for f in glob.glob("lib/*.ts") if not re.search(r"shop|coupang|product|lowboti|claudeChat|brand-mode|agoda|affiliate", f)]
)
for f in sorted(files):
    s = open(f, encoding="utf8").read()
    s = re.sub(r"//[^\n]*", "", s)
    s = re.sub(r"/\*.*?\*/", "", s, flags=re.S)
    chars |= {c for c in s if 0xAC00 <= ord(c) <= 0xD7A3 or 0x3131 <= ord(c) <= 0x318E}

cps = sorted(ord(c) for c in chars)
os.makedirs("public/fonts", exist_ok=True)
for old in glob.glob("public/fonts/pretendard-ui-*.woff2"):
    os.remove(old)
files_out = {}
for w, name in WEIGHTS.items():
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    font = subset.load_font(SRC.format(name), opts)
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=cps)
    sub.subset(font)
    have = set(font.getBestCmap().keys())
    tmp = f"public/fonts/.tmp-{w}.woff2"
    subset.save_font(font, tmp, opts)
    h = hashlib.sha256(open(tmp, "rb").read()).hexdigest()[:8]
    os.replace(tmp, OUT.format(w, h))
    files_out[w] = f"/fonts/pretendard-ui-{w}.{h}.woff2"

# 실제로 글꼴에 들어간 글자만 unicode-range 로 쓴다 (없는 글자는 분할 폰트로)
def ranges(xs):
    out, start, prev = [], None, None
    for x in xs:
        if start is None:
            start = prev = x
        elif x == prev + 1:
            prev = x
        else:
            out.append((start, prev)); start = prev = x
    if start is not None:
        out.append((start, prev))
    return ", ".join(f"U+{a:X}" if a == b else f"U+{a:X}-{b:X}" for a, b in out)

json.dump({"weights": list(WEIGHTS), "files": files_out, "range": ranges(sorted(c for c in cps if c in have)), "count": len(have)}, open("scripts/pretendard-ui.json", "w"), ensure_ascii=False)
print(len(cps), "chars")
