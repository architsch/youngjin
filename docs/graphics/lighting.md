# Lighting

Reference: @src/client/graphics/light/maps/lightBlockMap.ts , @src/client/graphics/light/util/lightBlockPropagationUtil.ts , @src/client/graphics/light/util/lightBlockSmoothingUtil.ts , @src/client/graphics/light/util/lightBlockMapMaterialUtil.ts , @src/client/graphics/shaders/lightBlockMapGLSL.ts , @src/client/object/components/lightSource.ts , @src/shared/room/util/roomPrefsUtil.ts , @src/shared/graphics/light/util/headLightUtil.ts , @src/shared/graphics/light/util/lampLightUtil.ts , @src/client/graphics/light/util/roomLightingUtil.ts , @src/client/graphics/util/atmosphereMaterialUtil.ts , @src/client/graphics/shaders/atmosphereGLSL.ts , @src/client/graphics/shaders/skyShader.ts , @src/client/graphics/graphicsManager.ts

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

**Where the fill stops is the same straight line, and not the length of the route travelled.** The two disagree because a route through the grid only ever runs along the axes: it is as long as the sides of the box between its ends rather than as the line across it, so stopping the fill by route length carries a lamp its full reach along each axis and cuts it noticeably short on every diagonal. The falloff has not faded to nothing at that shorter distance, so the light does not fade out there — it stops dead, on an edge shaped exactly like the diamond the paragraph above avoids. Bounding by the straight line instead lets the fill and the falloff give out in the same place, all the way round.

A lamp is also treated as a thing of some size rather than as a point, since a point light's falloff runs to infinity at nothing and the block a lamp stands in *is* at nothing. Without that, one block of the room takes a spike of light no exposure can accommodate, and everything else is left at the bottom of the range.

### Direction

Alongside how much light reaches a block, the map stores **which way that light is travelling**. A surface turned toward where the light came from is lit fully; one turned away keeps a share of it regardless of its facing.

That share is held well above zero on purpose. The propagation carries no bounce, so a wall facing away from the room's only lamp would be as black as one in a sealed box — where in a real room it is lit by everything the lamp is shining at.

A block holds one direction however many lamps met in it, so the direction is **weighted by how much light each of them actually brought**: where two lamps meet, the brighter one decides which way the light lies. Weighed by the geometry alone, a lamp carrying almost no light would swing the direction as hard as one blazing beside it, and everything around the two would be shaded as though lit from a side nothing was lighting it from.

### Nothing a light does can leave a room darker

Installing a light can only ever *add* light to a room, and the map is built so that this holds all the way to the screen rather than only in the amount it accumulates.

The amount is monotone for free, since the fill adds. The direction is the part that is not, because there is one of it per block: light arriving from two sides at once cancels while both lamps go on lighting the place, and a direction is all that survives of it. So the map records **how much of a block's light has a direction at all**, alongside the direction itself, and the facing test is charged only to that share. Light whose directions cancelled arrived from everywhere and reaches a surface whichever way it is turned — which is both what really happens and what keeps a second lamp from taking more away through the cosine than it brought in light. A highlight is the one thing that still needs the share in full, since light arriving from every side glints off nothing.

Where one lamp is doing the lighting the share is the whole of it, and this is exactly the shading a single lamp always gave.

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
| Ambient color and strength | What the light that reaches every surface is, and how much of it there is. Two dials rather than one, because they are separate wishes: a room lit warm and a room barely lit at all are not the same request, and a palette entry dark enough to express the second would be too dark to express the first. The bottom of the strength range is nothing at all — a room lit only by what is actually in it — and the top is far past lighting a room at all (see [How far the two lights reach](#how-far-the-two-lights-reach)). |
| Head-lamp color | What the light every visitor carries is. |
| Head-lamp power and range | How much of the head lamp the room wants at all — from none, through the ordinary lamp, and well past it — and separately how far it carries and how sharply it fades on the way. Two dials rather than one, for the reason a lamp on the wall has two (see [Two dials, not one or three](#two-dials-not-one-or-three)). |
| Fog color | What the air in the room is. It is laid over the sky past the room as well, by as much of the room's air as stands in front of it (see [The air, and the sky past it](#the-air-and-the-sky-past-it)). |
| Fog start and end | Where things begin to fade into the air, and where they have faded into it completely. The start may be nothing at all, and the two are held apart by only as much as it takes to keep the fade defined — so air thick enough to lose the far wall of a room in is a setting, not something the range refuses. The start is never further off than the end: dragging either past the other carries the other along with it. |
| Smoke strength, scale, speed, drift and rise | How unevenly thick the room's own air is (see [The smoke in the room's own air](#the-smoke-in-the-rooms-own-air)). Where the smoke gathers the fog thins and the room shows through, so strength is how far it clears — at nothing the air is an even wash again. Speed runs from air that hangs still to smoke tearing through the room. Drift and rise are which way it travels, from dry ice pouring across a floor to smoke coming off something. |
| Sky color | What the emptiness past the room is painted, between the clouds and above the land. Its own color rather than the fog's, so a room can have a pale sky past a dark haze or a black void past a lit mist — and picked from the same set of airs the fog is, since the sky is air too (see [Where the sky's colors come from](#where-the-skys-colors-come-from)). |
| Cloud color, strength, scale, softness and speed | How the *sky past the room* is broken up: what color the drifting cloud masses are, how far toward it they reach, how fine they are, how sharp their edges run, and how fast they cross the sky. Separate wishes rather than one "weather" setting — a sky of a few great banks and a sky of mottled fleece differ in scale alone, and either can be cut-edged or hazy, faint or full, still or racing. |
| Ground color, peak color, opacity, scale and softness | The country the room stands over, seen below the horizon (see [The ground under it](#the-ground-under-it)). Low land takes the first color and high land the second, so how mountainous it reads is how far apart the two were picked, and softness is how sharply they meet. Opacity is how long the land takes to surrender its color to the air; scale is how coarse the country runs. |

**A room that has never been configured is one that has said nothing**, and what it stores is nothing: every setting falls back to a documented default, and the defaults are chosen so that such a room looks exactly as rooms looked before any of this existed — white ambient, the head lamp at the full strength it has always had, and the fog pushed past everything the camera can draw. No room has to be brought up to date for this, and none ever will.

### How a light is described

Brightness, reach and falloff are one description of one light, and picked apart into three free dials they mostly describe lights that do not exist — a fierce one that stops dead a pace away, or a faint one that reaches the far wall undimmed. So neither the head lamp nor a lamp is given three.

**The head lamp is given one.** A single *power*, each step of which is one coherent lamp, running from off to what the head lamp has always been. There is nothing else to ask of it: it is a light that follows the player, so where it goes is not a question, and a room that lights itself wants it out of the way rather than reshaped.

**A lamp on a wall is given two**, and that is the difference worth stating:

- **Intensity** — how much light there is, and nothing about where it goes. Its range runs from a small light up to far more than lighting a room takes, because the top of it exists for effect: a lamp that blows out the wall it is mounted on is a thing somebody will want, and it can only be had if the range reaches past the point where a room is merely lit. Past that point the room's own exposure clips, which is not a limit being exceeded but the effect itself.
- **Range** — how far it carries and how sharply it falls off, which are one question rather than two: a light that reaches the far wall and one that stops a pace away differ in both at once, and a long reach with a steep falloff is a reach that does nothing. So the falloff is not a dial of its own; it is read off the reach, running the other way.

One dial cannot express both. A wash that fills a room softly and a tight pool that picks one thing out of the dark sit at *opposite ends* of a single dial, so a dim spotlight or a broad glow is simply not askable for — which is why the lamp has two and the head lamp has one.

**Both of the lamp's dials are a short run of whole values, and each value is the quantity itself** — a lamp at twice the intensity gives twice the light, and a reach is a number of blocks. That is what lets the number be shown beside the handle and typed back into it, where a position on a scale of a hundred is a number only the code understands; and a run short enough to be marked out on the track puts what a lamp can be into the control itself, rather than leaving it to be discovered by dragging. The room's own settings keep the fine scale they have, since none of them is a quantity a person would name.

A lamp is furniture rather than a torch, so its bottom step is a small light and not a dark fitting: there is nothing on screen to tell an unconfigured lamp from a broken one.

### Where a light's colors come from

The three things this page describes — a lamp, a room's ambient, the light a visitor carries — are all colored from one palette of their own, and **nothing in it is a dimmed version of anything else**. Every entry sits at the top of the brightness range: a hue and a strength of tint, and never a degree of darkness.

That follows from each of them already having a strength beside its color. A darker entry would be that dial spelled a second time and spelled worse — it cannot reach nothing, which the dial can, and a fitting painted dark cannot be told from one somebody turned down. It is also not a thing the room could honour: light is only ever added to what is already there, so the darkest entry such a set could hold would still darken nothing (see [Nothing a light does can leave a room darker](#nothing-a-light-does-can-leave-a-room-darker)). What it would produce is a lamp that fails to light, which reads as broken.

The set is far longer than the palettes things are *painted* from, and it deliberately holds colors that are hard to tell apart as swatches. That is the opposite of the rule elsewhere, and the reason is what is being chosen: a finish is picked by looking at the swatch, so two similar swatches are one wasted choice — while a light is judged by what a whole room looks like under it, where the step between two neighbouring temperatures is the difference between afternoon and evening. It runs as the plain white every unconfigured room is lit by, then the temperatures warm to cool, then the hue wheel at several strengths of tint. Most of the temperatures are warm, because a room lit by lamps is lit warm.

### Two dials, not one or three

A point light takes brightness, reach and falloff. Both the head lamp and a lamp on the wall are described by **two** settings rather than by one or by three, and both ends of that are deliberate.

**Three would be wrong.** Reach and falloff are one question: a light that reaches the far wall and one that stops dead a pace away differ in both at once, and a lamp given a long reach with a steep falloff is a lamp whose range does nothing. Offered as free dials they mostly describe lamps that do not exist.

**One would be wrong too.** Fused into a single "power", a dim lamp is always a small one and a bright lamp always a far-reaching one — so a soft wash filling a room and a fierce pool a pace across sit at opposite ends of the same dial, and neither of the two crossings between them can be asked for at all. A dim wide lamp and a fierce tight one are both ordinary things to want.

So each light has a **strength** and a **range** — the head lamp's *power*, a lamp's *intensity* — and the range carries reach and falloff together, running them opposite ways.

### How far the two lights reach

Both the ambient and the head lamp run well past what it takes to see by, because being lit is not the only thing a room might want its light for: a room can be *overexposed* deliberately, and that is an effect neither dial could reach while its top was the ordinary room.

Two things follow from opening the top, and both are the reason it did not simply happen by raising a number.

**Each dial is on a cubic rather than a straight ramp.** The range now covers two quite different jobs. The ordinary business of lighting a room happens in the first sliver of it — the difference between a room lit for atmosphere and one lit for reading is a few hundredths — while the top is an overexposure running to a white-out. A straight ramp would spend nine steps in ten on the second and leave the first almost no travel. Cubing gives the ordinary range about half the slider and the effect the other half, and it still reaches nothing at the bottom, which a geometric ramp could not.

**The lamp an unconfigured room gets did not move, but the steps naming it did.** The head lamp's ordinary strength used to sit at the very top of its range, which is the same thing as saying there was nothing above it; both its dials now sit two thirds of the way up. What has to stay fixed is the lamp, not the numbers that name it — so the default steps moved with it and every room that has said nothing is lit exactly as it was.

Pushed to the top, the ambient stops lighting a room and starts erasing it: light arriving from every direction at once flattens the shading that makes shapes readable, and takes each surface to white in turn. That is what the end of the range is for, and a room that wants to be *brighter* rather than blown out should be reaching for its lamps instead.

### The head lamp stands down for the room

The head lamp is only ever **the light the room is not providing for itself**. Each frame, the field is sampled where the camera is standing, and the lamp gives back as much of its strength as the room is already supplying — and takes on the room's own color as far as it does.

Both halves matter. Turning it down is not enough on its own: what washes a warm wall out is not how much the head lamp adds but that what it adds is white, and even a little white light drags a saturated surface toward grey up close. Light of the room's own color deepens what is there instead of diluting it.

The handover runs on a curve that saturates rather than a ramp to some "fully lit" mark, because how much light stands in a place spans orders of magnitude between standing under a lamp and standing across the room from one. A ramp over that range is not a ramp at all — it is a switch, thrown within a step of every lamp — and what the player sees is his own lamp surging back on as he walks away from a light.

### Who wins when two people change it at once

A save is deliberately delayed a couple of seconds, so that dragging a slider is one write rather than fifty. For those seconds a client is holding a setting the server has not seen — and once the save does go, the server broadcasts it back, so an edit made *after* that save is racing an echo of the one before it.

The rule that settles it: **while an edit of this client's own is outstanding, lighting arriving from the server is ignored.** The local one is newer and already on its way, so it will win regardless; letting the older one land in the meantime only produces a flicker back to it — and, worse, leaves the form showing one setting while the room is lit in another. Two people editing one room therefore settles as last-writer-wins, which is what the room-configuration form already does with everything else it holds.

### The air, and the sky past it

The air inside a room and the sky past it are **two fields, not one**, and which coordinate each is read on is the whole of the difference between them. The sky's is read on the *direction* a pixel is being looked at. The fog's is read on the *world position* the pixel actually stands at. Everything else about how the two behave follows from that.

The choice is forced, because a direction and a place are what the two things genuinely are:

- **The sky has no positions in it.** It is at infinity, so the only thing that can vary across it is which way the viewer is facing. A field read off a direction is exactly right: the weather stays put overhead as the player walks, and looks the same from a pace outside the wall as from the far end of the world.
- **The room's air does have positions in it, and the player is standing inside them.** Read off a direction, a thickening of the air would be painted on the inside of a dome — sliding across the walls as the player turns their head, and subtending the same angle whatever it landed on. That reads as weather when it is a mile off and as a stain on the wall when it is two paces away. Read off the world position, a thickening of the air is *somewhere*: the player walks around it, it passes between them and the far wall, and it holds still when they turn.

**They still meet without a seam, because the fog is laid over the sky as well.** Whatever has faded completely into the fog is standing directly in front of the sky, so if the two disagreed there, the room's edge would show as a seam rather than as a distance. They cannot agree by being one field — a fully fogged wall matching a cloudy sky *means* cloud shapes crawling on that wall, which is the thing the volumetric field exists to stop — and they do not agree by being one color, since the sky has a color of its own. They agree because the sky is fogged the way a surface standing at the room's edge is: by the room's own air, over the stretch of it between the camera and where the line of sight leaves the room, and thinned by whatever smoke stands at that point. A window in a boundary wall, seen from across a fogged room, shows the same fog in its aperture as on the wall around it; seen from a pace away it shows the sky; and in between, the fog runs on through the aperture instead of stopping at it.

That stretch is measured only as far as the room's four walls: the sky is at infinity, so the only part of the room's air in front of it is the part inside the room. It is measured as depth into the view — the way every surface's fog is measured — rather than as a straight line, so that the sky and the wall beside it agree toward the edges of the screen as well as at its centre. And it is never taken past the camera's far plane, where the sky is actually drawn: a line of sight running nearly straight up meets no wall for a very long way, and a room that has asked for no fog says so with fog distances beyond that plane, so a sky allowed to be further off would be fogged in a room that asked for none.

The fog over the sky is a stage of the sky's own shader rather than a second pass over the screen, which is also how every surface in the room is fogged: last, in the same program, in the same space, from the same fog. It is worked out before the sky is painted, though, so that a sky the fog has closed over completely is never painted at all.

A **skybox** would have been the other way to do the sky, and it is still the wrong one. It is a large image to send over the network for something a room barely looks at, and — being geometry at infinity rather than a property of the air — it could not carry the room's own color at all.

The sky is painted as a quad covering the screen. There is no dome or box to be inside of, nothing to keep centred on the viewer, and no far plane to fall outside of.

It is drawn **last among the opaque surfaces rather than first**, which is the opposite of what a background wants to be and is worth stating. The sky covers the whole screen and reads the shared noise field several times over — for the air, and again for the land — which makes it among the more expensive surfaces per pixel in the frame (see [materials_and_shaders.md](materials_and_shaders.md)). Drawn first it is shaded in full and then painted over by every wall in the room, which is most of the screen thrown away; drawn last, sitting at the far plane and tested against the depth buffer, it is discarded before its shader runs anywhere a surface already stands. It still writes nothing back to the depth buffer, having nothing to be in front of.

**A room that has not chosen a sky has it painted in its own air's color**, so one that has chosen nothing at all has black air, a black sky and no clouds in it. The ground below the horizon is the one part of the sky that is not silent by default, and the section below says why.

#### The smoke in the room's own air

Fog set to one distance is an even wash: every surface the same distance off fades by the same amount, and the air reads as a filter laid over the picture rather than as something the room is full of. The smoke is what breaks that up.

It is a three-dimensional field standing in the room, read at the point each fragment occupies — so a thickening of the air occupies a region rather than a patch of screen. Two surfaces meeting in a corner agree about the air in front of them, because they are asking about the same place. The sky asks too: the fog laid over it is thinned by whatever smoke stands where the line of sight leaves the room, which is the same place the wall around a window in that boundary is asking about.

**What it changes is how much fog there is, not what color it is.** This is the other half of what separates it from the clouds. A cloud is a thing standing in the air and is painted its own color; smoke is the air itself being unevenly thick, and what unevenly thick air does is let more or less of what is behind it through. So the smoke scales back the coverage the distance asked for, and the color mixed toward is the room's own fog color with nothing done to it. Where the smoke lies thickest the room shows through; where it is absent the fog closes as it always did.

It is also deliberately **softer than the clouds are**, and that is an absence rather than a setting. The clouds cut their field at a level to give every mass an edge, because a cloud is only legible as a shape. Air is not a shape — the player is standing inside it — and an edge in it reads as a crease drawn across the room. So there is no cut at all, only a slow lean from thick air to thin.

The room chooses five things about it. **Strength** is how far the air thins where the smoke lies heaviest, and it is the only one that can turn the smoke off — at nothing the air is even again. **Scale** is how fine it runs, from one slow swell filling the room to drifting wisps. **Speed** is how fast it moves through the room, measured in world distance rather than through the field, so that asking for finer smoke does not also appear to speed it up; its bottom is air that hangs still and its top is smoke tearing through the room faster than the eye can follow any one wisp of it, on the same curve the clouds' speed runs on (see [What the room chooses about it](#what-the-room-chooses-about-it)). **Drift** and **Rise** are which way it goes — a bearing and how steeply it climbs or settles, which are two steps because a direction in three dimensions cannot be one, and which are the difference between smoke coming off something and dry ice pouring across a floor.

A field that only travelled would not move so much as scroll: however slowly it was set, nothing about it would be changing, and the eye reads that rigidity at once. So the field doing the shearing travels slower than the smoke it shears, which leaves the two sliding against each other and every mass stretching and folding as it goes — for no extra samples at all.

#### Where the sky's colors come from

The sky itself is picked from the same set of airs the fog is, since it is air too — the air at infinity, looked at rather than through. The clouds and the land are picked from a palette of their own rather than from that one, and the two sets are answerable to different things.

Fog is what a room's own colors are *replaced by* as they recede, so its set is dark before it is anything else and gives up saturation as it brightens — a pale, vivid air is a room that goes to a colored white-out a few paces off. Cloud and land are the opposite case: they are masses seen *against* that air, at a distance, and what they need in order to read at all is to differ from it. Drawn from the fog's set they could only ever be a paler or darker version of the air itself, which is most of the way back to having no clouds and no ground.

So they share one set that runs the full brightness range — white included, since that is the ordinary color of both a cloud and a snowline, and the fog's set never reaches it — with saturation peaking in the middle of that range rather than running flat, because that is where color space has room for it. One set for both, unlike every other palette in the game, because for once the two really are the same question: a distant mass seen against the air wants the same gamut whether it is vapour or rock.

#### What makes a cloud read as a cloud

A fractal field sampled straight gives an even mottle, not weather, and two things turn it into shapes:

- **The coordinate is dragged aside by a sample of the field itself.** This shears every mass along its own gradient, which is what produces the piled edge of a cumulus and the drag and curl of smoke. Without it every mass is the same rounded blob, because nothing has pushed one side of it past the other.
- **The field is cut at a level.** A cloud is legible because it has an *edge* — a region that is definitely cloud, a region that is definitely not, and a transition between. A fractal field has no edge anywhere; it is haze everywhere, which is why it reads as a wash however strongly it is colored.

How wide that boundary runs is the room's to choose (see below), and the *level* it is centred on is not. The two are not independent: the field is symmetric about its own middle, so moving the level is mostly a way of asking for more or less of the sky covered — a further question, and one nobody has needed yet. The width is held open to at least what the field changes by across one pixel, so an edge finer than the screen can resolve fades instead of crawling; that floor is the shader's, not a setting.

#### What the room chooses about it

**A cloud color, and not a strength alone.** The clouds are painted in their own color and the sky between them in the sky's, so how strongly the weather reads is how far apart the two were picked. A room wanting none turns the strength to nothing, which is where an unconfigured room already has it.

A strength could only ever have been a *degree of the sky's own color*, and a cloud that is a lighter or darker shade of the air it hangs in is barely a cloud. Against the dark air a room lit for atmosphere actually asks for, it is nothing at all however far the dial is pushed. That is felt worst exactly where the sky matters most — the emptiness past the room, where there is no surface to give the eye anything else to read.

**A strength beside it, all the same.** Where the color says *what* the clouds are, this says how far toward it they actually get — which is the difference between weather and a tint, and the way two colors picked far apart are brought back within sight of each other without either being repicked. It is not the old dial returning: that one could only brighten and darken the air itself, where this scales a blend toward a color chosen independently of it.

The rest are each on the curve their own quantity is judged on, rather than on a shared one:

- **Scale** runs geometrically, for the reason a lamp's brightness does — it is judged in ratios, and a linear slider would spend most of its travel between degrees of fleece nobody can tell apart. It never reaches zero and should not: a field of no frequency is a flat sky, which is what picking the cloud color the air already is says, and says better.
- **Softness** runs geometrically too, and for the same reason: the edge that reads as cut and the edge that reads as merely soft are a couple of hundredths apart, while the difference between wide and wider is barely a difference at all. Its top is wide enough to swallow the field whole, which is the even haze it was before it was cut — not a cloud with a very soft edge but no cloud at all, which is the right far end for the dial to reach.
- **Speed** runs on a geometric ramp pulled down to reach zero. Its range runs from still air to a sky racing overhead, and the two ends want different things: the bottom has to arrive at nothing, since still air is a real request and a geometric ramp alone never gets there, while everywhere above the slowest steps fast and faster are told apart by ratio, as a scale is. So the ramp climbs by a steady factor over most of the dial and is offset by its own starting value, so that its first step is nothing; near that bottom it runs almost straight, which keeps the slow end — where the difference between imperceptible and gentle lives — finely divided.

Speed is an **angular** rate — how fast the clouds cross the sky — and not a rate through the noise field. That distinction is what makes it and Scale independent: measured through the field, asking for finer clouds would also appear to slow them, since a finer mass subtends a smaller angle while still taking as long to travel its own width. The two dials would then be two ways of asking overlapping questions.

How far the clouds and the smoke have travelled is kept as a **running total**, not worked out from the clock and the speed. Worked out from the clock, every change of speed would move them at once to wherever the new speed would have had them by now — the whole field lurching somewhere else on every step of a dragged slider — where a total only changes how fast they go from then on. The total is wrapped at the distance over which the noise field comes back exactly onto itself, so the wrap cannot be seen; left to grow, it would soon be a coordinate the GPU could no longer place finely, and the field would band and then block.

All of them reach the shaders as **uniforms** rather than as constants baked into the source. A constant is part of the shader, so a slider drag would rebuild and recompile every material in the scene on every frame of it — the same trap the fog's own on/off flag sets, and avoided the same way.

### The ground under it

Below the horizon there is land: the country the room stands over, which without it is the same empty air as everything above it.

**Only the sky draws it.** This is the one part of the atmosphere the fog does *not* share, and deliberately — the fog is the air in and around the room, and a far wall fading into a hillside would be wrong. There is still no seam, for the same reason there is none between the fog and the sky, arrived at differently: the land fades into the air with distance, and a ray approaching level meets the land further and further away, so by the time it is level the land is infinitely far off and has become the air exactly. The two sides of the horizon meet in one color without either being told about the other.

**The clouds stop at it.** Cloud belongs over the land, not on it: the clouds are painted on a dome of directions, so below the horizon that dome is beneath the viewer, and cloud drawn there is cloud underneath the ground — which reads as a stain on the landscape rather than as weather above it. It is what a downward ray actually meets, too, since a ray that goes down never climbs to a cloud layer.

They fade out over a band rather than stopping at the line, and the band is the point. In the world the cut is abrupt — that is what a horizon *is* — but the world also has land visible right up to it, where here the land has hazed away to air a little short of it. Stopping the cloud dead would draw a hard line across open air, so instead it fades over roughly the band the land fades in over, and the two cross. This is also the cheaper arrangement: below the horizon the sky was paying for both fields at once, and now it pays for one.

**It is drawn on a plane under the eye, not on the dome the clouds are on.** That is the whole of why it reads as ground. A plane seen from above it runs away from the viewer, so its features stretch and crowd toward the horizon as real land does; anything painted on the dome would keep the same apparent size all the way down and read as a wall.

What gives it the shape of country rather than of hills is a second field laid over the first. A fractal field alone makes rounded swells — which is what erosion is not. Folding the field about its own middle turns the contour halfway up it into a crest, and a contour of a fractal field is a long winding line that branches and rejoins, so what comes out is ridges with valleys running out of them. The same two samples that give the clouds their billow give the land something that reads as carved.

The room chooses **two colors, a coarseness, an opacity and a softness**. Low land takes the first and high land the second, so how far apart they are picked is how mountainous the country reads — a step apart is moorland; a dark green against a pale grey is a snowline. The coarseness is on a geometric curve for the reason the clouds' scale is, and never reaches zero for the same reason: land of no frequency is a flat plain, which is what picking one color for both says and says better.

**Opacity is how long the land takes to surrender its color to the air.** The land hazes into the sky with distance as land does, and left to the haze alone its own color is mostly overwhelmed — a suggestion of a country rather than a country. Raising this divides the rate it is lost at, so the color holds much further out.

What it deliberately cannot do is make the land opaque *at* the horizon, and that limit is the whole reason it divides the rate rather than lifting the land off zero. Land arriving at the horizon still colored would meet the sky in a color the sky is not, and draw the seam this entire arrangement exists to avoid. Dividing the rate leaves it still arriving at nothing exactly there, having simply taken longer to go.

**Softness is how wide the slope between the two colors runs** — a drawn coastline or snowline at one end, two colors that never quite separate at the other. Only the width is the room's: the *level* the land is split at is fixed, for the reason the clouds' cut level is, since moving it is really a way of asking how much of the country is upland rather than how sharply the two meet.

The distance the land stays visible to is **not** a setting. It is fixed by the same constant that decides how far below the horizon the fade runs, so a room asking for coarser country gets bigger hills and nothing else. It also has a second job: land compressed toward the horizon is a field sampled faster than the screen can carry, which crawls and sparkles, and it has faded out before it ever gets that fine.

Unlike the weather, **the land is on by default** — quietly, as two dark neutrals near the bottom of the scenery palette. It is the one setting in this whole section whose default is not "as things were", because its absence is not neutral: a sky with no clouds is a clear sky, but a sky with no ground is a room hanging in a void, which is a stronger statement than any weather and not one an unconfigured room should be making. Dark neutrals are also the one choice that reads correctly against every air a room might pick, since ground darker than the sky above it is what a horizon is. A room that does want the void drops the opacity to nothing.

### Fog and the camera

Both the head lamp and the fog are sized from **how far off whatever the camera is looking at is**, and they are set together, because they are answering the same question: a camera pulled back to take in the whole room has to be able to see the whole room. A light sized for the eye goes out past its own range, leaving what is being looked at to the ambient light alone; fog sized for the eye closes over everything beyond a few paces, which is a room pulled back from and then buried. The fog is pushed out in proportion and never pulled in, since a camera closer than a standing player's reach is still a player standing in the room.

The fog itself exists from the moment the scene does and is never taken away. Turning it on and off flips the same kind of compile-time flag the light count is, and recompiles every material in the scene; "no fog" is therefore fog whose distances are past everything the camera draws, which is exactly what an unconfigured room asks for anyway. The sky is likewise always drawn, whatever the fog is doing — it is the emptiness past the room and not a consequence of the haze in front of it. The fog laid over it is the same fog, pushed out by the same amount.

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

The cloud settings are the one part of this with no "as it always was" to fall back on, since nothing like them existed before. Their **strength** is written at nothing, which is a sky with no weather in it — so a generated room shows none, and neither does any room that has never been configured. Everything else about them is written at the values the sky was tuned at, and their color at plain white, so that a room which does turn the strength up meets a cloud rather than a stain, and a sky already worth looking at rather than four more sliders to go and find.

The **smoke** is written on rather than off, and it costs nothing to do so: a generated room's fog is pushed past everything the camera draws, so there is no haze for the smoke to be uneven in. What it buys is that the first owner to pull their fog in finds air that already moves, instead of a flat wash and five more sliders to go and find.

The **sky** is written black, the same as the air it is seen through — which is also what a room that carries no sky color at all is given, since such a room takes its air's color for its sky. That is the choice that says nothing, like the rest of what generation writes here: a black void above a quiet horizon. What a room's sky should be is as much a judgement about that particular room as its light is.

Because every setting is written out in full, the steps a generated room's clouds and smoke move at are held by every room generated so far, which makes the speed each one names the one point on its curve that can never move. The top of each speed's range is therefore derived from that point and the shape of the curve, rather than chosen.

The **ground** is the exception, and the only setting generation writes as something visible in the room as generated: two near-blacks, giving every generated room a quiet horizon under its sky. What separates it from the clouds is that its absence is not neutral — no weather is a clear sky, but no ground is a room hanging in a void, and choosing that for a room is as much a decision as choosing land would be. Between the two, land is both the commoner wish and the easier one to undo, and near-black land is the one choice that stays right whatever air the room is later given.

That is a decision rather than an omission, and the reason is worth writing down, since a parameter no generator sets is normally one no room has ever actually held (see [room_generation.md](../geometry/room_generation.md)).

A room's lighting is a judgement about that particular room: which corners are meant to be dark, what the room is *for*, what has been built in it. Nothing a generator knows could stand in for that, because at the moment it runs there is nothing in the room to light — a hub is furnished afterwards by the people who use it, and a member's own room arrives as solid mass to be mined out. A generated atmosphere would therefore be a guess dressed as a decision, and one every owner would meet as something to undo.

Not placing lamps follows from the same thing, and is also what makes the head lamp impossible to simply delete: a room comes out of generation with no lamps in it at all, and a player who cannot see cannot install the first one.
