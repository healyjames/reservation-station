#!/usr/bin/env bash
# Blocks Claude from running `git commit` / `git push`. Commits are the user's action.
input=$(cat)
PY=$(command -v python3 || command -v python)
cmd=$(printf '%s' "$input" | "$PY" -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null)
if printf '%s' "$cmd" | grep -qiE '(^|[;&|]|[[:space:]])git[[:space:]]+(commit|push)([[:space:]]|$)'; then
  echo "Blocked: 'git commit' / 'git push' is the user's action in this workflow. Suggest a commit message and ask the user to run it (they can use the ! prefix)." >&2
  exit 2   # exit code 2 tells Claude Code to block the tool call and surface stderr
fi
exit 0
