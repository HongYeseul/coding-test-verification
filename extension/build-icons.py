"""웹앱 파비콘(src/app/icon.svg)에서 확장 아이콘 PNG 세 벌을 굽습니다.

    python3 extension/build-icons.py

도장 도형을 고쳤을 때 다시 실행하면 됩니다.

macOS 전용입니다. 외부 패키지를 쓰지 않으려고 내장 Quick Look(qlmanage)으로
SVG를 래스터화하는데, Quick Look은 결과를 흰 배경에 눌러 내놓아 바깥 투명도가
사라집니다. 그대로 쓰면 크롬 툴바에 흰 네모가 생깁니다.

도장 바깥 경계는 정원이라 계산으로 알 수 있으므로, 8배로 렌더한 뒤
원 안팎을 판정하고 8×8로 줄이면서 가장자리 알파를 되살립니다.
반지름은 SVG에서 읽습니다 — 도형이 바뀌어도 알파가 어긋나지 않게 하려는 것입니다.
"""

import pathlib
import re
import struct
import subprocess
import sys
import tempfile
import zlib

SIZES = (16, 48, 128)
SUPER = 8  # 가장자리 알파 단계 수를 정합니다. 8이면 65단계입니다.

REPO = pathlib.Path(__file__).resolve().parent.parent
SVG = REPO / "src" / "app" / "icon.svg"
ICONS = REPO / "extension" / "icons"


def seal_radius_ratio(svg_text):
    """도장 반지름이 viewBox에서 차지하는 비율입니다. 알파를 자를 경계가 됩니다."""
    view_box = re.search(r'viewBox="0 0 (\d+(?:\.\d+)?) ', svg_text)
    # 도장 뒤에 까는 흰 원반이 곧 도장의 바깥 경계입니다.
    backing = re.search(r'<circle[^>]*\br="(\d+(?:\.\d+)?)"[^>]*fill="#ffffff"', svg_text)
    if not view_box or not backing:
        raise SystemExit(
            f"{SVG}에서 viewBox나 흰 원반을 못 찾았습니다. "
            "도형이 바뀌었다면 이 스크립트의 파싱도 같이 고쳐야 합니다."
        )
    return float(backing.group(1)) / float(view_box.group(1))


def read_png(path):
    data = path.read_bytes()
    width, height = struct.unpack(">II", data[16:24])
    if data[25] not in (2, 6):
        raise SystemExit(f"{path}: RGB/RGBA가 아닙니다 (color type {data[25]})")
    channels = 4 if data[25] == 6 else 3

    raw, i = b"", 8
    while i < len(data):
        length = struct.unpack(">I", data[i : i + 4])[0]
        if data[i + 4 : i + 8] == b"IDAT":
            raw += data[i + 8 : i + 8 + length]
        i += 12 + length
    px = zlib.decompress(raw)

    stride = width * channels
    rows, prev, pos = [], bytearray(stride), 0
    for _ in range(height):
        filter_type = px[pos]
        pos += 1
        line = bytearray(px[pos : pos + stride])
        pos += stride
        for x in range(stride):
            a = line[x - channels] if x >= channels else 0
            b = prev[x]
            c = prev[x - channels] if x >= channels else 0
            if filter_type == 1:
                line[x] = (line[x] + a) & 255
            elif filter_type == 2:
                line[x] = (line[x] + b) & 255
            elif filter_type == 3:
                line[x] = (line[x] + (a + b) // 2) & 255
            elif filter_type == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                nearest = a if pa <= pb and pa <= pc else b if pb <= pc else c
                line[x] = (line[x] + nearest) & 255
        rows.append(line)
        prev = line
    return width, channels, rows


def write_png(path, size, pixels):
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # 필터 없음
        raw += pixels[y * size * 4 : (y + 1) * size * 4]

    def chunk(tag, payload):
        crc = zlib.crc32(tag + payload) & 0xFFFFFFFF
        return struct.pack(">I", len(payload)) + tag + payload + struct.pack(">I", crc)

    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )


def bake(size, ratio, work):
    big = size * SUPER
    stage = work / str(size)
    stage.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["qlmanage", "-t", "-s", str(big), "-o", str(stage), str(SVG)],
        check=True,
        capture_output=True,
    )
    rendered = next(stage.glob("*.png"), None)
    if rendered is None:
        raise SystemExit(f"{size}px: Quick Look이 썸네일을 못 만들었습니다.")

    width, channels, rows = read_png(rendered)
    if width != big:
        raise SystemExit(f"{size}px: {big}를 요청했는데 {width}가 나왔습니다.")

    centre = big / 2
    radius_sq = (ratio * big) ** 2
    out = bytearray(size * size * 4)
    for oy in range(size):
        for ox in range(size):
            r = g = b = cover = 0
            for sy in range(SUPER):
                y = oy * SUPER + sy
                dy = y + 0.5 - centre
                line = rows[y]
                for sx in range(SUPER):
                    x = ox * SUPER + sx
                    dx = x + 0.5 - centre
                    if dx * dx + dy * dy > radius_sq:
                        continue  # 도장 바깥은 투명하게 둡니다
                    o = x * channels
                    r += line[o]
                    g += line[o + 1]
                    b += line[o + 2]
                    cover += 1
            if cover == 0:
                continue  # RGBA 0,0,0,0 그대로
            i = (oy * size + ox) * 4
            out[i] = round(r / cover)
            out[i + 1] = round(g / cover)
            out[i + 2] = round(b / cover)
            out[i + 3] = round(255 * cover / (SUPER * SUPER))

    target = ICONS / f"icon{size}.png"
    write_png(target, size, out)
    print(f"· {target.relative_to(REPO)}  {size}×{size}")


def main():
    if sys.platform != "darwin":
        raise SystemExit("Quick Look을 쓰므로 macOS에서만 동작합니다.")
    if not SVG.exists():
        raise SystemExit(f"{SVG}가 없습니다.")

    ratio = seal_radius_ratio(SVG.read_text(encoding="utf-8"))
    with tempfile.TemporaryDirectory() as tmp:
        for size in SIZES:
            bake(size, ratio, pathlib.Path(tmp))
    print("· manifest.json의 icons 항목과 크기가 맞는지 확인하세요.")


if __name__ == "__main__":
    main()
