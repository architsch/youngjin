# Lighting

Reference: @src/client/graphics/light/lightBlockMap.ts , @src/client/graphics/light/lightBlockPropagationUtil.ts , @src/client/graphics/light/lightBlockSmoothingUtil.ts , @src/client/graphics/light/lightBlockMapMaterialUtil.ts , @src/client/graphics/shaders/lightBlockMapGLSL.ts , @src/client/object/components/lightSource.ts , @src/shared/room/util/roomPrefsUtil.ts , @src/shared/graphics/light/util/headLightPowerUtil.ts , @src/shared/graphics/light/util/lampLightUtil.ts , @src/client/system/util/roomLightingUtil.ts , @src/client/graphics/graphicsManager.ts

## Overview

A room is lit by three things, and only the first of them is a real light as the renderer understands the word:

- **The head lamp.** One `THREE.PointLight` parented to the camera, so it travels with whoever is looking. It is what makes a room nobody has furnished visible at all.
- **The room's own lamps.** Lights people install on its walls (see [The Lamp](#the-lamp)). These are *data*, not light objects — see below.
- **An ambient light**, which reaches every surface regardless of which way it faces and keeps the unlit side of a thing from being black.

Along with these the room has an **atmosphere**: what color each of the above burns, how strong the head lamp is, and what the air between the camera and the far wall is like. All of that belongs to the room and travels with it (see [The Room's Own Atmosphere](#the-rooms-own-atmosphere)).

## Why a lamp is not a light

The scene holds exactly one real light and always will, for two independent reasons:

- **The renderer compiles the number of lights into every shader.** Installing a second light is not a cheap operation that happens once — it changes a compile-time constant every material in the scene was built against, so every one of them is rebuilt, in the middle of the frame somebody put a lamp down in. A room where lamps can be added and taken away would spend its life recompiling.
- **A real point light shines through walls.** Nothing in the game casts shadows, and in a game whose whole subject is building enclosures out of blocks, a lamp that lights the far side of the wall it is mounted on looks more broken than the darkness it was meant to fix.

So a lamp is stored as a description of a light rather than as a light, and the light itself is delivered to the shaders as a **field sampled over the room's own grid of voxel blocks**. The cost of that is the same whether the room holds three lamps or three hundred — one texture fetch per fragment — and walls occlude light for nothing, because the field is built by a fill that stops at solid blocks.

The field carries a direction as well as an amount (see [Direction](#direction)), so a lamp produces a glint and not only a wash — which matters more than it sounds. A material whose whole read is its sheen, like the aged tin a character is made of, is mostly *specular*; give it diffuse alone and it arrives flat and dark beside a wall lit by the same lamp, because for the wall diffuse is very nearly all there is. That was tolerable while the head lamp was the only light in the game, and stopped being tolerable the moment a room could light itself and the head lamp learned to stand out of the way.

## The light block map

`LightBlockMap` owns the field. It holds every light in the room except the head lamp, and rebuilds the field whenever anything it depends on changes — a lamp installed, moved, re-lit or taken down, or the block work light travels through edited. A rebuild is asked for rather than performed: requests are collected and answered once a frame, so dragging a lamp along a wall costs one rebuild per frame rather than one per step.

### Propagation

Each lamp is flood-filled outward from the block it stands in, through the block work, one block to the next in the six axis directions. A step sideways and a step upward are different distances in the world, and are counted as such, so a lamp reads as a ball of light rather than as a tall column.

The fill answers two questions at once:

- **Which blocks the light reaches at all.** A block the fill never arrives at is behind a wall, and gets nothing. This is the whole of the occlusion, and it is why walls work: the fill cannot pass through a solid block, and the region outside the room is solid by definition.
- **How far round a corner each block is.** A block reached only by a long way round is dimmer than one the same straight-line distance away with nothing in between.

Brightness itself is not accumulated along the path. It is worked out at the end from the **straight-line** distance to the lamp, using the same falloff curve a real point light obeys, so a lamp is described in the same units the head lamp is. What the fill contributes is a penalty for the detour: the further the shortest open route runs past the straight line, the more the light is cut. Measuring distance along the fill instead would be measuring it in city blocks, and a lamp lit that way comes out diamond-shaped, with its gradient stepping between a handful of directions.

A lamp is also treated as a thing of some size rather than as a point, since a point light's falloff runs to infinity at nothing and the block a lamp stands in *is* at nothing. Without that, one block of the room takes a spike of light no exposure can accommodate, and everything else is left at the bottom of the range.

### Direction

Alongside how much light reaches a block, the map stores **which way that light is travelling**. A surface turned toward where the light came from is lit fully; one turned away keeps a share of it regardless of its facing.

That share is held well above zero on purpose. The propagation carries no bounce, so a wall facing away from the room's only lamp would be as black as one in a sealed box — where in a real room it is lit by everything the lamp is shining at.

### Smoothing

The field is smoothed before it is handed to the GPU, because the grid is coarse next to the falloff written across it. Interpolating between block centres gives a surface whose slope jumps at every block boundary, which the eye reads as facets rather than as a gradient.

The smoothing is **occlusion-aware**: a solid block is not a dark neighbour but no neighbour at all, left out of the average entirely. Treating it as dark would draw a band of shadow along the inside of every wall; letting light cross it would undo the occlusion the fill was built to provide.

### Sampling

Every lit material samples the field once per fragment, at a point pushed half a block out along the surface's own normal. Without that push, a one-block wall interpolates between the lit block on one side and the dark one on the other, and bleeds light onto its dark face.

**The reading is then renormalized by how much of what was filtered together was open room.** A solid block holds no light — the fill cannot enter one — so a sample taken anywhere but exactly at an open block's centre is pulled toward black by whatever wall the filter happened to reach. A wall's own face never notices, since the half-block push lands its sample on a block centre by construction; anything standing *in* the room lands between centres and would be darkened for no reason but where it happens to be. The field records openness alongside the light so that this can be divided back out.

The direction stored beside the light meets the fragment's own normal — the one the material's relief has already perturbed — so a lamp lying off to one side picks out the moulding on a door and the sheen on a piece of tin, rather than washing them flat.

## The room's own atmosphere

Everything about how a room is lit that is not a lamp is a room setting, stored on the room as a handful of characters and reaching every client along with it. `RoomPrefsUtil` owns what those characters mean; a room's owner edits them from the room-configuration form, and an admin edits a hub's.

| Setting | What it does |
|---|---|
| Ambient color and strength | What the light that reaches every surface is, and how much of it there is. Two dials rather than one, because they are separate wishes: a room lit warm and a room barely lit at all are not the same request, and a palette entry dark enough to express the second would be too dark to express the first. The bottom of the strength range is nothing at all — a room lit only by what is actually in it. |
| Head-lamp color | What the light every visitor carries is. |
| Head-lamp power | How much of it the room wants at all, from none to the whole of it. |
| Fog color | What the air is, and with it the emptiness past the room — the two are painted the same, because whatever has faded completely into the air is standing directly in front of that emptiness, and if the two disagree the horizon is a seam rather than a distance. |
| Fog start and end | Where things begin to fade into the air, and where they have faded into it completely. |

**A room that has never been configured is one that has said nothing**, and what it stores is nothing: every setting falls back to a documented default, and the defaults are chosen so that such a room looks exactly as rooms looked before any of this existed — white ambient, the head lamp at the full strength it has always had, and the fog pushed past everything the camera can draw. No room has to be brought up to date for this, and none ever will.

### How a light is described

Brightness, reach and falloff are one description of one light, and picked apart into three free dials they mostly describe lights that do not exist — a fierce one that stops dead a pace away, or a faint one that reaches the far wall undimmed. So neither the head lamp nor a lamp is given three.

**The head lamp is given one.** A single *power*, each step of which is one coherent lamp, running from off to what the head lamp has always been. There is nothing else to ask of it: it is a light that follows the player, so where it goes is not a question, and a room that lights itself wants it out of the way rather than reshaped.

**A lamp on a wall is given two**, and that is the difference worth stating:

- **Strength** — how much light there is, and nothing about where it goes. Its range runs from a small light up to far more than lighting a room takes, because the top of it exists for effect: a lamp that blows out the wall it is mounted on is a thing somebody will want, and it can only be had if the range reaches past the point where a room is merely lit. Past that point the room's own exposure clips, which is not a limit being exceeded but the effect itself. The steps are geometric rather than even, because brightness is judged in ratios — an even slider spends most of its travel on differences nobody can pick out.
- **Spread** — how far it carries and how sharply it falls off, which are one question rather than two: a light that reaches the far wall and one that stops a pace away differ in both at once, and a long reach with a steep falloff is a reach that does nothing.

One dial cannot express both. A wash that fills a room softly and a tight pool that picks one thing out of the dark sit at *opposite ends* of a single dial, so a dim spotlight or a broad glow is simply not askable for — which is why the lamp has two and the head lamp has one.

A lamp is furniture rather than a torch, so its bottom step is a small light and not a dark fitting: there is nothing on screen to tell an unconfigured lamp from a broken one.

### The head lamp stands down for the room

The head lamp is only ever **the light the room is not providing for itself**. Each frame, the field is sampled where the camera is standing, and the lamp gives back as much of its strength as the room is already supplying — and takes on the room's own color as far as it does.

Both halves matter. Turning it down is not enough on its own: what washes a warm wall out is not how much the head lamp adds but that what it adds is white, and even a little white light drags a saturated surface toward grey up close. Light of the room's own color deepens what is there instead of diluting it.

The handover runs on a curve that saturates rather than a ramp to some "fully lit" mark, because how much light stands in a place spans orders of magnitude between standing under a lamp and standing across the room from one. A ramp over that range is not a ramp at all — it is a switch, thrown within a step of every lamp — and what the player sees is his own lamp surging back on as he walks away from a light.

### Who wins when two people change it at once

A save is deliberately delayed a couple of seconds, so that dragging a slider is one write rather than fifty. For those seconds a client is holding a setting the server has not seen — and once the save does go, the server broadcasts it back, so an edit made *after* that save is racing an echo of the one before it.

The rule that settles it: **while an edit of this client's own is outstanding, lighting arriving from the server is ignored.** The local one is newer and already on its way, so it will win regardless; letting the older one land in the meantime only produces a flicker back to it — and, worse, leaves the form showing one setting while the room is lit in another. Two people editing one room therefore settles as last-writer-wins, which is what the room-configuration form already does with everything else it holds.

### Fog and the camera

Both the head lamp and the fog are sized from **how far off whatever the camera is looking at is**, and they are set together, because they are answering the same question: a camera pulled back to take in the whole room has to be able to see the whole room. A light sized for the eye goes out past its own range, leaving what is being looked at to the ambient light alone; fog sized for the eye closes over everything beyond a few paces, which is a room pulled back from and then buried. The fog is pushed out in proportion and never pulled in, since a camera closer than a standing player's reach is still a player standing in the room.

The fog itself exists from the moment the scene does and is never taken away. Turning it on and off flips the same kind of compile-time flag the light count is, and recompiles every material in the scene; "no fog" is therefore fog whose distances are past everything the camera draws, which is exactly what an unconfigured room asks for anyway.

## The Lamp

A lamp is a light somebody installed on a wall — the only thing besides the head lamp and the ambient that lights a room. It hangs like a picture does (see [wall_attached_object.md](../geometry/wall_attached_object.md)): it claims the patch of wall it is mounted on, nothing else can be hung over it, and taking that wall down takes the lamp with it.

It is currently **a placeholder, and an admin's alone**. What it looks like is a single lit rectangle, drawn in an unlit material so it shows at the full strength of its own color whatever is falling on it — which is what a source of light rather than a receiver of one looks like. It is not lit by the field, since a lamp lit by the light it is itself producing would brighten in its own glow.

That same unlit material is what the player's face is painted with (see [player_customization.md](../geometry/player_customization.md)): a face is a flat patch of color that is meant to stay flat and clean, which is the same thing an emitter is. Sharing it costs nothing and saves a draw call, since a mesh is drawn once per geometry-and-material pair.

Two things about it are worth stating because they are easy to get wrong:

- **Its color and its strength are one setting.** The lit face takes its color from the same value the light does, and the parts it is drawn from are *derived* from that value rather than authored beside it — so a lamp cannot glow one color and light the room another.
- **The light stands in the block in front of the wall**, not at the lamp's own origin. A wall attachment's origin sits on the wall face, and the fill returns immediately from a block that is solid, so a lamp whose light was placed at its origin would light nothing at all.

Because the lamp's body will eventually be several pieces rather than one, it is drawn through the general composition path from the start (see [instanced_mesh_composition.md](instanced_mesh_composition.md)) — giving it a body later is adding parts rather than rewriting how it is drawn.

## What a generated room comes with

**Room generation chooses a room's atmosphere explicitly, and what it chooses is the documented default** — plain white light, the head lamp at full, and no fog. It places no lamps.

That is a decision rather than an omission, and the reason is worth writing down, since a parameter no generator sets is normally one no room has ever actually held (see [room_generation.md](../geometry/room_generation.md)).

A room's lighting is a judgement about that particular room: which corners are meant to be dark, what the room is *for*, what has been built in it. Nothing a generator knows could stand in for that, because at the moment it runs there is nothing in the room to light — a hub is furnished afterwards by the people who use it, and a member's own room arrives as solid mass to be mined out. A generated atmosphere would therefore be a guess dressed as a decision, and one every owner would meet as something to undo.

Not placing lamps follows from the same thing, and is also what makes the head lamp impossible to simply delete: a room comes out of generation with no lamps in it at all, and a player who cannot see cannot install the first one.
