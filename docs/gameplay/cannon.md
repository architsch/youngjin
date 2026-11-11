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
  - **Aimed** once it has had them in its sights a while without a break: pointing at them, from where it may fire at them (in range, not too near, within its barrel's tilt, in clear sight of its muzzle). The while is the server's to count, and starts over with whoever is the nearest.
  - **It turns slowly**, so that whoever keeps going round it outruns it and is never fired at.
  - Switched off it does nothing, and starts over rested once on.
- **Told sparingly**: the room hears its state only where a browser would show a difference, never time passing.
- **Kept by the room's saves** as it stands, so a reload or a restart goes on from there. At shutdown it keeps still.

## The ball
- A non-persistent object only the server adds, moves or removes (`CannonBallUtil`), under the same key (`CannonBallStateUtil`): where it is and how it moves, or that it burst and whom it threw. A room's saves keep it as it flies, like a bill.
- **Flight**: straight and weightless, turned a little by a fan's stream, as a sphere swept through the room (`PhysicsSphereUtil`). Blocks, the room's own floor and ceiling, bodies, other balls and solid objects stop it. The room's sides don't: a ball goes out through a gap, and is taken away silently far outside.
- **Striking**: everything within its blast of the spot is looked at. Other balls bounce off it as billiard balls do. Anything else bursts it:
  - players within are thrown (`CannonBlastUtil`);
  - blocks within are broken, with what hangs on them, where anybody at all could have removed both: none in a restricted zone, nor one holding up what only an owner or an admin may take off;
  - it leaves a bill if it threw nobody (see [inventory.md](inventory.md)).
- **Who throws a player** is whoever moves them: a browser its own user's, on hearing of the burst, and the server an agent's body. Either's moves are then believed for a while, as far as the blast carries a body (`PlayerMotionCheckUtil`).

## In a browser
- **A ball flies itself** between the server's words (as it is fired, whenever something turns it, that it burst), by the wall clock, so that slow frames don't leave it behind. A burst it can foresee (on a block, a floor, a solid object) it shows at once. At a body it waits briefly for the server's word, and flies on if none comes.
- **The barrel** turns toward the aim last told, faster when behind, and is on it as it fires. Switched off, it droops under a rising "Z" (on a wall, it hangs straight down).
- **Parts** are posed from the state (`CannonCompositionUtil`): the barrel's facing and the gauges' level (see [instanced_mesh_composition.md](../graphics/instanced_mesh_composition.md)). The gauges' green dims with the camera's distance, down to the dark strips behind it.
- **Buying**: the add button shows the price and takes no press short of it. The add is optimistic, and the server answers a refused one with a removal. A bought object stays out of the undo history (see [game_mode.md](game_mode.md)).
- **Thrown**: the user's own player is pushed away from the burst, and in play mode the camera shakes (see [camera_control.md](../graphics/camera_control.md)).
- Sounds and effects: see [audio.md](../audio/audio.md) and [particles.md](../graphics/particles.md).

## Walking round one
- A path planned over the voxel grid, for an agent's body or a helper, treats a cannon as a block (`ObjectObstacleUtil`).
- A helper is neither aimed at nor hit: balls pass through it. A cannon is one of the things helpers go and look at.

## Agents
They buy, switch, move and remove cannons through the same signals, see cannons and balls in what they look at, and are told when one throws them (see [agents.md](../networking/agents.md)).
