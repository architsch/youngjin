# Page Sources Are the Author's Alone

The rule in one line, as [`../../CLAUDE.md`](../../CLAUDE.md) states it: **the `source.txt` that each
library and arcade page under `public/` is built from is never edited, overwritten, moved or deleted.**
This page is why, and where the line falls.

## Why

Each `public/<dir>/source.txt` is the author's own writing, the text the static site generator turns
into his essays, stories and game pages. An edit made in passing (a typo fixed during a sweep, a rename
followed into his text, a file removed with its folder) changes his published work without his say.

## What enforces it

- `Edit(/public/**/source.txt)` in the `deny` list of `.claude/settings.json` refuses Edit, Write and
  NotebookEdit.
- `.claude/hooks/protectLibrarySources.js` refuses them too, and any shell command that would write,
  move or remove one: by name, through a folder or glob holding one, by a redirect, `tee` or inline
  script, or by a git command that would discard uncommitted changes to one.
- `.claude/hooks/pageSourcesShell.sh`, set as `CLAUDE_CODE_SHELL_PREFIX` in the same file, runs every
  shell command Claude Code spawns (and hooks, and stdio MCP servers) in a macOS sandbox that refuses to
  write, move or remove a source file or a folder holding one, so a script that never names one is
  refused by the kernel.

Two consequences of the sandbox: nothing inside it can start a sandbox of its own, so Claude Code's own
`/sandbox` stays off and a tool that sandboxes itself (Chromium launched with its sandbox on) fails; and
without `/usr/bin/sandbox-exec` no shell command runs at all, until the prefix line is removed.

## Where the line falls

- Reading is fine: the Read tool, `cat`, `grep`, `git diff`, `git log`, and the build that reads them.
- A mistake found in one (a typo, a dead link, a stale name) is reported to him, never fixed.
- The rest of `public/`, the generated pages included, follows the usual rules.
