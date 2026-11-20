# Project Overview

This repository is ThingsPool's: its website, and the software it makes. ThingsPool is the maker's independent research lab, and the name of his site; it is never a game's name.

- **The website** is published from `/public` at thingspool.net, and built by the generator in `/ssg`, which holds its templates too.
- **Robot Rooms** (`/robot-rooms`) is the 3D sandbox game at app.thingspool.net, the only software made here so far. Everything of it is in that folder, with instructions of its own: [`robot-rooms/CLAUDE.md`](robot-rooms/CLAUDE.md). Claude Code loads that file once a file in the folder is read; read it before any work on the game.

Besides these, only `README.md`, the license files, `CLAUDE.md`, `/.claude` and `/.github` (the workflows that publish the site and deploy the game) are at the root, with a `temp` of the site's own scratch.

## The Website

- **`/public`** - The site as GitHub Pages serves it. Each library list and arcade game is a folder holding the `source.txt` its pages are built from (the author's alone, see *Project Rules*), its pictures and the pages themselves; the home page, the feeds, the sitemap and the stylesheet are beside them. Robot Rooms' own build writes two folders here, `/app/assets` (what the game loads from the site) and `/error` (its error pages), and `/RobotRooms/skill.md`, beside its page, is the manual for the AI agents that play it (`/skill.md`, its old address, only points there).
- **`/ssg`** - The generator of the site's pages: TypeScript that Node runs as it is, with a `package.json` of its own (`npm ci` there once). `data/` lists the library's lists, the arcade's games and the topic feeds; `builder/` turns each source into pages, the feeds and the sitemap; `style/` holds the stylesheet; `tests/` its tests.
  - **`/ssg/views`** - Its EJS templates: `/page/static` (one for each kind of page), `/page/development` (the page the site's styles are tried on), `/partial`.

Its commands run in `/ssg`:

| Command | What it does |
|---|---|
| `npm run build` | builds the site into `/public`, writing only the files that changed |
| `npm run check` | tells whether a build would change anything (the pre-commit hook runs it) |
| `npm run preview` | shows the site at `http://127.0.0.1:3400`, rebuilt whenever a source, a template or the generator changed, and the style test page at `/test-ui` |
| `npm run postImagePreprocess <percent>` | scales every `.png` and `.jpg` in `/temp/post_images` by that percentage into JPEGs in its `out/`, encoded like the pictures already in `/public/devlog-2026` (transparent parts take the page background) |
| `npm test`, `npm run typecheck` | its tests and its types |

Before a commit, the site is built there when a source, a template or the generator changed, and `npm run beforeCommit` runs in `/robot-rooms` when the game changed; the pre-commit hook checks both.

## Important Files
- `README.md` - What ThingsPool is, and the repository's layout and licenses
- `LICENSE` - Apache License 2.0, covering the source code (verbatim; never edit)
- `LICENSE-CONTENT.md` - Terms for the written and illustrated works, which are all rights reserved
- `THIRD-PARTY-NOTICES.md` - Bundled third-party assets and dependency licenses
- `NOTICE` - Apache-2.0 attribution notice, pointing at the two files above
- `ssg/data/libraryData.ts`, `ssg/data/arcadeData.ts` - The library's lists and the arcade's games, each naming its folder in `/public`
- `ssg/views/page/static/index.ejs`, `ssg/views/partial/common/header.ejs` - The home page, and the head every page of the site shares (its default description and keywords)

## Project Rules

Each rule is binding as written. Its page in `.claude/rules/`, loaded along with this file, is the rule in full: the reasoning, the edge cases and the checklist. A rule's detail goes on its page, not here. Robot Rooms has five more of its own (room generation, plan documents, agents, helpers, its docs), listed in [`robot-rooms/CLAUDE.md`](robot-rooms/CLAUDE.md) with their pages beside these.

- **The License Files Must Describe What Actually Ships** ([`license-files.md`](.claude/rules/license-files.md)): when the set of things that ship changes, `LICENSE-CONTENT.md` and `THIRD-PARTY-NOTICES.md` change in the same commit. A copyleft or source-available dependency is the user's decision; `LICENSE` is never edited.
- **Source Changes Go Through the File-Editing Tools** ([`source-edits.md`](.claude/rules/source-edits.md)): every file created or modified under `robot-rooms/src/` or `ssg/` is written with Edit or Write, never by a shell command.
- **Page Sources Are the Author's Alone** ([`page-sources.md`](.claude/rules/page-sources.md)): the `source.txt` that each library and arcade page under `public/` is built from is never edited, overwritten, moved or deleted; a deny rule, a hook and a sandbox around every shell command, all set in `.claude/settings.json`, enforce it.
- **Code Comment Guidelines** ([`code-comments.md`](.claude/rules/code-comments.md)): default to no comment; one says only what the code cannot, in a line or two.
