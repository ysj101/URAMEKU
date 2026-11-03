#!/bin/sh
set -eu

range=${1:-origin/main..HEAD}
commits=$(git rev-list "$range" --)
failed=0

for sha in $commits; do
  for field in author-email committer-email message; do
    case "$field" in
      author-email) format=%ae ;;
      committer-email) format=%ce ;;
      message) format=%B ;;
    esac
    value=$(git log -1 --format="$format" "$sha" --)
    if printf '%s\n' "$value" | grep -Fiq '@gmail.com'; then
      printf 'gmail guard: commit %s matched in %s (address redacted).\n' "$sha" "$field" >&2
      failed=1
    fi
  done
done

for field in title body; do
  case "$field" in
    title) value=${PR_TITLE-} ;;
    body) value=${PR_BODY-} ;;
  esac
  if printf '%s\n' "$value" | grep -Fiq '@gmail.com'; then
    printf 'gmail guard: PR %s matched (address redacted).\n' "$field" >&2
    failed=1
  fi
done

if [ "$failed" -ne 0 ]; then
  exit 1
fi
printf 'gmail guard: checked commit range and PR metadata; no matches.\n'
