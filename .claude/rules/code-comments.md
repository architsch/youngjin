# Code Comment Guidelines

The rule in one line, as [`../../CLAUDE.md`](../../CLAUDE.md) states it: **default to no comment; one
says only what the code cannot, in a line or two.** Comments exist for the next developer reading the
code, not to record the author's reasoning.

1. **Default to no comment.** Names and structure say *what*. A comment says only what the code cannot: a non-obvious *why*, a constraint or invariant, a workaround, or a trap.
2. **One or two short lines.** A genuinely tricky algorithm may get a brief outline. No essays, analogies, rhetorical asides, or debates over alternatives that were not chosen.
3. **No trivia.** Do not restate the code or the identifier, narrate history, describe the UI a value ends up in, or explain how another module works — point at it with `(see X)` instead.
4. **Keep tool directives** (`@ts-ignore`, eslint and webpack magic comments) and the user's own `NOTE`/`TODO` markers.
5. **When code changes, fix or delete the comments it invalidates** instead of adding a new one beside them.
