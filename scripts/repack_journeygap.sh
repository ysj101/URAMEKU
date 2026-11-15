#!/bin/sh
# Rebuild the exact reviewed upstream commit without publishing any packages.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SDK_SOURCE=$(mktemp -d)
trap 'rm -rf "$SDK_SOURCE"' EXIT HUP INT TERM
git clone --quiet https://github.com/ysj101/jorney_gap.git "$SDK_SOURCE"
git -C "$SDK_SOURCE" checkout --quiet 96c01aaeccd022c556f64fff5a4777604446734a
(cd "$SDK_SOURCE" && pnpm install --frozen-lockfile && pnpm build)
for PACKAGE in core web relay; do
  pnpm --dir "$SDK_SOURCE/packages/$PACKAGE" pack --pack-destination "$ROOT/vendor/journeygap"
done
cp "$SDK_SOURCE/LICENSE" "$ROOT/vendor/journeygap/LICENSE"
