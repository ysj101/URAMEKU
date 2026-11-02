#!/bin/sh
set -eu

# linked worktree では共有の Git 設定を変更しない。
[ -d .git ] || exit 0
git config core.hooksPath .githooks || true
