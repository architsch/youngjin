# Source Changes Go Through the File-Editing Tools

The rule in one line, as [`../../CLAUDE.md`](../../CLAUDE.md) states it: **every file created or
modified under `src/` is written with Edit or Write, never by a shell command.** This page is why, and
where the line falls.

## Why

The user works in a permission mode where each file edit asks for approval, and that prompt is how
changes to `src/` get reviewed. Shell commands are approved against a separate allow list, and a rule
added there for one purpose (e.g. `Bash(python3 -)`) matches any script that happens to write files. A
multi-file change done that way lands without a single prompt, and the user only finds out afterwards.

## What counts as bypassing

Any shell command whose effect is to create or change a file under `src/`:

- inline scripts: `python3 - <<EOF`, `node -e`, `perl -pi`, `ruby -i`
- in-place editors: `sed -i`, `awk -i inplace`
- redirects and copies: `>`, `>>`, `tee`, `cp`/`mv` onto a source file, `cat <<EOF > file`
- a scratch script that writes into `src/`, run from anywhere

A change that touches many files, or repeats the same replacement many times, is still made one Edit at
a time (`replace_all` covers repeats within a file).

## Not covered

- Reading, searching and type-checking `src/` from the shell.
- Regenerating files marked auto-generated (e.g. `PreEncodedCompositionIndexMap`) by running the
  project's own build scripts.
- Deleting or renaming a file, which the file-editing tools cannot do: run it as its own shell command,
  on its own, so the user sees exactly what is removed. Never fold it into a command that does anything
  else.
