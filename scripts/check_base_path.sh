#!/usr/bin/env bash
# サブパス配信の検証スクリプト（MVP-004）
#
# 指定したベースパスで production ビルドし、`vite preview` で配信したうえで
# index.html / JS / CSS / manifest / 代表的な画像が HTTP 200 で返ることを curl で確認する。
#
# 使い方:
#   scripts/check_base_path.sh             # /URAMEKU/（GitHub Pages 本番相当）
#   scripts/check_base_path.sh /           # ルート配信（開発・プレビュー相当）
#   scripts/check_base_path.sh /foo/bar/   # 任意のサブパス
set -euo pipefail

BASE_PATH="${1:-/URAMEKU/}"
# 先頭・末尾のスラッシュを補う
BASE_PATH="/${BASE_PATH#/}"
BASE_PATH="${BASE_PATH%/}/"
PORT="${PORT:-4173}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "== build (VITE_BASE_PATH=$BASE_PATH)"
VITE_BASE_PATH="$BASE_PATH" npx vite build --logLevel warn

echo "== preview (http://localhost:$PORT$BASE_PATH)"
VITE_BASE_PATH="$BASE_PATH" npx vite preview --port "$PORT" --strictPort >/dev/null 2>&1 &
PREVIEW_PID=$!
trap 'kill "$PREVIEW_PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 50); do
  if curl -sf -o /dev/null "http://localhost:$PORT$BASE_PATH"; then break; fi
  sleep 0.2
done

# dist/index.html から実際に参照されている JS / CSS のパスを取り出す
HTML="dist/index.html"
JS_PATH="$(grep -o 'src="[^"]*\.js"' "$HTML" | head -1 | sed 's/src="//;s/"$//')"
CSS_PATH="$(grep -o 'href="[^"]*\.css"' "$HTML" | head -1 | sed 's/href="//;s/"$//')"
ICON_PATH="$(grep -o 'rel="icon" href="[^"]*"' "$HTML" | sed 's/.*href="//;s/"$//')"
MANIFEST_PATH="$(grep -o 'rel="manifest" href="[^"]*"' "$HTML" | sed 's/.*href="//;s/"$//')"

# ビルド成果物の中で、ベースパスが付いていない絶対参照が残っていないかを確認する
FAIL=0
echo "== static checks"
for p in "$JS_PATH" "$CSS_PATH" "$ICON_PATH" "$MANIFEST_PATH"; do
  case "$p" in
    "$BASE_PATH"*) echo "  ok   $p" ;;
    *) echo "  NG   $p (expected prefix $BASE_PATH)"; FAIL=1 ;;
  esac
done
if grep -o "url([^)]*)" dist/assets/*.css | grep -v "url($BASE_PATH" >/dev/null; then
  echo "  NG   CSS url() にベースパス無しの参照があります:"
  grep -o "url([^)]*)" dist/assets/*.css | grep -v "url($BASE_PATH" | sed 's/^/       /'
  FAIL=1
else
  echo "  ok   CSS url() はすべて $BASE_PATH 付き"
fi

echo "== HTTP checks"
# vite preview は SPA フォールバックで未知のパスにも index.html(200, text/html) を返すため、
# ステータスだけでなく Content-Type も期待値（前方一致）と照合する。
check() {
  local path="$1" expected_type="$2"
  local result code ctype
  result="$(curl -s -o /dev/null -w '%{http_code} %{content_type}' "http://localhost:$PORT$path")"
  code="${result%% *}"
  ctype="${result#* }"
  if [ "$code" = "200" ] && [[ "$ctype" == "$expected_type"* ]]; then
    echo "  200  $path ($ctype)"
  else
    echo "  NG   $path -> $code $ctype (expected 200 $expected_type*)"
    FAIL=1
  fi
}

check "$BASE_PATH" "text/html"
check "${BASE_PATH}index.html" "text/html"
check "$JS_PATH" "text/javascript"
check "$CSS_PATH" "text/css"
check "$MANIFEST_PATH" "application/manifest+json"
check "$ICON_PATH" "image/png"
check "${BASE_PATH}assets/brand/app-icon-192.png" "image/png"
check "${BASE_PATH}assets/brand/app-icon-512.png" "image/png"
check "${BASE_PATH}assets/brand/maskable-icon-512.png" "image/png"
check "${BASE_PATH}assets/backgrounds/newsprint.svg" "image/svg+xml"
check "${BASE_PATH}assets/backgrounds/desk.svg" "image/svg+xml"
check "${BASE_PATH}assets/characters/shinobu/poses/idle.png" "image/png"
check "${BASE_PATH}assets/cases/case-01/documents/ad.png" "image/png"

if [ "$FAIL" -ne 0 ]; then
  echo "== NG: 404 またはベースパス無しの参照があります"
  exit 1
fi
echo "== OK: すべて 200（base = ${BASE_PATH}）"
