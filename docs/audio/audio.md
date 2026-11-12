# Audio System

Reference: @src/client/audio/audioManager.ts , @src/client/audio/util/audioTriggerUtil.ts , @src/client/audio/types/audioVoice.ts , @src/client/audio/types/spatialAudioVoice.ts , @src/client/audio/types/bundledClipPlayer.ts , @src/client/audio/types/streamedClipPlayer.ts , @src/client/audio/util/audioContextUtil.ts , @src/client/audio/util/audioStreamUtil.ts , @src/client/audio/util/audioBundleUtil.ts , @src/client/audio/util/spatialAudioUtil.ts , @src/client/audio/maps/audioBundleMap.ts , @src/server/ssg/builder/audioBundleBuilder.ts , @src/server/ssg/data/proceduralSounds.ts , @src/server/ssg/util/proceduralSoundUtil.ts , @public/app/assets/audio/manifest.json

`AudioManager` plays sound in the browser; the server plays none. Short clips are cut from one bundled file on the static site, downloaded and decoded once; long ones stream from files of their own.

## Playing
- Four kinds of sound, each a voice its owner keeps to change its volume or stop it: a clip once, or one clip looping, or several in an endless shuffled sequence (each once a round, never one twice in a row), at a fixed volume or at a position in the world. A voice may play faster, and so higher.
- A positioned voice's position is its owner's to move as its source does. After each frame is drawn it is heard from the camera (`SpatialAudioUtil`):
  - fading with distance, to silence at its range;
  - quieter and duller for each wall in between: a block the line enters through a drawn face, as the eye would meet it, so a wall hidden from the orbit camera muffles nothing;
  - panned toward the side it is on, never into one ear alone.
- A clip is named by `ProceduralSounds` or the audio manifest. `AudioClipName` comes from the generated map, so a name in neither fails to compile.
- Between rooms, positioned voices stop with the room, and the rest play on. A positioned loop its owner never stopped is reported.

## What sounds
- Gameplay and the UI never call `AudioManager`. They publish what happened, and `AudioTriggerUtil` is the one table of which event sounds as what, as `ParticleTriggerUtil` is for effects.
  - The UI, chat and building make none, whoever builds: no press, popup, panel, selection, tutorial mark or line sent, and nothing put up, taken down, moved, turned, repainted or changed.
  - Others coming and going sound where they do (a door opening, a door shutting), as do the dollars they collect. A ghost is never heard, nor is what anyone says, nor what a helper shows of what it is doing.
  - What the user is given and spends, and their travel, are heard alike from anywhere: a door shutting as they leave a room and one opening as they arrive in any (once the first has shut), dollars reaching the count, the day's reward, and dollars spent.
  - A [cannon](../gameplay/cannon.md) firing, and its ball bouncing or bursting, sound where they happen, fading more slowly than anything else, the shot and the burst the loudest. Two balls bouncing off each other clang once; what a blast breaks makes no sound. A cannon that has fired its last puffs away.
- One moment is one sound: a sound of something done (travel, dollars spent, the day's reward, a spent cannon's puff) plays at once, and is the only one of its moment. Others' coming and going, collected dollars and what cannons do are each their own.
- An object's own sound is its game object's: a fan's wind is a loop from just in front of it, louder and higher the more blades it has, its air above a cannon's gears and its hum below them (`FanGameObject`), and a cannon's gears grind while its barrel turns toward someone, heard from farther off than it fires (`CannonGameObject`).

## When sound is heard
- Browsers keep a page silent until the user does something on it, so the AudioContext is made at once only on a page already used, and else at the first input (`AudioContextUtil`).
- A clip played once is heard now or never: asked for before the page can make sound, or while it is hidden, it is dropped rather than saved up. A loop waits, and starts as soon as it can: a stream once there is a context, a clip of the bundle once it is decoded too.
- While the page is hidden the context is suspended and streams pause, since no frame runs there to keep positions in step with the room. They go on where they were once the page is shown. A stream the browser refuses to start waits for the next input.
- The bundle downloads along with the first room, so that coming into it is heard if an input has let the page make sound by then. An agent's camera page loads no sound.

## The clips
- SSG's `AudioBundleBuilder` makes them, and writes where each is to `AudioBundleMap`.
- Most are made, not recorded: `ProceduralSounds` describes each as tones and filtered noise under envelopes, which `ProceduralSoundUtil` renders the same every time.
- The audio manifest lists the recordings (the doors, a cash register, a cannon's shot, burst and gears, an anvil struck for its ball's bounce), each by name and file: a WAV file goes in the bundle, and an MP3 file streams from where it is. Anything long has to stream, since the whole bundle downloads before any clip plays and stays decoded in memory.
- The bundle is one MP3, the one compact format every browser decodes (Safari included), at one rate, and stereo if any clip is.
  - Each clip lies between paddings: silence, which takes in what the encoder smears across its edges, or, for a loop, its own other end, so that its seam is encoded as it sounds looping. A loop is resampled as a periodic signal for the same reason.
  - It opens with a click alone in silence. Decoders differ in how much of the encoder's delay they trim, so the client finds the click and shifts every clip by as much as it moved.
- Each file is fetched under a version, a hash of what it holds, so a cached older file is never cut by a newer map.
- The bundle is encoded only when its samples change, so SSG needs an encoder (LAME, see [local_dev.md](../devOps/local_dev.md)) only then. The map is written only when it changes, since the dev server restarts on it.
- A recording comes with terms: the README in its folder names its source, author and license and how it was cut (a test checks each file is named there), and `THIRD-PARTY-NOTICES.md` lists it. Keep recordings mono, since one stereo clip makes the whole bundle stereo.

## Traps
- A stream plays through a media element, which can't be scheduled: a sequence of streams has a short gap between files, and a streamed loop's seam isn't exact.
- The wall count leaves out the block a point lies in, so a sound placed on a wall's face would carry through that wall unmuffled: a fan's wind sounds from just in front of it.
- Panning is stereo alone: a sound in front of the camera and one behind it sound alike.
