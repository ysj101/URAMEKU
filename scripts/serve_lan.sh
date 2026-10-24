#!/usr/bin/env bash
# 実機検証用の LAN 配信（MVP-042）
#
# production ビルドを `vite preview --host` で同一 LAN 内の端末（iPhone / Android）へ配信し、
# 端末のブラウザに入力する URL を表示する。QR 表示は行わない（URL を手入力するか、
# メモ等で端末に送る）。
#
# 使い方:
#   scripts/serve_lan.sh              # ルート配信（/）。dist が無ければビルドする
#   scripts/serve_lan.sh --build      # 先に必ずビルドし直す
#   PORT=4180 scripts/serve_lan.sh    # ポート指定（既定 4173）
#   VITE_BASE_PATH=/URAMEKU/ scripts/serve_lan.sh --build   # GitHub Pages 相当のサブパスで配信
#
# 注意:
#   - 配信は HTTP（非 TLS）。localStorage / Web Audio / <dialog> は HTTP でも動作するが、
#     Android Chrome の「アプリをインストール」（PWA）は HTTPS が必要。PWA の検証は
#     GitHub Pages（MVP-045）か HTTPS トンネル経由で行うこと（docs/qa/device-test-plan.md 参照）。
#   - PC と端末が同じ Wi-Fi に接続され、PC 側のファイアウォールが指定ポートを許可している必要がある。
#   - 終了は Ctrl+C。
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

PORT="${PORT:-4173}"
BASE_PATH="${VITE_BASE_PATH:-/}"
BASE_PATH="/${BASE_PATH#/}"
BASE_PATH="${BASE_PATH%/}/"
FORCE_BUILD=0

for arg in "$@"; do
  case "$arg" in
    --build) FORCE_BUILD=1 ;;
    -h | --help)
      sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "unknown option: $arg" >&2
      exit 2
      ;;
  esac
done

if [ "$FORCE_BUILD" -eq 1 ] || [ ! -f dist/index.html ]; then
  echo "== build (VITE_BASE_PATH=$BASE_PATH)"
  VITE_BASE_PATH="$BASE_PATH" npx vite build --logLevel warn
else
  echo "== dist/ を再利用します（ビルドし直す場合は --build）"
fi

# LAN 側 IPv4 アドレスを列挙する（macOS / Linux）。取れなくても vite 自身が Network URL を表示する。
lan_ips() {
  if command -v ipconfig >/dev/null 2>&1 && [ "$(uname -s)" = "Darwin" ]; then
    for ifc in en0 en1 en2 en3; do
      ip="$(ipconfig getifaddr "$ifc" 2>/dev/null || true)"
      [ -n "$ip" ] && echo "$ip"
    done
  elif command -v hostname >/dev/null 2>&1 && hostname -I >/dev/null 2>&1; then
    hostname -I | tr ' ' '\n' | grep -E '^[0-9]+\.' || true
  elif command -v ip >/dev/null 2>&1; then
    ip -4 -o addr show scope global | awk '{print $4}' | cut -d/ -f1
  fi
}

echo "== 端末のブラウザで開く URL（同じ Wi-Fi に接続すること）"
FOUND=0
while IFS= read -r ip; do
  [ -z "$ip" ] && continue
  echo "   http://$ip:$PORT$BASE_PATH"
  FOUND=1
done < <(lan_ips)
if [ "$FOUND" -eq 0 ]; then
  echo "   （IP を自動取得できませんでした。下の vite の Network 行を参照してください）"
fi
echo "   PC 自身: http://localhost:$PORT$BASE_PATH"
echo "== 記録は docs/qa/device-test-log.md、結果は qa/device-matrix.json に反映すること"
echo

VITE_BASE_PATH="$BASE_PATH" exec npx vite preview --host 0.0.0.0 --port "$PORT" --strictPort
