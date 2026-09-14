"""디자인 시스템 스펙 시트(docs/design/*.svg)를 만듭니다.

    python3 docs/design/build-sheets.py

값을 바꿨으면 다시 실행합니다. 시트에 적힌 색·크기·모서리는
src/app/globals.css의 토큰과 같은 값이라 한쪽만 고치면 어긋납니다.
"""

import pathlib
import re

OUT = pathlib.Path(__file__).resolve().parent
W, H = 1080, 1440
M = 64                      # 바깥 여백
LABEL_X = 64                # 절 이름 열
BODY_X = 236                # 내용 열
BODY_W = W - M - BODY_X

SANS = "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
MONO = "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace"

# 타이포 시트의 견본은 역할에 맞는 글꼴로 보여야 합니다. SVG에는 웹폰트를 심을 수
# 없으므로 대체 스택만 적어 두고, 보는 사람 기기에 글꼴이 있으면 제대로 나옵니다.
# 명조 스택에서는 앱과 달리 고딕 대체 글꼴을 뺍니다 — 시트에서는 획이 보여야 합니다.
SERIF_APP = "'Noto Serif KR', 'Nanum Myeongjo', serif"
SANS_APP = "'IBM Plex Sans KR', " + SANS
MONO_APP = "'IBM Plex Mono', " + MONO

INK, SUB, LINE, FAINT = "#1a1d22", "#6d6a63", "#e3dfd5", "#aaa79f"
# 종이 위에 올라앉는 면입니다. 흰색이 아니라 --surface라서 바탕과 한 단계 갈립니다.
SURFACE = "#fdfcfa"
BRAND, BRAND_SOFT = "#1d5091", "#e6edf7"
PRIMARY, WARN, DANGER = "#1a4784", "#8d5a15", "#ab3a31"


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def t(x, y, s, size=14, fill=INK, weight=400, family=None, spacing=None, anchor=None):
    a = [f'x="{x}"', f'y="{y}"', f'font-size="{size}"', f'fill="{fill}"']
    a.append(f'font-family="{family or SANS}"')
    if weight != 400:
        a.append(f'font-weight="{weight}"')
    if spacing:
        a.append(f'letter-spacing="{spacing}"')
    if anchor:
        a.append(f'text-anchor="{anchor}"')
    return f"<text {' '.join(a)}>{esc(s)}</text>"


def rule(y, x1=M, x2=W - M, color=LINE):
    return f'<line x1="{x1}" y1="{y}" x2="{x2}" y2="{y}" stroke="{color}" stroke-width="1"/>'


def head(title, page, total=4):
    return "\n".join([
        t(M, 52, "도장 디자인 시스템", 11.5, SUB, 500, MONO, "0.12em"),
        t(W - M, 52, f"{page} / {total}", 11.5, FAINT, 500, MONO, "0.12em", "end"),
        rule(72),
        t(M, 152, title, 52, INK, 700, spacing="-0.03em"),
        rule(190),
    ])


def label(y, name, note=None):
    out = [t(LABEL_X, y, name, 12, INK, 600, MONO, "0.08em")]
    if note:
        for i, line in enumerate(note):
            out.append(t(LABEL_X, y + 22 + i * 17, line, 11.5, FAINT))
    return "\n".join(out)


# ─── 도장 도형 ───────────────────────────────────────────────────
# 좌표를 베껴 두면 한쪽만 바뀌어도 모릅니다. 실제로 손목(rect)을 빠뜨려
# 시트 네 장이 손목 없는 도장을 그린 적이 있어, seal.tsx에서 읽어 옵니다.
SRC = pathlib.Path(__file__).resolve().parent.parent.parent / "src"


def thumb_shapes(extra='fill="#000"'):
    src = (SRC / "components" / "seal.tsx").read_text()
    block = re.search(r'<g id="dojang-thumb">(.*?)</g>', src, re.S)
    if not block:
        raise SystemExit("seal.tsx에서 dojang-thumb 그룹을 못 찾았습니다.")
    path = re.search(r'd="([^"]+)"', block.group(1))
    rect = re.search(r"<rect[^>]*?/>", block.group(1))
    if not path or not rect:
        raise SystemExit("seal.tsx의 엄지가 path 하나와 rect 하나가 아닙니다.")
    return (f'<path d="{path.group(1)}" {extra}/>\n    '
            + rect.group(0).replace("/>", f"{extra}/>"))


# 검수 대기 도장도 같은 이유로 seal.tsx에서 읽어 옵니다. 원의 반지름·선 굵기·점선
# 간격과 엄지 윤곽의 선 굵기만 가져오면 나머지는 승인 도장과 같은 판입니다.
def ghost_specs():
    src = (SRC / "components" / "seal.tsx").read_text()
    block = re.search(r'<symbol id="dojang-ghost".*?</symbol>', src, re.S)
    if not block:
        raise SystemExit("seal.tsx에서 dojang-ghost 심볼을 못 찾았습니다.")
    circle = re.search(r"<circle\b.*?/>", block.group(0), re.S)
    use = re.search(r"<use\b.*?/>", block.group(0), re.S)
    if not circle or not use:
        raise SystemExit("dojang-ghost가 circle 하나와 use 하나가 아닙니다.")
    r = re.search(r'\br="([\d.]+)"', circle.group(0))
    width = re.search(r'strokeWidth="([\d.]+)"', circle.group(0))
    dash = re.search(r'strokeDasharray="([^"]+)"', circle.group(0))
    thumb_width = re.search(r'strokeWidth="([\d.]+)"', use.group(0))
    if not r or not width or not dash or not thumb_width:
        raise SystemExit("dojang-ghost에서 반지름·선 굵기·점선 간격을 못 읽었습니다.")
    return r.group(1), width.group(1), dash.group(1), thumb_width.group(1)


THUMB = thumb_shapes()
THUMB_OUTLINE = thumb_shapes('fill="none"')
GHOST_R, GHOST_W, GHOST_DASH, GHOST_THUMB_W = ghost_specs()

SEAL_DEFS = f"""
  <filter id="rim" x="-14%" y="-14%" width="128%" height="128%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="5" result="w"/>
    <feDisplacementMap in="SourceGraphic" in2="w" scale="2.4" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="ink" x="-16%" y="-16%" width="132%" height="132%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.42" numOctaves="4" seed="17" result="g"/>
    <feColorMatrix in="g" type="matrix" result="s"
                   values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 2.8 -1.75"/>
    <feComposite in="SourceGraphic" in2="s" operator="out" result="worn"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="5" result="w"/>
    <feDisplacementMap in="worn" in2="w" scale="2.8" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <mask id="face">
    <rect width="120" height="120" fill="#000"/>
    <circle cx="60" cy="60" r="55" fill="#fff"/>
    <circle cx="60" cy="60" r="46.5" fill="none" stroke="#000" stroke-width="2.2"/>
    <g transform="translate(60 60) scale(1.1) translate(-60 -60)">{THUMB}</g>
  </mask>
  <symbol id="seal-sm" viewBox="0 0 120 120">
    <g filter="url(#rim)"><rect width="120" height="120" fill="currentColor" mask="url(#face)"/></g>
  </symbol>
  <symbol id="seal-lg" viewBox="0 0 120 120">
    <g filter="url(#ink)"><rect width="120" height="120" fill="currentColor" mask="url(#face)"/></g>
  </symbol>
  <symbol id="seal-ghost" viewBox="0 0 120 120">
    <circle cx="60" cy="60" r="{GHOST_R}" fill="none" stroke="currentColor"
            stroke-width="{GHOST_W}" stroke-dasharray="{GHOST_DASH}"/>
    <g fill="none" stroke="currentColor" stroke-width="{GHOST_THUMB_W}" stroke-linejoin="round">
    {THUMB_OUTLINE}</g>
  </symbol>"""


# ─── 하트 ───────────────────────────────────────────────────────
# 응원 하트도 cheer-button.tsx에서 읽어 옵니다.
def heart_shape():
    src = (SRC / "components" / "cheer-button.tsx").read_text()
    block = re.search(r"function HeartIcon\(.*?</svg>", src, re.S)
    if not block:
        raise SystemExit("cheer-button.tsx에서 HeartIcon을 못 찾았습니다.")
    path = re.search(r'd="([^"]+)"', block.group(0))
    width = re.search(r"strokeWidth=\{([\d.]+)\}", block.group(0))
    if not path or not width:
        raise SystemExit("HeartIcon에서 path와 선 굵기를 못 읽었습니다.")
    return path.group(1), width.group(1)


HEART_D, HEART_W = heart_shape()


def heart(x, y, size, filled, color=DANGER):
    """viewBox 24 짜리 하트를 size에 맞춰 놓습니다. 채우면 응원한 상태입니다."""
    s = size / 24
    return (f'<g transform="translate({x} {y}) scale({s:.4f})">'
            f'<path d="{HEART_D}" fill="{color if filled else "none"}" stroke="{color}" '
            f'stroke-width="{HEART_W}" stroke-linejoin="round"/></g>')


def seal(x, y, size, color=BRAND, tilt=-6, plate="sm"):
    c = x + size / 2
    return (f'<g transform="rotate({tilt} {c} {y + size / 2})" color="{color}">'
            f'<use href="#seal-{plate}" x="{x}" y="{y}" width="{size}" height="{size}"/></g>')


def sheet(title, page, body, defs=""):
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
  <defs>{defs}</defs>
  <rect width="{W}" height="{H}" fill="#f5f3ee"/>
{head(title, page)}
{body}
</svg>
"""


# ══ 대비비 ═══════════════════════════════════════════════════════
def lum(hexcode):
    v = []
    for i in (1, 3, 5):
        c = int(hexcode[i:i + 2], 16) / 255
        v.append(c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]


def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


# ══ 1 · 도장 ═════════════════════════════════════════════════════
def page_seal():
    p, y = [], 250

    p.append(label(y, "구조", ["글자 대신 엄지를", "새깁니다. 모두가 같은", "도장을 써서 누가", "찍었는지 밝힐 일이", "없기 때문입니다."]))
    big, bx, by = 260, BODY_X, y - 34
    p.append(seal(bx, by, big, plate="lg"))
    cx, cy = bx + big / 2, by + big / 2
    gx = bx + big + 70
    # 안내선이 허공을 가리키지 않도록 시작점을 원 위에서 계산합니다.
    for dy, name in ((-72, "테두리"), (-6, "안쪽 흰 띠"), (58, "엄지")):
        r = 55 / 120 * big
        edge = cx + (r * r - dy * dy) ** 0.5
        ly = cy + dy
        p.append(f'<line x1="{edge - 4:.0f}" y1="{ly}" x2="{gx - 10}" y2="{ly}" '
                 f'stroke="{FAINT}" stroke-width="1"/>')
        p.append(t(gx, ly + 4, name, 11.5, SUB, 500, MONO))
    p.append(t(gx, cy + 108, "viewBox 120", 11.5, FAINT, 500, MONO))

    y = 570
    p.append(rule(y - 30))
    p.append(label(y, "크기", ["실제로 쓰는 크기", "그대로입니다."]))
    x = BODY_X
    for size in (16, 24, 30, 38, 56, 80):
        p.append(seal(x, y - 12 + (80 - size), size))
        p.append(t(x + size / 2, y + 92, str(size), 10.5, FAINT, 400, MONO, anchor="middle"))
        x += size + 44

    y = 760
    p.append(rule(y - 34))
    p.append(label(y, "두 가지", ["40px가 경계입니다."]))
    for i, (name, plate, note) in enumerate((
        ("작은 크기용 · 40px 이하", "sm", "얼룩을 빼고 테두리 흔들림만 남깁니다."),
        ("큰 크기용 · 40px 초과", "lg", "성기고 진한 얼룩을 더합니다."),
    )):
        bx = BODY_X + i * 400
        p.append(seal(bx, y - 16, 88, plate=plate))
        p.append(t(bx + 108, y + 18, name, 14, INK, 600))
        p.append(t(bx + 108, y + 40, note, 12, SUB))
        p.append(t(bx + 108, y + 60, "얼룩은 40px 아래에서" if i == 0 else "잉크는 차 보이고 테두리는", 12, SUB))
        p.append(t(bx + 108, y + 78, "바램으로 보입니다." if i == 0 else "눌린 티가 납니다.", 12, SUB))

    y = 940
    p.append(rule(y - 34))
    p.append(label(y, "규칙"))
    rules = [
        ("도형은 한 벌", "src/components/seal.tsx가 원본입니다. 확장은 번들러가 없어 extension/seal.js에 같은 좌표를 한 벌 더 둡니다."),
        ("잉크색은 currentColor", "감싼 요소의 color가 정합니다. .seal { color: var(--brand) } 한 줄로 라이트·다크가 맞고, 채운 면 위에서는 흰 도장이 됩니다."),
        ("기울기는 --seal-tilt", "손목이 정한 각도는 찍는 중에 변하지 않습니다. 회전을 같이 움직이면 ‘찍혔다’가 아니라 ‘돌면서 등장했다’로 읽힙니다."),
        ("정의는 문서에 한 번", "SealDefs를 루트 레이아웃에 심고 나머지는 use로 참조합니다. 정의 SVG는 display:none이 아니라 width=0 — 숨기면 참조가 안 그려지는 브라우저가 있습니다."),
    ]
    for name, desc in rules:
        p.append(t(BODY_X, y, name, 13.5, INK, 600))
        for j, line in enumerate(wrap(desc, 62)):
            p.append(t(BODY_X, y + 22 + j * 18, line, 12, SUB))
        y += 22 + 18 * len(wrap(desc, 62)) + 18

    return sheet("도장", 1, "\n".join(p), SEAL_DEFS)


def wrap(text, width):
    words, lines, cur = text.split(" "), [], ""
    for w in words:
        if len(cur) + len(w) + 1 > width and cur:
            lines.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
    if cur:
        lines.append(cur)
    return lines


# ══ 2 · 색 ═══════════════════════════════════════════════════════
GROUPS = [
    ("바탕", ["바탕은 종이, 글자는", "잉크입니다. 중성색은", "아주 약하게 따뜻한", "쪽이고, 그 위에서", "파랑이 잉크로", "읽힙니다."], [
        ("--canvas", "#f5f3ee", "#15171a"),
        ("--surface", "#fdfcfa", "#1c1f24"),
        ("--ink", "#1a1d22", "#ebe9e3"),
        ("--sub", "#6d6a63", "#9a978f"),
        ("--line", "#e3dfd5", "#2f3238"),
        ("--soft", "#eeebe3", "#23262c"),
    ]),
    ("브랜드", ["brand는 바탕 위에", "얹는 색, primary는", "채우는 면입니다.", "대비 기준이 달라", "값도 다릅니다."], [
        ("--brand", "#1d5091", "#8fc0f2"),
        ("--brand-soft", "#e6edf7", "#1b2e47"),
        ("--primary", "#1a4784", "#9ac6f5"),
        ("--primary-hover", "#143866", "#b2d5f8"),
        ("--primary-ink", "#ffffff", "#0f2038"),
    ]),
    ("상태", ["승인은 색이 아니라", "도장의 형태가", "집니다. 그래서", "‘성공 초록’이", "따로 없습니다."], [
        ("--warn", "#8d5a15", "#e5bc78"),
        ("--danger", "#ab3a31", "#efa19a"),
    ]),
]


def page_colour():
    p, y = [], 250
    for name, note, items in GROUPS:
        p.append(label(y, name, note))
        x = BODY_X
        for token, light, dark in items:
            p.append(f'<rect x="{x}" y="{y - 18}" width="70" height="76" fill="{light}"/>')
            p.append(f'<rect x="{x + 70}" y="{y - 18}" width="70" height="76" fill="{dark}"/>')
            p.append(f'<rect x="{x}" y="{y - 18}" width="140" height="76" fill="none" stroke="{LINE}"/>')
            p.append(t(x, y + 76, token, 11.5, INK, 600, MONO))
            p.append(t(x, y + 94, light, 10.5, FAINT, 400, MONO))
            p.append(t(x, y + 109, dark, 10.5, FAINT, 400, MONO))
            x += 161
        y += 190
        p.append(rule(y - 46))

    p.append(label(y, "대비", ["WCAG AA 본문", "기준은 4.5:1", "입니다."]))
    pairs = [
        ("#1a1d22", "#f5f3ee", "본문 / 바탕"),
        ("#6d6a63", "#f5f3ee", "보조 / 바탕"),
        ("#1d5091", "#f5f3ee", "브랜드 / 바탕"),
        ("#ffffff", "#1a4784", "버튼 글자 / 버튼"),
        ("#ebe9e3", "#15171a", "본문 / 바탕 · 다크"),
        ("#8fc0f2", "#15171a", "브랜드 / 바탕 · 다크"),
    ]
    x = BODY_X
    for fg, bg, name in pairs:
        r = ratio(fg, bg)
        p.append(f'<rect x="{x}" y="{y - 18}" width="118" height="56" fill="{bg}" stroke="{LINE}"/>')
        p.append(t(x + 59, y + 16, f"{r:.1f}:1", 17, fg, 700, anchor="middle"))
        p.append(t(x, y + 56, name, 10.5, SUB))
        x += 132

    y += 150
    p.append(rule(y - 46))
    p.append(label(y, "규칙"))
    for name, desc in (
        ("색 하나가 두 일을 겸하지 않습니다",
         "예전에는 초록이 브랜드이면서 \u2018승인\u2019이었습니다. 도장판이 초록으로 차면 우리 색이라 그런 건지 다들 잘해서 그런 건지 구분되지 않았습니다."),
        ("brand와 primary는 다릅니다",
         "brand는 바탕 위에 얹는 색이라 바탕과의 대비를 봅니다. primary는 채우는 면이라 그 위에 올라갈 글자와의 대비를 봅니다."),
        ("테마는 토큰 한 벌로 끝냅니다",
         "light-dark()로 정의하므로 다크 모드용 재정의가 따로 없습니다. 사용자가 고른 테마는 color-scheme만 바꿉니다."),
    ):
        p.append(t(BODY_X, y, name, 13.5, INK, 600))
        for j, line in enumerate(wrap(desc, 60)):
            p.append(t(BODY_X, y + 22 + j * 18, line, 12, SUB))
        y += 22 + 18 * len(wrap(desc, 60)) + 20
    return sheet("\uc0c9", 2, "\n".join(p))


# ══ 3 · 타이포 ═══════════════════════════════════════════════════
def page_type():
    p, y = [], 250
    p.append(label(y, "글꼴", ["세 벌입니다.", "next/font가 빌드 때", "받아 같은 도메인에서", "내려주므로 방문자는", "Google에 요청하지", "않습니다."]))
    # 견본을 각자의 글꼴로 그립니다. 없는 기기에서는 대체 스택으로 떨어집니다.
    p.append(t(BODY_X, y + 4, "명조  Noto Serif KR 600·700", 14, INK, 500, SERIF_APP))
    p.append(t(BODY_X, y + 28, "고딕  IBM Plex Sans KR 400–700", 14, INK, 500, SANS_APP))
    p.append(t(BODY_X, y + 52, "고정폭  IBM Plex Mono 400·500", 14, INK, 500, MONO_APP))
    p.append(t(BODY_X, y + 86, "명조는 h1·h2와 현황판의 큰 숫자, 고딕은 본문, 고정폭은 날짜·시각·아이디입니다.", 12, SUB))
    p.append(t(BODY_X, y + 105, "한글 글꼴은 유니코드 범위별로 잘려 있어 화면에 쓰인 조각만 받습니다.", 12, SUB))
    p.append(t(BODY_X, y + 124, "SVG에는 웹폰트를 심을 수 없어, 견본은 보는 기기에 그 글꼴이 있을 때만 제대로 보입니다.", 12, FAINT))

    y = 430
    p.append(rule(y - 40))
    p.append(label(y, "단계", ["h3가 h2보다 컸던", "계층을 되돌렸습니다.", "요소로 크기를", "고르지 않습니다."]))
    steps = [
        ("h1", "34 / 700 / -0.03em · 명조", "이번 주 도장판", 34, 700, "-1.02px", SERIF_APP),
        ("h2", "22 / 600 / -0.024em · 명조", "알고리즘 스터디", 22, 600, "-0.53px", SERIF_APP),
        ("h3", "17 / 600 / -0.012em · 고딕", "최근 인증 기록", 17, 600, "-0.2px", SANS_APP),
        ("본문", "15 / 400 / 1.6 · 고딕", "오늘 푼 문제를 남기면 스터디원이 검수합니다.", 15, 400, "0", SANS_APP),
        ("보조", "13 / 400 · 고딕", "멤버 4명 · 이번 주 11번", 13, 400, "0", SANS_APP),
        ("메타", "12 / 500 / .1em · 고딕", "검수 대기", 12, 500, "1.2px", SANS_APP),
    ]
    for name, spec, sample, size, weight, sp, family in steps:
        p.append(t(BODY_X, y, name, 12, INK, 600, MONO))
        p.append(t(BODY_X, y + 17, spec, 10.5, FAINT, 400, MONO))
        p.append(t(BODY_X + 150, y + 4, sample, size, INK, weight, family, spacing=sp))
        y += max(size + 30, 58)

    y += 4
    p.append(rule(y - 30))
    p.append(label(y, "자간"))
    for i, line in enumerate([
        "한글은 라틴보다 글자 폭이 고르기 때문에, 큰 제목에서 자간을 붙이지 않으면",
        "성기게 벌어져 보입니다. 크기가 커질수록 더 좁힙니다.",
        "",
        "px가 아니라 em을 씁니다. h1의 -0.03em은 34px에서 -1.02px로 계산되며,",
        "크기를 바꿔도 비율이 유지됩니다.",
    ]):
        p.append(t(BODY_X, y + i * 22, line, 13, SUB))

    y += 140
    p.append(rule(y - 30))
    p.append(label(y, "숫자"))
    p.append(t(BODY_X, y + 4, "13번", 22, INK, 650, SERIF_APP))
    p.append(t(BODY_X + 110, y + 4, "9.7 — 9.13", 22, INK, 650, MONO_APP))
    p.append(t(BODY_X, y + 30, "명조 · 현황판", 10.5, FAINT, 400, MONO))
    p.append(t(BODY_X + 110, y + 30, "고정폭 · 날짜", 10.5, FAINT, 400, MONO))
    p.append(t(BODY_X, y + 58, "자리를 맞춰 세로로 읽히게 tabular-nums를 씁니다. 집계와 날짜가 해당합니다.", 12, SUB))
    return sheet("타이포", 3, "\n".join(p))


# ══ 4 · 구성 요소 ════════════════════════════════════════════════
def page_parts():
    p, y = [], 250
    p.append(label(y, "버튼", ["높이 40px,", "모서리 8px.", "터치 기기에서는", "44px로 커집니다."]))
    btns = [
        ("도장 찍기", PRIMARY, "#ffffff", None),
        ("취소", SURFACE, INK, LINE),
        ("닫기", None, SUB, None),
    ]
    x = BODY_X
    for text, bg, fg, border in btns:
        w = 128
        if bg:
            p.append(f'<rect x="{x}" y="{y - 16}" width="{w}" height="40" rx="8" fill="{bg}"'
                     + (f' stroke="{border}"' if border else "") + "/>")
        p.append(t(x + w / 2, y + 9, text, 14, fg, 550, anchor="middle"))
        x += w + 20
    p.append(t(BODY_X, y + 52, "btn-primary · btn · btn-ghost", 11.5, FAINT, 400, MONO))

    # 도장 버튼. 3종과 같은 절에 한 칸 더 둡니다 — 같은 btn-primary인데 혼자 큽니다.
    by, bw = y + 68, 168
    p.append(f'<rect x="{BODY_X}" y="{by}" width="{bw}" height="48" rx="10" fill="{PRIMARY}"/>')
    p.append(seal(BODY_X + 22, by + 12, 24, color="#ffffff"))
    p.append(t(BODY_X + 60, by + 30, "도장 찍기", 16, "#ffffff", 550))
    p.append(t(BODY_X + bw + 24, by + 24, "이 서비스에서 가장 큰 버튼입니다. 도장 찍기 창의 제출 버튼으로,", 12, SUB))
    p.append(t(BODY_X + bw + 24, by + 44, "높이 48px · 모서리 10px이고 채운 면 위라 도장이 흰색입니다.", 12, SUB))

    y = 452
    p.append(rule(y - 42))
    p.append(label(y, "입력", ["포커스 링은", "브랜드 파랑입니다.", "중성 배경 어디서든", "또렷합니다."]))
    p.append(f'<rect x="{BODY_X}" y="{y - 16}" width="300" height="42" rx="8" fill="{SURFACE}" stroke="{LINE}"/>')
    p.append(t(BODY_X + 14, y + 11, "양궁대회", 15, INK))
    fx = BODY_X + 340
    p.append(f'<rect x="{fx - 3}" y="{y - 19}" width="306" height="48" rx="10" fill="none" stroke="{BRAND}" stroke-width="2"/>')
    p.append(f'<rect x="{fx}" y="{y - 16}" width="300" height="42" rx="8" fill="{SURFACE}" stroke="{LINE}"/>')
    p.append(t(fx + 14, y + 11, "완전탐색, 재귀", 15, INK))
    p.append(t(BODY_X, y + 58, "기본", 11.5, FAINT, 400, MONO))
    p.append(t(fx, y + 58, "포커스", 11.5, FAINT, 400, MONO))

    y = 594
    p.append(rule(y - 42))
    p.append(label(y, "상태", ["색보다 형태가", "먼저입니다. 색을", "구분하지 못해도,", "흑백으로 찍어도", "나뉩니다."]))
    p.append(seal(BODY_X, y - 14, 38, tilt=-4))
    p.append(t(BODY_X, y + 52, "승인", 13, INK, 600))
    p.append(t(BODY_X, y + 72, "잉크로 채운 도장", 11.5, SUB))
    # 검수 대기는 같은 엄지를 점선 윤곽으로만 그린 도장입니다. 실루엣이 달라 색 없이도 갈립니다.
    wx = BODY_X + 170
    p.append(seal(wx, y - 14, 38, color=WARN, tilt=-4, plate="ghost"))
    p.append(t(wx, y + 52, "검수 대기", 13, INK, 600))
    p.append(t(wx, y + 72, "점선 윤곽 도장", 11.5, SUB))
    rx = BODY_X + 340
    p.append(f'<rect x="{rx}" y="{y - 14}" width="38" height="38" rx="8" fill="{SURFACE}" stroke="{LINE}"/>')
    p.append(t(rx + 19, y + 12, "×", 17, DANGER, 650, anchor="middle"))
    p.append(t(rx, y + 52, "반려", 13, INK, 600))
    p.append(t(rx, y + 72, "둥근 네모 테두리", 11.5, SUB))

    y = 748
    p.append(rule(y - 42))
    p.append(label(y, "응원", ["검수와 달리 권한을", "가리지 않습니다."]))
    p.append(heart(BODY_X, y - 14, 36, False))
    p.append(t(BODY_X, y + 44, "아직 안 누름", 11.5, SUB))
    hx = BODY_X + 150
    p.append(heart(hx, y - 14, 36, True))
    p.append(t(hx, y + 44, "누름", 11.5, SUB))
    p.append(t(BODY_X, y + 74, "검수 권한이 없는 멤버도 남길 수 있는 유일한 반응입니다. 색은 --danger입니다.", 12, SUB))

    y = 890
    p.append(rule(y - 44))
    p.append(label(y, "도장판", ["승인만 형태가 달라", "찍힌 칸이 곧 그 주의", "성과로 읽힙니다."]))
    cells = ["seal", "seal", "wait", "seal", "seal", "dot", "future"]
    days = ["월", "화", "수", "목", "금", "토", "일"]
    for i, (kind, day) in enumerate(zip(cells, days)):
        cx = BODY_X + i * 62
        p.append(t(cx + 19, y - 22, day, 11.5, SUB, anchor="middle"))
        if kind == "seal":
            p.append(seal(cx, y - 8, 38, tilt=(-7, -3, 2, 5)[i % 4]))
        elif kind == "wait":
            p.append(seal(cx, y - 8, 38, color=WARN, tilt=2, plate="ghost"))
        else:
            p.append(t(cx + 19, y + 18, "·" if kind == "dot" else "–", 17, FAINT, anchor="middle"))
    p.append(t(BODY_X, y + 62, "두 건 이상이면 칸 어깨에 건수를 답니다. 도장 안에는 숫자를 넣을 수 없습니다.", 12, SUB))

    y = 1016
    p.append(rule(y - 40))
    p.append(label(y, "선택 목록", ["기록 종류처럼 처음", "한 번 고르는 설정에", "씁니다."]))
    for i, (name, on) in enumerate((
        ("도장만 찍기", True),
        ("몇 시에 했는지", False),
        ("얼마나 했는지", False),
    )):
        ry = y + i * 30
        p.append(f'<circle cx="{BODY_X + 8}" cy="{ry - 5}" r="7.5" fill="{SURFACE}" '
                 f'stroke="{BRAND if on else LINE}" stroke-width="{1.6 if on else 1}"/>')
        if on:
            p.append(f'<circle cx="{BODY_X + 8}" cy="{ry - 5}" r="3.6" fill="{BRAND}"/>')
        p.append(t(BODY_X + 28, ry, name, 14, INK))
    p.append(t(BODY_X, y + 102, "globals.css의 기본 입력 규칙에서 라디오를 빼야 합니다. 빼지 않으면 너비 100%와", 12, SUB))
    p.append(t(BODY_X, y + 120, "테두리가 씌워져 막대처럼 늘어납니다. 실제로 한 번 그렇게 깨졌습니다.", 12, SUB))

    y = 1200
    p.append(rule(y - 40))
    p.append(label(y, "모서리", ["다섯 종이 섞여", "있던 것을 둘로", "모았습니다."]))
    for i, (name, r, use) in enumerate((
        ("--r-control", 8, "홀로 서는 조작 요소 — 버튼, 입력, 셀렉트, 도장판 칸"),
        ("--r-surface", 12, "다른 것을 담는 면 — 카드, 목록 묶음, 다이얼로그"),
    )):
        by = y + i * 88
        p.append(f'<rect x="{BODY_X}" y="{by - 16}" width="72" height="56" rx="{r}" fill="{BRAND_SOFT}" stroke="{BRAND}"/>')
        p.append(t(BODY_X + 92, by + 4, name, 13, INK, 600, MONO))
        p.append(t(BODY_X + 92, by + 26, f"{r}px · {use}", 12, SUB))
    p.append(t(BODY_X, y + 190, "테두리가 있는 면의 안쪽 모서리는 calc(var(--r-surface) - 1px)로 테두리만큼 줄입니다.", 12, SUB))
    return sheet("구성 요소", 4, "\n".join(p), SEAL_DEFS)


OUT.mkdir(parents=True, exist_ok=True)
for name, svg in (
    ("01-seal.svg", page_seal()),
    ("02-colour.svg", page_colour()),
    ("03-type.svg", page_type()),
    ("04-parts.svg", page_parts()),
):
    (OUT / name).write_text(svg, encoding="utf-8")
    print(f"· docs/design/{name}  {len(svg):,}바이트")
