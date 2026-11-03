# Documentation Guidelines (`/docs`, excluding `/docs/plans`)

The rule in one line, as [`../../CLAUDE.md`](../../CLAUDE.md) states it: **a `/docs` page is a short map
of one subsystem, for a developer about to work on it**: what it is for, its core concepts and
invariants, the main flow, and where the code lives. It is not a description of everything the subsystem
does. Keep each page as short as its subject allows — most fit on a screen or two. (`/docs/plans` is
outside all of this; see [`plan-documents.md`](plan-documents.md).)

1. **Keep only what development needs.** Purpose, core concepts, invariants, data flow, key design decisions, and non-obvious traps. Cut UI walkthroughs, per-field or per-setting descriptions, edge-case enumerations, tuning rationale, restatements, and anything a reader gets faster from the code.
2. **Terse, not prose.** Bullets, tables and short sentences. A design decision gets at most one clause of *why*; no essays, analogies, or narrated alternatives.
3. **Describe only the present.** No history ("it used to…") and no future plans ("once X lands…").
4. **No exact numbers or internal names.** No constant values, sizes, intervals or thresholds; no local-variable, function or method names. Globally accessible module, class, type and exported-constant names, signal names, and `@src/...` file references are fine.
5. **Exception — `/docs/testing`, `/docs/devOps`, and DB/migration specifics** may carry commands, flags, schema and configuration, since precision matters there — but only what is needed to run or fix things, still without prose.
6. **Edit in place and keep pages short.** When behavior changes, rewrite the line that is now wrong; never append a note beside it. A new feature usually changes a bullet, not adds a section. A small feature gets code comments, not a page of its own; a new page must be linked from `README.md`.
