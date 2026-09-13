#!/bin/bash
# manifest.json의 버전으로 배포용 zip을 만들고 GitHub 공개 릴리스로 올립니다.
#
#   bash extension/release.sh            # zip만 만들고 멈춤
#   bash extension/release.sh --publish  # 태그와 릴리스까지 생성
set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# 어느 폴더에서 실행해도 같게 동작하도록 저장소 안에서 움직입니다.
REPO_DIR="$(cd "$SOURCE_DIR/.." && pwd)"
cd "$REPO_DIR"
VERSION="$(python3 -c "import json;print(json.load(open('$SOURCE_DIR/manifest.json'))['version'])")"
TAG="extension-v$VERSION"
WORK="$(mktemp -d)"
ZIP="$REPO_DIR/dojang-extension-v$VERSION.zip"
trap 'rm -rf "$WORK"' EXIT

# 압축을 풀면 폴더 하나가 나오게 담습니다. 크롬에서 그 폴더를 고르면 됩니다.
mkdir -p "$WORK/dojang-extension"
cp -R "$SOURCE_DIR"/* "$WORK/dojang-extension"/
# 개발용 파일은 확장에 필요 없습니다.
rm -f "$WORK/dojang-extension/install.sh" \
      "$WORK/dojang-extension/release.sh" \
      "$WORK/dojang-extension/build-icons.py" \
      "$WORK/dojang-extension/README.md" \
      "$WORK/dojang-extension/RELEASE_NOTES.md"

# 확장 아이디를 고정하는 key가 빠지면 로그인이 막힙니다.
python3 - "$WORK/dojang-extension/manifest.json" <<'PY'
import json, sys
manifest = json.load(open(sys.argv[1], encoding="utf-8"))
if "key" not in manifest:
    raise SystemExit("manifest.json에 key가 없습니다. 확장 아이디가 달라져 로그인이 막힙니다.")
for host in manifest["host_permissions"]:
    if "localhost" in host or "127.0.0.1" in host:
        raise SystemExit(f"로컬 주소가 남아 있습니다: {host}")
PY
grep -q "localhost" "$WORK/dojang-extension/config.js" &&
  { echo "config.js가 아직 로컬을 가리킵니다." >&2; exit 1; } || true

rm -f "$ZIP"
(cd "$WORK" && zip -qr "$ZIP" dojang-extension)
echo "· 만들었습니다: $ZIP ($(unzip -l "$ZIP" | tail -1 | awk '{print $2}')개 파일)"

if [ "${1:-}" != "--publish" ]; then
  echo "· 올리려면 --publish 를 붙여 다시 실행하세요."
  exit 0
fi

if gh release view "$TAG" >/dev/null 2>&1; then
  echo "· $TAG 릴리스가 이미 있습니다. manifest.json의 버전을 올려주세요." >&2
  exit 1
fi

git tag -a "$TAG" -m "확장 프로그램 $VERSION"
git push origin "$TAG"
gh release create "$TAG" "$ZIP" --title "도장 확장 프로그램 $VERSION" --notes-file "$SOURCE_DIR/RELEASE_NOTES.md"
echo "· 올렸습니다: $TAG"
