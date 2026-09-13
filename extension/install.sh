#!/bin/bash
# 도장 확장 프로그램을 맥에 설치할 수 있게 준비합니다.
#
# 크롬은 압축해제 확장을 사람이 직접 골라야만 로드합니다. 그래서 이 스크립트는
# 설정·복사·크롬 열기까지만 하고, 마지막 두 단계는 화면에 안내합니다.
#
#   bash install.sh
#   APP_URL=... SUPABASE_URL=... SUPABASE_KEY=... bash install.sh   # 묻지 않고 진행
set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${DOJANG_DIR:-$HOME/dojang-extension}"
CHROME="/Applications/Google Chrome.app"

if [ "$(uname)" != "Darwin" ]; then
  echo "이 스크립트는 맥용입니다. 다른 운영체제라면 README의 수동 절차를 따라주세요." >&2
  exit 1
fi

if [ ! -d "$CHROME" ]; then
  echo "구글 크롬을 찾지 못했습니다: $CHROME" >&2
  echo "크롬을 먼저 설치해주세요: https://www.google.com/chrome/" >&2
  exit 1
fi

ask() { # ask 변수명 "질문" "기본값"
  local current="${!1:-}"
  if [ -n "$current" ]; then return; fi
  local answer
  read -r -p "$2 [$3]: " answer </dev/tty || true
  printf -v "$1" '%s' "${answer:-$3}"
}

echo "도장 확장 설치를 준비합니다."
echo

# 저장소 안에서 실행하면 .env.local의 값을 기본값으로 씁니다.
# 여기 들어 있는 것은 브라우저에 이미 노출되는 publishable key뿐입니다.
ENV_FILE="$SOURCE_DIR/../.env.local"
env_value() {
  [ -f "$ENV_FILE" ] || return 0
  sed -n "s/^$1=//p" "$ENV_FILE" | tail -1 | tr -d '"'"'"' \r'
}
DEFAULT_APP_URL="$(env_value NEXT_PUBLIC_SITE_URL)"
DEFAULT_SUPABASE_URL="$(env_value NEXT_PUBLIC_SUPABASE_URL)"
DEFAULT_KEY="$(env_value NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)"

# 로컬 개발용 주소가 잡히면 운영 주소를 기본값으로 둡니다.
case "$DEFAULT_APP_URL" in ""|*localhost*|*127.0.0.1*)
  DEFAULT_APP_URL="https://coding-test-verification.vercel.app" ;;
esac
case "$DEFAULT_SUPABASE_URL" in ""|*localhost*|*127.0.0.1*)
  DEFAULT_SUPABASE_URL="https://dzibporiiexvsndungkx.supabase.co" ;;
esac

ask APP_URL "도장 서비스 주소" "$DEFAULT_APP_URL"
ask SUPABASE_URL "Supabase 프로젝트 주소" "$DEFAULT_SUPABASE_URL"
if [ -n "$DEFAULT_KEY" ]; then
  echo "· publishable key는 .env.local에서 읽었습니다."
  SUPABASE_KEY="${SUPABASE_KEY:-$DEFAULT_KEY}"
else
  ask SUPABASE_KEY "Supabase publishable key (sb_publishable_… 또는 anon key)" ""
fi

APP_URL="${APP_URL%/}"
SUPABASE_URL="${SUPABASE_URL%/}"

if [ -z "$SUPABASE_KEY" ]; then
  echo >&2
  echo "publishable key가 필요합니다. Supabase 대시보드의 Connect 화면에서 복사할 수 있습니다." >&2
  echo "관리자 키(secret key)는 절대 넣지 마세요. 브라우저에 노출됩니다." >&2
  exit 1
fi

case "$SUPABASE_KEY" in
  *service_role*|sb_secret_*)
    echo "관리자 키로 보입니다. publishable key만 사용해주세요." >&2
    exit 1
    ;;
esac

echo
echo "· 복사할 위치: $TARGET_DIR"
rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"
cp -R "$SOURCE_DIR"/* "$TARGET_DIR"/
rm -f "$TARGET_DIR/install.sh" "$TARGET_DIR/README.md"

cat > "$TARGET_DIR/config.js" <<CONFIG
// install.sh가 만든 파일입니다. 주소를 바꾸려면 스크립트를 다시 실행하세요.
export const CONFIG = {
  appUrl: "$APP_URL",
  supabaseUrl: "$SUPABASE_URL",
  supabasePublishableKey:
    "$SUPABASE_KEY",
};
CONFIG

APP_URL="$APP_URL" SUPABASE_URL="$SUPABASE_URL" TARGET_DIR="$TARGET_DIR" python3 - <<'PY'
import json, os
path = os.path.join(os.environ["TARGET_DIR"], "manifest.json")
with open(path, encoding="utf-8") as f:
    manifest = json.load(f)
# 콘텐츠 스크립트가 붙는 곳은 그대로 두고 서비스 주소만 갈아끼웁니다.
# '로컬이 아닌 것'으로 거르면 다시 실행할 때마다 옛 주소가 쌓입니다.
platforms = sorted({
    match for script in manifest.get("content_scripts", []) for match in script["matches"]
})
manifest["host_permissions"] = [
    f"{os.environ['APP_URL']}/*",
    f"{os.environ['SUPABASE_URL']}/*",
    *platforms,
]
with open(path, "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)
    f.write("\n")
print("· 접근 권한:", ", ".join(manifest["host_permissions"]))
PY

# 대시보드 주소는 실제 Supabase 프로젝트일 때만 안내합니다.
PROJECT_REF="$(printf '%s' "$SUPABASE_URL" | sed -nE 's#^https://([a-z0-9]{16,})\.supabase\.co/?$#\1#p')"
echo "· 설정 완료"
echo
open -a "$CHROME" "chrome://extensions" 2>/dev/null || true
open "$TARGET_DIR" 2>/dev/null || true

cat <<GUIDE

크롬 확장 페이지와 설치 폴더를 열었습니다. 두 단계만 직접 해주세요.

  1. 크롬 오른쪽 위 '개발자 모드'를 켭니다.
  2. '압축해제된 확장 프로그램을 로드합니다'를 누르고 이 폴더를 고릅니다.

       $TARGET_DIR

그다음 목록에 나온 확장 프로그램 ID를 복사해서, Supabase의
Authentication > URL Configuration > Redirect URLs에 아래를 추가합니다.
GitHub 로그인이 확장으로 돌아오는 주소이며, 한 번만 등록하면 됩니다.

       https://<확장-ID>.chromiumapp.org/*
${PROJECT_REF:+
설정 화면 주소입니다.

       https://supabase.com/dashboard/project/$PROJECT_REF/auth/url-configuration
}
설치가 끝나면 도장 아이콘을 눌러 GitHub로 연결하고 스터디를 고르세요.
GUIDE
