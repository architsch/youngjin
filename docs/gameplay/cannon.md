# Cannons

Reference: @src/shared/object/types/objectTypeConfig/cannonObjectTypeConfig.ts , @src/shared/object/types/objectTypeConfig/cannonBallObjectTypeConfig.ts , @src/server/object/util/cannonUtil.ts , @src/server/object/util/cannonBallUtil.ts , @src/shared/object/util/cannonStateUtil.ts , @src/shared/object/util/cannonBallStateUtil.ts , @src/shared/object/util/cannonAimUtil.ts , @src/shared/object/util/cannonBallMotionUtil.ts , @src/shared/object/util/cannonBlastUtil.ts , @src/shared/physics/util/physicsSphereUtil.ts , @src/shared/object/util/objectObstacleUtil.ts , @src/shared/graphics/mesh/composition/util/cannonCompositionUtil.ts , @src/client/object/types/gameObject/cannonGameObject.ts , @src/client/object/types/gameObject/cannonBallGameObject.ts , @src/client/object/util/cannonBlastThrowUtil.ts , @src/client/ui/components/hud/selection/cannonEditOptions.tsx

An object anyone buys and sets down, which the server then plays: it fires balls at whoever is near, until it has none left and is gone.

## The cannon
- **Placed** as an attached object standing out of a floor or a wall, never a ceiling, in a cube of its own (see [object_attachment.md](../geometry/object_attachment.md)). It is the one object as solid as a block (see [physics.md](../geometry/physics.md)).
- **Bought each time**: its type has a price, which the server takes as it accepts the add (see [inventory.md](inventory.md)). Nothing comes back for one removed. Single-player rooms have none, nothing there playing one.
- **Anyone's** to switch off and on, move or remove, subject to restricted zones.
- **One metadata key** (`CannonState`) holds all of it, in two parts: the switch, which is a user's, and the rest (where in its round it is, the balls left, its aim, the time left), which is the server's. `CannonStateUtil` merges a value into the stored one by the part it carries, so neither overwrites the other's, whichever word comes last.
- **Played by the server** (`CannonUtil`, stepped from the socket flush, while someone is in the room): it rests, waits a random while, then turns after the nearest player for as long as it takes to be aimed, stands aimed a moment, fires that way, and waits again. Its last ball fired, it is taken away.
  - **Whom it turns after**: the nearest player at each step, wherever they are, in its range and sight or not. A ghost is nobody, and so is a helper; with nobody, it keeps still until someone comes.
  - **Aimed** once it has had them in its sights a while without a break: pointing at them, from where it may fire at them (in range, not too near, within its barrel's tilt, in clear sight of its muzzle, which nothing a ball bounces off blocks: a mirror, an NPC, another cannon). The while is the server's to count, and starts over with whoever is the nearest.
  - **It turns slowly**, so that whoever keeps going round it outruns it and is never fired at.
  - Switched off it does nothing, and starts over rested once on.
- **Told sparingly**: the room hears its state only where a browser would show a difference, never time passing.
- **Kept by the room's saves** as it stands, so a reload or a restart goes on from there. At shutdown it keeps still.

## The ball
- A non-persistent object only the server adds, moves or removes (`CannonBallUtil`), under the same key (`CannonBallStateUtil`): where it is, how it moves and how many times it has bounced, or that it burst and whom it threw. A room's saves keep it as it flies, like a bill.
- **Flight**: straight and weightless, turned a little by a fan's stream, as a sphere swept through the room (`PhysicsSphereUtil`). Blocks, the room's own floor and ceiling, bodies, other balls and solid objects stop it. The room's sides don't: a ball goes out through a gap, and is taken away silently far outside.
- **Bouncing**: off a mirror, an NPC or a cannon it bounces and flies on faster, and nothing else comes of it (`ColliderConfig.bouncesSpheres`).
  - Off a mirror as light does, by the way the mirror faces, whichever part of it the ball touches.
  - Off an NPC as off an upright cylinder: level off its side, straight away from its middle line, and up off the top of its head. A player is round to a ball the same way.
  - Off a cannon as off a solid box, by the way out of it where the two touch: aslant at an edge or a corner.
  - Only one it is closing on, so one it has bounced off, or sets off from inside, lets it go.
  - Each bounce adds a set amount to its speed, along the way the bounce sends it, up to the most a ball goes. A stream speeds one up less far than that, and one that bounces have made faster not at all.
  - Its state counts each bounce, these and those off other balls, which is how a browser knows of one it has yet to show.
- **Striking** anything else: everything within its blast of the spot is looked at. Other balls bounce off it as billiard balls do, each pushed off the other by what a bounce adds. Anything else bursts it:
  - bodies within are thrown (`CannonBlastUtil`): whatever a Rigidbody moves, players' characters (a person's or an agent's) being the one type with one. Each goes straight away from the ball's middle and up off its feet, as hard for all; for the one the ball struck, that is off their side where the two met;
  - blocks within are broken, with what hangs on them, where anybody at all could have removed both: none in a restricted zone, nor one holding up what only an owner or an admin may take off, nor one a cannon hangs on;
  - it leaves a bill if it threw nobody (see [inventory.md](inventory.md)).
- **Who throws a body** is whoever moves it: a browser the ones it has a Rigidbody for (its own user's player), on hearing of the burst, and the server an agent's. Either's moves are then believed for a while, as far as the blast carries a body (`PlayerMotionCheckUtil`).
  - The burst tells which way the one the ball struck goes, as the server had the two meet: their browser has them somewhere else by then, and would otherwise throw them by where they have got to. One the blast only reached goes away from the burst from where their browser has them.

## In a browser
- **A ball flies itself** between the server's words (as it is fired, whenever something turns it, that it burst), by the wall clock, so that slow frames don't leave it behind.
  - A bounce off a mirror, an NPC or a cannon it makes at once, as the server's ball does. If the server's word of it doesn't come in a moment, the server's ball never bounced: this one goes back to the way it went, past what it bounced off. Until that word, it shows no burst on what the bounce leads it to.
  - Each bounce is shown once, as sparks and a clang about the ball (`cannonBallBounceObservable`): as the browser makes it, or, for one only the server's ball made (off another ball, say), as the server's word counts it.
  - A burst it can foresee (on a block, the room's floor or ceiling) it shows at once.
  - At a body it waits briefly for the server's word, and flies on if none comes.
- **The barrel** turns toward the aim last told, faster when behind, and is on it as it fires. Switched off, it droops under a rising "Z" (on a wall, it hangs straight down).
- **Parts** are posed from the state and the face it stands on (`CannonCompositionUtil`): the barrel's facing, and the balls left on its counters (see [instanced_mesh_composition.md](../graphics/instanced_mesh_composition.md)).
  - **Counters**: the number as a digital display shows it, in glowing segments on a black panel, each panel's digits laid out along the panel's own axes as the renderer turns it, so they read the right way round on any face.
  - On a floor, one on each side of the pillar. On a wall, three, each upright as the room has up: one on the pillar's side to either hand, and one on the plate, facing out of the wall, over the pillar, in place of the pillar's upper side's. Its lower side has none.
  - Green, or red and blinking once few balls are left. The digits dim with the camera's distance, down to the black.
- **Buying**: the add button shows the price and takes no press short of it. The add is optimistic, and the server answers a refused one with a removal. A bought object stays out of the undo history (see [game_mode.md](game_mode.md)).
- **Thrown**: the user's own player is thrown as the burst says (see above), and in play mode the camera shakes hard (see [camera_control.md](../graphics/camera_control.md)).
- Sounds and effects: see [audio.md](../audio/audio.md) and [particles.md](../graphics/particles.md).

## Walking round one
- A path planned over the voxel grid, for an agent's body or a helper, treats a cannon as a block (`ObjectObstacleUtil`).
- A helper is never aimed at, hides nobody from a cannon, and is thrown by no blast: a ball bounces off it where it stands, the server's collider for it going where it is shown (see [agents.md](../networking/agents.md)). A cannon is one of the things helpers go and look at.

## Agents
They buy, switch, move and remove cannons through the same signals, see cannons and balls in what they look at, and are told when one throws them (see [agents.md](../networking/agents.md)).
