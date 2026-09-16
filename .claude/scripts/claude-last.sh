#!/usr/bin/env bash
# Copy a Claude Code response out of the session transcript as raw Markdown.
#
# The VS Code extension has no /export or /copy -- both are registered with
# requires:{ink:true}, so they exist only in the terminal TUI. This reads the
# JSONL transcript that the extension and the CLI both write to
# ~/.claude/projects/<slug>/<session>.jsonl.
#
# A "response" is one whole turn: every assistant text block between two real
# user messages, joined. Tool results arrive as user entries too, so they are
# explicitly not treated as turn boundaries.
#
# Run: `.claude/scripts/claude-last.sh --help`
#
# NOTE : If permission is denied, run: `chmod +x .claude/scripts/claude-last.sh`

set -uo pipefail

PROG=${0##*/}
PROJECTS_DIR=${CLAUDE_PROJECTS_DIR:-$HOME/.claude/projects}

N=1
OUT=
TARGET_DIR=$PWD
MODE=get
FINAL_ONLY=0
TO_STDOUT=0
SEARCH_ALL=0

usage() {
  cat <<EOF
Usage: $PROG [-n N] [-o FILE] [-p DIR] [--stdout] [--list] [--all]

Copies Claude's Nth-latest response to the clipboard as Markdown.

  -n N        1 = latest response, 2 = the one before it, ...  (default: 1)
  -o FILE     also write the response to FILE
  -p DIR      use the session for DIR instead of the current directory
  --final     just the closing message, without the progress notes before it
  --stdout    print to stdout instead of copying
  --list      list available responses (index, time, first line) and exit
  --all       use the newest session across every project, not just this one
  -h          show this help

Examples:
  $PROG                     # latest response -> clipboard
  $PROG --final             # ...without the "Let me check X" progress lines
  $PROG -n 2                # the response before that
  $PROG --list              # see what is available
  $PROG -n 3 -o notes.md    # clipboard + file
EOF
}

die() { printf '%s: %s\n' "$PROG" "$1" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case $1 in
    -n) [ $# -ge 2 ] || die "-n needs a value"; N=$2; shift 2 ;;
    -o) [ $# -ge 2 ] || die "-o needs a value"; OUT=$2; shift 2 ;;
    -p) [ $# -ge 2 ] || die "-p needs a value"; TARGET_DIR=$2; shift 2 ;;
    --final) FINAL_ONLY=1; shift ;;
    --stdout) TO_STDOUT=1; shift ;;
    --list) MODE=list; shift ;;
    --all) SEARCH_ALL=1; shift ;;
    -h|--help) usage; exit 0 ;;
    [0-9]*) N=$1; shift ;;
    *) die "unknown option: $1 (try -h)" ;;
  esac
done

case $N in
  ''|*[!0-9]*) die "n must be a positive integer, got '$N'" ;;
  *) [ "$N" -ge 1 ] || die "n must be >= 1" ;;
esac

# Transcript directories are named after the session's starting directory with every
# non-alphanumeric byte replaced by a dash. Your shell is rarely sitting exactly there,
# so resolve in four steps: this directory, then below it, then above it, then anywhere.
find_transcript() {
  python3 - "$PROJECTS_DIR" "$1" "$SEARCH_ALL" <<'PY'
import json
import os
import string
import sys

projects_dir, target, search_all = sys.argv[1], sys.argv[2], sys.argv[3] == "1"
ALNUM = frozenset(string.ascii_letters + string.digits)


def die(msg):
    sys.exit("claude-last: " + msg)


def slug(path):
    return "".join(c if c in ALNUM else "-" for c in path)


def newest_jsonl(directory):
    try:
        found = [
            os.path.join(directory, f)
            for f in os.listdir(directory)
            if f.endswith(".jsonl")
        ]
    except OSError:
        return None
    found = [p for p in found if os.path.isfile(p)]
    return max(found, key=os.path.getmtime) if found else None


def session_cwd(path):
    """The session's own record of where it started. Leading entries carry no cwd."""
    try:
        with open(path, encoding="utf-8") as fh:
            for _ in range(40):
                line = fh.readline()
                if not line:
                    break
                try:
                    cwd = json.loads(line).get("cwd")
                except ValueError:
                    continue
                if cwd:
                    return cwd
    except OSError:
        pass
    return ""


def emit(path, note=None):
    if note:
        sys.stderr.write("claude-last: " + note + "\n")
    print(path)
    sys.exit(0)


try:
    project_dirs = sorted(os.listdir(projects_dir))
except OSError:
    die("no transcript directory at %s" % projects_dir)


def newest_across(dirs):
    found = [
        p
        for p in (newest_jsonl(os.path.join(projects_dir, d)) for d in dirs)
        if p
    ]
    return max(found, key=os.path.getmtime) if found else None


if search_all:
    best = newest_across(project_dirs)
    emit(best) if best else die("no transcripts under %s" % projects_dir)

if not os.path.isdir(target):
    die("not a directory: %s" % target)
target = os.path.realpath(target)

# 1. a session started exactly here
best = newest_jsonl(os.path.join(projects_dir, slug(target)))
if best:
    emit(best)

# 2. a session started in a subdirectory -- running from a monorepo root while the
#    session lives in one checkout. The slug transform is lossy (both "/" and "-"
#    become "-"), so a name match is only a candidate; the recorded cwd decides.
prefix, under = slug(target), target.rstrip("/") + "/"
nested = [
    p
    for d in project_dirs
    if d.startswith(prefix) and d != prefix
    for p in [newest_jsonl(os.path.join(projects_dir, d))]
    if p and session_cwd(p).startswith(under)
]
if nested:
    emit(max(nested, key=os.path.getmtime))

# 3. a session started in a parent directory
walk = os.path.dirname(target)
while True:
    best = newest_jsonl(os.path.join(projects_dir, slug(walk)))
    if best:
        emit(best)
    parent = os.path.dirname(walk)
    if parent == walk:
        break
    walk = parent

# 4. nothing related: the newest session anywhere is almost always the live one
best = newest_across(project_dirs)
if best:
    emit(best, "no session for %s -- falling back to the most recent session anywhere" % target)
die("no transcripts under %s" % projects_dir)
PY
}

extract() {
  python3 - "$1" "$2" "$3" <<'PY'
import json
import sys

path, n_arg, mode = sys.argv[1], sys.argv[2], sys.argv[3]


def blocks_of(entry):
    content = entry.get("message", {}).get("content")
    if isinstance(content, str):
        return [{"type": "text", "text": content}]
    return [b for b in (content or []) if isinstance(b, dict)]


def is_turn_boundary(entry):
    """A real user message. Tool results and injected reminders are not."""
    if entry.get("type") != "user" or entry.get("isMeta"):
        return False
    blocks = blocks_of(entry)
    if any(b.get("type") == "tool_result" for b in blocks):
        return False
    return any(b.get("type") == "text" and b.get("text", "").strip() for b in blocks)


turns, current = [], None
with open(path, encoding="utf-8") as fh:
    for line in fh:
        line = line.strip()
        if not line:
            continue
        try:
            entry = json.loads(line)
        except ValueError:
            continue
        if entry.get("isSidechain"):
            continue
        if is_turn_boundary(entry):
            current = None
            continue
        if entry.get("type") != "assistant":
            continue
        text = "".join(
            b.get("text", "") for b in blocks_of(entry) if b.get("type") == "text"
        )
        if not text.strip():
            continue
        if current is None:
            current = {"ts": entry.get("timestamp", ""), "parts": []}
            turns.append(current)
        current["parts"].append(text.strip())

join = (lambda parts: parts[-1]) if mode == "final" else (lambda parts: "\n\n".join(parts))
responses = [(join(t["parts"]), t["ts"]) for t in turns]
if not responses:
    sys.exit("no assistant text found in %s" % path)

if mode == "list":
    for i, (text, ts) in enumerate(reversed(responses), 1):
        first = " ".join(text.split())[:88]
        sys.stdout.write("%3d  %-20s %s\n" % (i, (ts[:19] or "-"), first))
    sys.exit(0)

n = int(n_arg)
if n > len(responses):
    sys.exit("n=%d out of range: only %d response(s) in this session" % (n, len(responses)))
sys.stdout.write(responses[-n][0])
PY
}

to_clipboard() {
  if command -v pbcopy >/dev/null 2>&1; then pbcopy
  elif command -v wl-copy >/dev/null 2>&1; then wl-copy
  elif command -v xclip >/dev/null 2>&1; then xclip -selection clipboard
  elif command -v xsel >/dev/null 2>&1; then xsel --clipboard --input
  elif command -v clip.exe >/dev/null 2>&1; then clip.exe
  else cat >/dev/null; return 1
  fi
}

command -v python3 >/dev/null 2>&1 || die "python3 not found on PATH"

FILE=$(find_transcript "$TARGET_DIR") || exit 1

if [ "$MODE" = list ]; then
  extract "$FILE" "$N" list || exit 1
  printf 'session: %s\n' "$FILE" >&2
  exit 0
fi

[ "$FINAL_ONLY" = 1 ] && MODE=final
TEXT=$(extract "$FILE" "$N" "$MODE") || exit 1

[ -n "$OUT" ] && { printf '%s\n' "$TEXT" > "$OUT" || die "could not write $OUT"; }

if [ "$TO_STDOUT" = 1 ]; then
  printf '%s\n' "$TEXT"
else
  printf '%s' "$TEXT" | to_clipboard \
    || die "no clipboard tool found (pbcopy/wl-copy/xclip/xsel/clip.exe) -- use --stdout"
  printf 'copied response -%s from %s%s\n' \
    "$N" "$(basename "$FILE")" "${OUT:+ (also wrote $OUT)}" >&2
fi
