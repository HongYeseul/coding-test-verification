"""디자인 시스템 스펙 시트(docs/design/*.svg)를 만듭니다.

    python3 docs/design/build-sheets.py

값을 바꿨으면 다시 실행합니다. 시트에 적힌 색·크기·모서리는
src/app/globals.css의 토큰과 같은 값이라 한쪽만 고치면 어긋납니다.
"""

import pathlib

OUT = pathlib.Path(__file__).resolve().parent
W, H = 1080, 1440
M = 64                      # 바깥 여백
LABEL_X = 64                # 절 이름 열
BODY_X = 236                # 내용 열
BODY_W = W - M - BODY_X

SANS = "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
MONO = "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace"

INK, SUB, LINE, FAINT = "#1b2027", "#69737e", "#e3e7ec", "#a8b0b8"
BRAND, BRAND_SOFT = "#1d5091", "#e9f0fa"
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


# ─── 도장 도형. seal.tsx와 같은 좌표입니다 ────────────────────────
THUMB = ("M 51 86 L 76 86 Q 84 86 85 78 L 87.5 63 Q 88.5 56 81 56 L 68 56 "
         "Q 64.5 56 65.5 52.5 L 68.5 41 Q 70.5 33 63 33 Q 59 33 57.5 37.5 "
         "L 52 53 Q 51 56 51 59 Z")

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
    <path d="{THUMB}" fill="#000" transform="translate(60 60) scale(1.1) translate(-60 -60)"/>
  </mask>
  <symbol id="seal-sm" viewBox="0 0 120 120">
    <g filter="url(#rim)"><rect width="120" height="120" fill="currentColor" mask="url(#face)"/></g>
  </symbol>
  <symbol id="seal-lg" viewBox="0 0 120 120">
    <g filter="url(#ink)"><rect width="120" height="120" fill="currentColor" mask="url(#face)"/></g>
  </symbol>"""


def seal(x, y, size, color=BRAND, tilt=-6, plate="sm"):
    c = x + size / 2
    return (f'<g transform="rotate({tilt} {c} {y + size / 2})" color="{color}">'
            f'<use href="#seal-{plate}" x="{x}" y="{y}" width="{size}" height="{size}"/></g>')


def sheet(title, page, body, defs=""):
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
  <defs>{defs}</defs>
  <rect width="{W}" height="{H}" fill="#ffffff"/>
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
    ("바탕", ["중성색도 파랑 쪽으로", "치우쳐 있습니다.", "브랜드가 파랑인데", "회색이 초록기를 띠면", "때가 낀 것처럼", "보입니다."], [
        ("--canvas", "#ffffff", "#14181d"),
        ("--ink", "#1b2027", "#e9edf2"),
        ("--sub", "#69737e", "#98a3af"),
        ("--line", "#e3e7ec", "#2f353d"),
        ("--soft", "#f4f6fa", "#1c2128"),
    ]),
    ("브랜드", ["brand는 바탕 위에", "얹는 색, primary는", "채우는 면입니다.", "대비 기준이 달라", "값도 다릅니다."], [
        ("--brand", "#1d5091", "#8fc0f2"),
        ("--brand-soft", "#e9f0fa", "#1b2e47"),
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
        ("#1b2027", "#ffffff", "본문 / 바탕"),
        ("#69737e", "#ffffff", "보조 / 바탕"),
        ("#1d5091", "#ffffff", "브랜드 / 바탕"),
        ("#ffffff", "#1a4784", "버튼 글자 / 버튼"),
        ("#e9edf2", "#14181d", "본문 / 바탕 · 다크"),
        ("#8fc0f2", "#14181d", "브랜드 / 바탕 · 다크"),
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
    p.append(label(y, "글꼴", ["기기에 이미 있는", "글꼴만 씁니다.", "웹폰트를 받지", "않으므로 첫 화면이", "늦지 않습니다."]))
    p.append(t(BODY_X, y + 4, "-apple-system, BlinkMacSystemFont,", 14, INK, 500, MONO))
    p.append(t(BODY_X, y + 26, "\"Apple SD Gothic Neo\", \"Noto Sans KR\",", 14, INK, 500, MONO))
    p.append(t(BODY_X, y + 48, "sans-serif", 14, INK, 500, MONO))
    p.append(t(BODY_X, y + 86, "macOS·iOS는 SF와 Apple SD 산돌고딕 네오, Android와 Windows는", 12, SUB))
    p.append(t(BODY_X, y + 105, "Noto Sans KR로 떨어집니다.", 12, SUB))

    y = 430
    p.append(rule(y - 40))
    p.append(label(y, "단계", ["h3가 h2보다 컸던", "계층을 되돌렸습니다.", "요소로 크기를", "고르지 않습니다."]))
    steps = [
        ("h1", "30 / 700 / -0.033em", "이번 주 도장판", 30, 700, "-0.99px"),
        ("h2", "22 / 600 / -0.024em", "알고리즘 스터디", 22, 600, "-0.53px"),
        ("h3", "17 / 600 / -0.012em", "최근 인증 기록", 17, 600, "-0.2px"),
        ("본문", "15 / 400 / 1.6", "오늘 푼 문제를 남기면 스터디원이 검수합니다.", 15, 400, "0"),
        ("보조", "13 / 400", "멤버 4명 · 이번 주 11번", 13, 400, "0"),
        ("메타", "12 / 500 / .1em", "검수 대기", 12, 500, "1.2px"),
    ]
    for name, spec, sample, size, weight, sp in steps:
        p.append(t(BODY_X, y, name, 12, INK, 600, MONO))
        p.append(t(BODY_X, y + 17, spec, 10.5, FAINT, 400, MONO))
        p.append(t(BODY_X + 150, y + 4, sample, size, INK, weight, spacing=sp))
        y += max(size + 30, 58)

    y += 4
    p.append(rule(y - 30))
    p.append(label(y, "자간"))
    for i, line in enumerate([
        "한글은 라틴보다 글자 폭이 고르기 때문에, 큰 제목에서 자간을 붙이지 않으면",
        "성기게 벌어져 보입니다. 크기가 커질수록 더 좁힙니다.",
        "",
        "px가 아니라 em을 씁니다. h1의 -0.033em은 30px에서 -0.99px로 계산돼",
        "예전에 박아두었던 -1px과 사실상 같지만, 크기를 바꿔도 비율이 유지됩니다.",
    ]):
        p.append(t(BODY_X, y + i * 22, line, 13, SUB))

    y += 140
    p.append(rule(y - 30))
    p.append(label(y, "숫자"))
    p.append(t(BODY_X, y + 4, "13번", 22, INK, 650))
    p.append(t(BODY_X + 90, y + 4, "9.7 — 9.13", 22, INK, 650))
    p.append(t(BODY_X, y + 34, "자리를 맞춰 세로로 읽히게 tabular-nums를 씁니다. 집계와 날짜가 해당합니다.", 12, SUB))
    return sheet("타이포", 3, "\n".join(p))


# ══ 4 · 구성 요소 ════════════════════════════════════════════════
def page_parts():
    p, y = [], 250
    p.append(label(y, "버튼", ["높이 40px,", "모서리 8px.", "터치 기기에서는", "44px로 커집니다."]))
    btns = [
        ("풀이 인증하기", PRIMARY, "#ffffff", None),
        ("취소", "#ffffff", INK, LINE),
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

    y = 400
    p.append(rule(y - 44))
    p.append(label(y, "입력", ["포커스 링은", "브랜드 파랑입니다.", "중성 배경 어디서든", "또렷합니다."]))
    p.append(f'<rect x="{BODY_X}" y="{y - 16}" width="300" height="42" rx="8" fill="#ffffff" stroke="{LINE}"/>')
    p.append(t(BODY_X + 14, y + 11, "양궁대회", 15, INK))
    fx = BODY_X + 340
    p.append(f'<rect x="{fx - 3}" y="{y - 19}" width="306" height="48" rx="10" fill="none" stroke="{BRAND}" stroke-width="2"/>')
    p.append(f'<rect x="{fx}" y="{y - 16}" width="300" height="42" rx="8" fill="#ffffff" stroke="{LINE}"/>')
    p.append(t(fx + 14, y + 11, "완전탐색, 재귀", 15, INK))
    p.append(t(BODY_X, y + 58, "기본", 11.5, FAINT, 400, MONO))
    p.append(t(fx, y + 58, "포커스", 11.5, FAINT, 400, MONO))

    y = 560
    p.append(rule(y - 46))
    p.append(label(y, "상태", ["색보다 형태가", "먼저입니다. 색을", "구분하지 못해도,", "흑백으로 찍어도", "나뉩니다."]))
    p.append(seal(BODY_X, y - 14, 38, tilt=-4))
    p.append(t(BODY_X, y + 52, "승인", 13, INK, 600))
    p.append(t(BODY_X, y + 72, "동그란 도장", 11.5, SUB))
    for i, (mark, name, colour, note) in enumerate((
        ("◷", "검수 대기", WARN, "둥근 네모 테두리"),
        ("×", "반려", DANGER, "둥근 네모 테두리"),
    )):
        bx = BODY_X + 160 + i * 160
        p.append(f'<rect x="{bx}" y="{y - 14}" width="38" height="38" rx="8" fill="#ffffff" stroke="{LINE}"/>')
        p.append(t(bx + 19, y + 12, mark, 17, colour, 650, anchor="middle"))
        p.append(t(bx, y + 52, name, 13, INK, 600))
        p.append(t(bx, y + 72, note, 11.5, SUB))

    y = 740
    p.append(rule(y - 46))
    p.append(label(y, "도장판", ["승인만 형태가 달라", "찍힌 칸이 곧 그 주의", "성과로 읽힙니다."]))
    cells = ["seal", "seal", "wait", "seal", "seal", "dot", "future"]
    days = ["월", "화", "수", "목", "금", "토", "일"]
    for i, (kind, day) in enumerate(zip(cells, days)):
        cx = BODY_X + i * 62
        p.append(t(cx + 19, y - 22, day, 11.5, SUB, anchor="middle"))
        if kind == "seal":
            p.append(seal(cx, y - 8, 38, tilt=(-7, -3, 2, 5)[i % 4]))
        elif kind == "wait":
            p.append(f'<rect x="{cx}" y="{y - 8}" width="38" height="38" rx="8" fill="#ffffff" stroke="{LINE}"/>')
            p.append(t(cx + 19, y + 18, "◷", 17, WARN, 650, anchor="middle"))
        else:
            p.append(t(cx + 19, y + 18, "·" if kind == "dot" else "–", 17, FAINT, anchor="middle"))
    p.append(t(BODY_X, y + 68, "두 건 이상이면 칸 어깨에 건수를 답니다. 도장 안에는 숫자를 넣을 수 없습니다.", 12, SUB))

    y = 920
    p.append(rule(y - 46))
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
