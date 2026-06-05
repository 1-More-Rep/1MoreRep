#!/usr/bin/env bash
# Deprecated alias — the canonical updater is now update.sh (adds a diff-gate so
# a no-op update is free, self-re-execs if the updater itself changed, and polls
# /api/health after deploy). Kept so existing muscle memory / docs still work.
exec "$(dirname "$(realpath "$0")")/update.sh" "$@"
