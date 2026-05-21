# Room Entrance Structure

Reference: @src/shared/system/sharedConstants.ts , @src/shared/room/util/roomGenerationUtil.ts , @src/shared/room/util/roomGenerationHelperUtil.ts , @src/shared/voxel/util/voxelUpdateUtil.ts , @src/shared/voxel/types/voxelGrid.ts , @src/shared/physics/types/physicsRoom.ts , @src/shared/object/types/objectTypeConfig/doorObjectTypeConfig.ts , @src/client/object/types/doorGameObject.ts , @src/client/object/clientObjectManager.ts , @src/server/room/serverRoomManager.ts

## Overview

Every room has exactly one **entrance** — a fixed doorway in the room's boundary wall through which every player enters. It is the single gateway used to travel between rooms.

The entrance is anchored to one voxel cell, identified by the constants `ENTRANCE_VOXEL_COL` (16) and `ENTRANCE_VOXEL_ROW` (31). Because row 31 is the last row (`NUM_VOXEL_ROWS - 1`), the entrance sits in the middle of the room's upper-Z boundary wall.

Three things occupy this cell:
1. A **doorway opening** carved into the boundary wall, so the wall reads as an open passage.
2. An invisible **entrance collider** that plugs the opening, so players cannot physically walk out through it.
3. A clickable **Door object** rendered on the inner wall face — the interactive gateway to other rooms.

Players always spawn at this cell when they enter or switch rooms.

## Coordinates & Spawning

- Grid axes: column → +x, row → +z. Voxel `(row, col)` spans `x ∈ [col, col+1]`, `z ∈ [row, row+1]`.
- Entrance cell center (XZ): `(ENTRANCE_VOXEL_COL + 0.5, ENTRANCE_VOXEL_ROW + 0.5)` = `(16.5, 31.5)`.
- **Player spawn** (`ServerRoomManager.changeUserRoom`): `{x: ENTRANCE_VOXEL_COL + 0.5, y: 0.5 × PLAYER_HEIGHT, z: ENTRANCE_VOXEL_ROW + 0.5}`. There is no longer any per-user "last position"; every entry and room switch places the player here (see [user_state_management.md](../networking/user_state_management.md)).
- **Door object** (`ClientObjectManager.spawnDoor`): positioned at `{x: ENTRANCE_VOXEL_COL + 0.5, y: 0, z: ENTRANCE_VOXEL_ROW}`, facing `-z` (into the room). `z = 31` is the inner face of the boundary wall.

## The Doorway Opening (carving the wall)

`RoomGenerationUtil.generateEmptyRoom` builds the room's perimeter walls, then hollows out the entrance so the player is not blocked the moment they spawn:

- `RoomGenerationHelperUtil.removeWall(voxels, ENTRANCE_VOXEL_ROW, ENTRANCE_VOXEL_COL, 0, 4)` clears collision layers 0–4 of the entrance voxel, leaving layers 5–7 solid as a lintel above the opening.

Rooms persisted before this feature are patched by the `VoxelGrid` encoder's **version 0 → 1 converter** (`voxelGrid.ts`): it fills the four corner cells and carves the same entrance opening, so existing rooms gain a valid entrance the next time they are loaded.

## The Entrance Collider (plugging the opening)

Carving the wall would otherwise let players walk straight out of the room into empty space. To prevent that, `PhysicsRoom` adds an invisible `entrance` collider over the opening:

- Centered at `{x: ENTRANCE_VOXEL_COL + 0.5, y: MID_ROOM_Y, z: ENTRANCE_VOXEL_ROW}` with half-size `{0.5, 0.5 × MAX_ROOM_Y, 1}` — one voxel wide, full room height, two voxels deep (reaching one cell into the room).
- It is a hard collider (`applyHardCollisionToOthers: true`) with zero soft-collision force, so it stops the player roughly one cell short of the doorway without pushing them around.

The `entrance` collider is part of the room's `globalColliders` set, alongside the floor, ceiling, and four perimeter walls (see [physics.md](physics.md#global-colliders-room-boundaries)). The net effect: the entrance looks like an open doorway but is sealed against walk-through — the only way out is to interact with the Door.

## The Door Object

The door is the `Door` GameObject type (`DoorObjectTypeConfig`, object type index 3):

- **Non-persistent and client-only.** Each client spawns its own Door locally during room load (`ClientObjectManager.spawnDoor`), with `addToRoomData = false` and a `#`-prefixed client-only id. It is never written to the DB nor sent over the network (see [Local-Only Objects](../networking/object_update.md#local-only-objects-addtoroomdata--removefromroomdata)). All of `canUserAddObject` / `canUserRemoveObject` / `canUserSetObjectTransform` / `canUserSetObjectMetadata` return `false`, so players cannot create, delete, move, or re-skin it.
- **Appearance.** A flat textured square (`meshGraphics`, `door.webp`) sized to the doorway and mounted on the inner wall face.
- **Collider.** A thin pass-through collider matching the mesh footprint (`applyHardCollisionToOthers: false`) — the wall and entrance collider behind it already block the player, so the door itself does not need to.
- **Interaction.** A `playerProximityDetector` (`maxDist` 3.5, `maxLookAngle` 0.25π) drives a `speechBubble`:
  - On proximity start the door shows **"Click to Enter"**; on proximity end it clears the message.
  - Clicking the door *while in proximity* opens the room-list popup (`openPopupObservable.set({popupType: "roomList"})`), from which the player picks another room to travel to. Clicking out of proximity does nothing.

## Voxel Edit Constraints Near the Entrance

![Entrance Voxel Constraints](figures/entrance_voxel_constraints.jpg)

To keep the doorway intact and approachable, `VoxelUpdateUtil` forbids certain edits around the entrance voxel, on top of the normal in-bounds checks. The figure shows the two protected zones; both are defined relative to `(ENTRANCE_VOXEL_ROW, ENTRANCE_VOXEL_COL)`.

- **No adding blocks — the 3×3 zone (green).** `canAddVoxelBlock` rejects any cell with `|col − ENTRANCE_VOXEL_COL| ≤ 1` **and** `|row − ENTRANCE_VOXEL_ROW| ≤ 1` (the entrance voxel and its neighbours, clamped at the boundary). This stops players from walling up the doorway or boxing in the door, keeping the opening clear and the door visible and reachable.
- **No removing blocks — the entrance row (pink).** `canRemoveVoxelBlock` rejects any cell with `|col − ENTRANCE_VOXEL_COL| ≤ 1` **and** `row == ENTRANCE_VOXEL_ROW` (the three boundary-wall cells framing the doorway). This preserves the door jambs (cols 15 and 17) and the lintel (the solid upper layers of col 16), so the opening keeps its frame and the boundary stays sealed apart from the intended gap.

Unlike before, the rest of the boundary ring is now editable: the in-bounds guard was relaxed from "interior only" (`row <= 0 || col <= 0 || row >= NUM_VOXEL_ROWS-1 || col >= NUM_VOXEL_COLS-1`) to "within the grid" (`row < 0 || col < 0 || row >= NUM_VOXEL_ROWS || col >= NUM_VOXEL_COLS`). Only the entrance zones above remain protected.
