#!/bin/sh
# Rebuild the reviewed distribution without publishing anything.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SDK_SOURCE=$(mktemp -d)
trap 'rm -rf "$SDK_SOURCE"' EXIT HUP INT TERM
git clone --quiet https://github.com/ysj101/journeygap-grafana.git "$SDK_SOURCE"
git -C "$SDK_SOURCE" checkout --quiet 93bd2aabcdb8801b3510d4569b6e86ee06c74a6d
(cd "$SDK_SOURCE" && npm ci --ignore-scripts && npm run build && npm pack --ignore-scripts --pack-destination "$ROOT/vendor/journeygap-grafana")
cp "$SDK_SOURCE/LICENSE" "$ROOT/vendor/journeygap-grafana/LICENSE"
(cd "$ROOT/vendor/journeygap-grafana" && shasum -a 256 journeygap-grafana-0.1.0.tgz > SHA256SUMS)
