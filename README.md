# ThingsPool

*Reinventing computer science through the lens of philosophy.*

ThingsPool is an independent research lab founded by Youngjin, a software engineer with a background in game and web development. ThingsPool explores new paradigms in computer science by means of unconventional thought experiments, software toys, and digital humanities.

**[thingspool.net](https://thingspool.net)**

## What is here

- **[Library](https://thingspool.net/library.html)** — a collection of essays and thought experiments, which cover a wide range of subjects including computer science, game design, logic, philosophy, and art.
- **[Arcade](https://thingspool.net/arcade.html)** — the games made by ThingsPool.
- **[Robot Rooms](robot-rooms/)** — one of those games: a web-based 3D sandbox multiplayer world where AI agents can play with humans. Its code, documentation and tests are in [`robot-rooms/`](robot-rooms/). **[Play Now](https://app.thingspool.net/?ref=github)**

## Repository layout

| | |
|---|---|
| [`public/`](public/) | the website as published at thingspool.net: the library's writings, the arcade's pages, and the assets Robot Rooms loads |
| [`ssg/`](ssg/) | the generator that builds the site's pages from the writings, with its templates |
| [`robot-rooms/`](robot-rooms/) | Robot Rooms (client, server, dev scripts, tests and docs); start from its [README](robot-rooms/README.md) |
| `.github/` | the workflows that publish the site and deploy the game |
| `CLAUDE.md`, `.claude/` | instructions for the AI assistant that works on this repository |

## Building the site

The pages under `public/` are generated. Each library list and each arcade game is a folder holding a `source.txt`, which the generator in `ssg/` turns into its pages; the home page, the feeds and the sitemap are built with them. It needs Node.js 24 or later, which runs its TypeScript as it is.

```
cd ssg
npm ci             # once
npm run build      # writes the pages into public/
npm run preview    # shows the site at http://127.0.0.1:3400, rebuilt as its sources change
npm test
```

Robot Rooms is built apart, in its own folder (see its [README](robot-rooms/README.md)).

## License

This repository holds two different kinds of work, under two different sets of terms.

- **The code is open source.** Everything in `ssg/` and `robot-rooms/` (its `src/`, `views/`, `dev/`, `tests/`, `docs/` and build configuration), and `.github/`, is licensed under the [Apache License, Version 2.0](LICENSE). Fork it, modify it, self-host it, build a business on it. So is Robot Rooms' manual for AI agents, `public/RobotRooms/skill.md`; its copy on ClawHub, `robot-rooms/dev/clawhub/`, is MIT-0, the license ClawHub requires.
- **The writing and artwork are not.** The essays, articles, illustrations, cartoons and dev-log posts published under `public/`, and the original game artwork, remain **all rights reserved**. See [LICENSE-CONTENT.md](LICENSE-CONTENT.md) for exactly what this covers and why.

If you fork this repository to build something of your own, replace the content with your own.

Third-party assets and dependencies carry their own licenses — including twelve public-domain (CC0) texture packs from Screaming Brain Studios. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

The ThingsPool and Robot Rooms names and the ThingsPool logo are not covered by any of the above; Apache-2.0 grants no trademark rights.
