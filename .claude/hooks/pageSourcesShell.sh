#!/bin/bash
# CLAUDE_CODE_SHELL_PREFIX (set in .claude/settings.json): runs every shell command Claude Code spawns inside a
# macOS sandbox that allows everything but writing, moving or removing the author's page sources, so even a
# script that never names one is refused by the kernel. See .claude/rules/page-sources.md.
case "$0" in
    /*/.claude/hooks/*) ROOT="${0%/.claude/hooks/*}" ;;
    *) ROOT="$(cd "${0%/*}/../.." && pwd -P)" ;;
esac
ROOT="${PAGE_SOURCES_ROOT:-$ROOT}"
NAME="${PAGE_SOURCES_NAME:-source.txt}"

if [ ! -x /usr/bin/sandbox-exec ]; then
    echo "pageSourcesShell.sh: /usr/bin/sandbox-exec is missing, so no command runs (see .claude/rules/page-sources.md)" >&2
    exit 126
fi

# Both set REPLY rather than print, so building the profile forks nothing.
as_string() { REPLY="${1//\\/\\\\}"; REPLY="${REPLY//\"/\\\"}"; }
as_regex() {
    local s="$1" c i
    REPLY=""
    for ((i = 0; i < ${#s}; i++)); do
        c="${s:i:1}"
        case "$c" in [][\\.^\$*+?\(\)\{\}\|]) REPLY+="\\$c" ;; \") REPLY+='\"' ;; *) REPLY+="$c" ;; esac
    done
}

as_regex "$ROOT"; root_re="$REPLY"
as_regex "$NAME"; name_re="$REPLY"
# Each source file, and the folders holding them, which a rename or a removal would take the file with.
as_string "$ROOT"; folders="(literal \"$REPLY\")"
as_string "$ROOT/public"; folders+=" (literal \"$REPLY\")"
for file in "$ROOT"/public/*/"$NAME"; do
    [ -e "$file" ] || continue
    as_string "${file%/*}"; folders+=" (literal \"$REPLY\")"
done
profile="(version 1)
(allow default)
(deny file-write* (regex #\"^$root_re/public/.+/$name_re\$\"))
(deny file-write* $folders)"

exec /usr/bin/sandbox-exec -p "$profile" "${SHELL:-/bin/zsh}" -c "$1"
