# Materials and Shaders

Reference: @src/client/graphics/maps/materialConstructorMap.ts , @src/client/graphics/factories/materialFactory.ts , @src/client/graphics/util/shaderPrecompileUtil.ts , @src/client/graphics/graphicsManager.ts

## Where a material's appearance lives

Almost nothing in the game is textured. A door is not a picture of a door — it is a panel of timber with a moulding shaded into it, worked out per fragment; a player's body is aged tin, worn along the edges a toy would have been handled by. Those surfaces are shader code, and they are the bulk of what makes the game look the way it does.

They are kept apart from the materials that wear them. **One module per surface**, under `/src/client/graphics/shaders`, each holding that surface's GLSL and the splices that graft it into three.js's own shader source. `MaterialConstructorMap` then says only which `THREE.Material` a given material type is built out of and which shader is installed on it, so adding a new surface is adding a file rather than growing the map.

Two properties of a material are decided in the map and nowhere else, because they are decisions about the material rather than about how it is drawn:

- **Whether the room's own lamps reach it** (see [lighting.md](lighting.md)). A lamp's own lit face does not: a light lit by the field it is filling would brighten in its own glow.
- **Whether it stands in the room's air.** Everything that is part of the room fades into the same drifting haze, which is laid over the sky past the room too; the gizmos do not, being drawn over the world rather than in it.

Both are applied by wrapping, so a material gains them without knowing about them, and a reader can see at a glance which materials have which.

### Grafting onto three.js rather than replacing it

Every one of these surfaces is a stock three.js material with code spliced into it at named points, rather than a shader written from scratch. That is what keeps them lit by the same lights, fogged by the same fog, tone-mapped and color-converted by the same code as everything else in the scene — which matters most for the things that have to *match*, like the fog on a wall at the room's edge and the fog laid over the sky beside it.

The splices name three.js's own chunks, so they are written against a specific arrangement of its shader source and are commented with why each point was chosen. The one thing to know when moving one is that every stock chunk is inlined into a single `main()`, so anything declared by an earlier splice is still in scope for a later one.

Because this all happens on compilation, three.js's own program cache cannot see any of it: as far as its cache key is concerned the tin, the wood and the flat instanced color are all "a lit material with no texture", and whichever was drawn first would lend its shader to the others. **Every cached material is therefore given a cache key of its own**, which is the same id the material factory caches it under — one id, one material, one shader.

### The noise field the surfaces share

The grain in the timber, the corrosion on the tin, the clouds, the land below the horizon and the unevenness of the room's air are all read from **one value-noise field**. They differ only in what they read it on — a point on a board, a direction on the dome, a place in the room — and in what they do with the answer.

That field is **baked into a 3D texture once at load and read back, rather than worked out in the shader**. Worked out, a single sample is a run of hashing and interpolation, and the places that want it want it several times over: the room's air drags its own coordinate sideways by the field before reading a stack of octaves at the result. That work stands in every material in the room, which on a mid-range phone comes to more per fragment than the lighting and the finishes together. Read from a texture it is one filtered fetch, done by hardware the arithmetic is not competing for.

The texture repeats, and carries several independent fields at once so that the ones read together as a direction cost a single fetch rather than one each. Neither the repetition nor the seam shows: at the coarseness a room asks for by default a whole room is a fraction of one period across, the octaves are read at ratios sharing no common multiple so the sum never lines up with itself, and the field is continuous where it wraps. `ValueNoiseTextureUtil` owns it, and hands it to every shader that reads it as that shader compiles.

## Compiling early

Turning shader source into something a GPU will run is slow, and it happens the first time a material is drawn — which is to say, in the middle of play: the frame a door is first opened in, the frame another player first walks into the room. So it is done up front instead, behind the room-loading screen, where a pause is a pause in something that is already waiting.

Two passes, because they answer different questions:

- **Everything standing in the room as loaded.** Three.js will compile a whole scene on request, and that covers the room's block work and everything spawned in it.
- **Everything that has not been needed yet but can be at any moment** — a material no object in *this* room happens to use. Those get a stand-in mesh apiece, compiled against the real scene so that what comes out is the same program the real object will ask for rather than a near miss.

### Why the shaders cannot simply ship compiled

Shipping ready-made programs in the bundle is the obvious thing to reach for, and it is worth writing down why it is not available — because two quite different stages hide behind the word *compile*:

1. **Building the source.** Splicing the surfaces in, resolving three.js's own includes, and putting a block of `#define`s in front of the result. This is string work, and it costs microseconds.
2. **Turning that source into something the GPU runs.** This is the graphics driver's job, and it is essentially the whole of the cost.

**The second cannot leave the browser at all.** WebGL exposes no way to hand a driver a program binary — the equivalent in native OpenGL ES was deliberately left out, since such a binary is specific to one GPU model *and* one driver revision, so there is no portable thing a build step could compile *to*. (A shader-text API is likewise all that succeeding graphics APIs on the web offer.) There is no file to put in the bundle and no call that would accept one.

**Moving the first to build time is possible and pointless.** What the driver is finally handed depends on state that only exists at runtime — how many lights the scene holds, whether it is fogged, whether the object drawing it is instanced and carries an instance color — so only the half in front of all that could be baked, and that half is the microseconds.

What *is* bought back beyond compiling early is the second visit. Browsers keep their own on-disk cache of compiled programs, keyed by the shader source they came from — so a returning player compiles nothing, provided that source is byte-identical from one load to the next. It is, and deliberately: every surface's GLSL is assembled once when its module is first evaluated, out of constants, and nothing about it varies with the room, the machine or the moment.

So "precompiled" here means *compiled early*, never *compiled elsewhere* — and compiling early is worth the trouble regardless, because the cost it avoids is not a slower load but a frozen frame in the middle of play.

The lever that remains, if this ever stops being enough, is to compile **fewer programs** rather than to compile them sooner: the instanced materials each carry a full lit shader of their own, and could be merged into one that branches per instance. That trades a real cost on every fragment against a one-time cost per session, so it is a change to make against a measurement rather than on principle.
