# Obsolete Audio Files Are Removed Unasked

The rule in one line, as [`../../robot-rooms/CLAUDE.md`](../../robot-rooms/CLAUDE.md) states it: **whenever a change
touches the game's sounds, the audio files under `public/app/assets/audio` that nothing uses any more go in the same
change, unasked, but never one a build on the server still plays: staging, live, or the backup a rollback restores.**
This page is why, and where the line falls.

## Why

The site's assets serve staging and live alike, and every push publishes them along with staging, while live keeps the
build it was last promoted to. So the audio bundle is named by its version, and each new one is published beside the
ones before it: the live game goes on cutting its clips from the bundle its own build names (see
`robot-rooms/docs/audio/audio.md`). The build never removes an older bundle, since it can't tell which ones the builds on
the server play, nor a recording the manifest no longer lists. Everything in `public/` is published, so each would stay
on the site for good.

## What is obsolete

An audio file under `public/app/assets/audio` is in use while any of these holds, and obsolete once none does:
- the map the build writes (`AudioBundleMap`) names it: the current bundle, or a stream;
- the audio manifest lists it: a recording the bundle is made from, or a stream;
- a build on the server plays it: staging, live, or the backup a rollback restores (its client copy names it).

`node dev/scripts/audio/findObsoleteAudio.js` (run in `robot-rooms/`) lists every audio file with what uses it, then the
obsolete ones, then any file something names that is missing. It reads the server's three client copies over SSH, with
one fixed, read-only command (the backup's is served to no one), and when it can't read all three, it calls none
obsolete.

## What to do

- **When**: whenever a change touches the sounds (`ProceduralSounds`, the manifest, a recording, the bundle's builder, or
  how the client loads or plays the clips), run it once the build has written the map, before the hand-over. An obsolete
  audio file noticed at any other time is dealt with the same way.
- **Remove** each obsolete file with `rm`, in a command of its own, so the deletion is seen on its own (as
  [`source-edits.md`](source-edits.md) asks of deletions).
- **A recording** removed takes its line in the README of its folder and its row in `THIRD-PARTY-NOTICES.md` with it
  (see [`license-files.md`](license-files.md)).
- **A file a build on the server plays that is missing** was removed too early: restore it from git at once, or that
  build plays no clip.
- **Say so** in the hand-over: the files removed, or that none was obsolete.

## Where the line falls

- A bundle stays, however old, while staging, live or the backup plays it. A promotion first copies live into the
  backup, so a bundle goes only once two promotions have moved past it, and then at the next change to the sounds; a
  promotion alone removes nothing. Counting pushes or bundles instead would not do: several pushes can change the sounds
  between two promotions.
- The server keeps one backup, and a second rollback restores that same build again, so keeping the backup's bundle
  keeps the sounds of every rollback there can be.
- Only audio files: the manifest and the READMEs stay.
