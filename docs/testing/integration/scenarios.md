# Test Scenario Coverage

A map of what each suite in `tests/integration/scenarios/` covers. The test names inside each file are the detailed catalog, so read the file itself before extending it.

## Server gameplay (through the harness)
| Suite | Covers |
|---|---|
| `connection.test.ts` | connect and disconnect (with or without save), Case A/B reconnects, rapid cycles, metadata on join and chat |
| `room.test.ts` | loading on first join, joining a loaded room, missing rooms, switching and saving, unloading on empty, graceful shutdown |
| `room-population.test.ts` | player cap and near-full margin, rejection signal, hub picking by band, app-start destination, leaving single-player, refresh and restart |
| `room-ownership.test.ts` | owner and visitor enter/exit, room switching with ownership |
| `object.test.ts` | adding, removing and moving objects, with rollbacks, and the sizes a client may ask for |
| `voxel.test.ts` | add, remove, move and texture operations with rollbacks, the boundary wall, wall attachment at every size, the lamps a block holds up and down, the encoded grid |
| `signals.test.ts` | multicast excludes the sender, unicast rollback, no cross-room leaks, authoritative transform correction reaches everyone |
| `permissions.test.ts`, `permissions-extended.test.ts` | anyone may build in Hub and Regular rooms, and ownership is never a per-operation condition |
| `restricted-zones.test.ts` | server enforcement for blocks, faces and persistent objects, superuser identity, zone-list validation, persistence, single-player exemption |
| `door.test.ts` | admin-only door operations, metadata sanitizing, vertical placement, spawn selection |
| `lamp.test.ts` | lamp permissions, the per-category room cap (on load, after a removal, and against other categories), emitted light, the glow following the light, the lamp codec (the bare first preset, round trip, margin, band, untrusted input), and a player standing on a floor lamp |
| `state-persistence.test.ts` | metadata and voxels across reconnects, empty-room saves, extended invariants, shutdown |
| `race-conditions.test.ts` | RC1–RC12: concurrent joins, join during unload, simultaneous edits, transitions, disconnects, churn, shutdown, latency stress, metadata-cache race |
| `property-based.test.ts` | random action sequences across weight profiles (with and without latency), gameplay persistence, room volume geometry, integer range math |
| `single-player.test.ts` | single-player server contract, wire format, local generation, the tutorial's edit-mode opening, the face it asks the user to pick out and builds against, step graph |

## Server routes, commands and DB
| Suite | Covers |
|---|---|
| `auth-lifecycle.test.ts` | Google OAuth paths, stale-guest tiers, `loginCount` distinct-login gap, session preservation during identification |
| `guest-creation-limit.test.ts` | per-client and per-IP caps, budget accounting, and which User-Agents count as bots |
| `room-api.test.ts` | creating a room, changing the texture pack and lighting (permissions per caller) |
| `ftue.test.ts` | client recording and coach-mark lifecycle, client/server agreement, the add-element command, persistence and migration |
| `acquisition-analytics.test.ts` | ref sanitizing, count-once milestones, returns, session cache, chat vs. build, user migration |
| `db.test.ts` | real query runners on the Firestore emulator: CRUD, batch, cache, rate monitor, version migration, write-back (see [framework.md](framework.md#the-db-suite)) |

## Shared and client logic
| Suite | Covers |
|---|---|
| `room-generation.test.ts` | properties of every generated multiplayer room (reachability, solid boundary, nothing floating, a single door, palettes, determinism), the Regular layout and the current Hub shape. **The `describe.skip` block covers the procedural Hub**, which is currently disabled in `HubRoomBuilder`. Un-skip it when that pipeline is restored, because it is the only coverage for stairs and second storeys. |
| `voxel-grid-migration.test.ts` | decoding fixture blobs written by earlier encoders, and the migrated room's validity and size bound |
| `object-transform-migration.test.ts` | transform ranges and their migration, the scale a stored object comes back at, and older lamps keeping their size |
| `voxel-quad-index-encoding.test.ts` | quad index encoding and validation |
| `voxel-quad-reselection.test.ts` | where the selection goes after local and remote edits and removals, interruptions, and selection narrowed to one quad |
| `game-mode.test.ts` | play/edit transitions, what edit mode opens on (reach, ground tilt, a step's pick) and the camera staying put or within a step's range as it does, step locks on mode and camera, single selection, a step hiding the user's own character, the orbit held still through a gizmo drag |
| `gizmo-drag.test.ts` | pointer arbitration between gizmo drags and the camera: a taken press never turns the view or clicks the world, tap tolerance, a second finger or lost focus abandoning the drag, hover cursors |
| `object-attachment.test.ts` | the frame each facing lays an object out on, which faces hold which types (walls, floors, ceilings, the slab, a lone block), footprint bounds, where a drag or click puts an object and the size a new one goes up at, and corner resizes: every size from every corner, the held corner, the placement grid, the type's limits, refusal when it won't fit, on walls and floors |
| `orbit-camera.test.ts` | how close zoom brings the orbit camera to a target, never past its near side, and holding it within a distance range from every side |
| `line-of-sight.test.ts` | stored coordinates on block boundaries, door visibility, seeing past room geometry, seeing in from outside the room |
| `composition.test.ts` | player, door and indexed mesh composition codecs |
| `canvas-frame.test.ts` | the Default codec's wood parts, the canvas codec (round trip, presets, no frame, margin and margins stored before it existed, untrusted input, resizing), canvas defaults and permissions, the bitmap-frame migration, the per-type pre-encoded table (every indexed type present), the thumbnail atlas layout |
| `label.test.ts` | label permissions (the doors' rule, the metadata whitelist, the cap), the lettering settings (round trip, untrusted input, clamping, defaults), text length in characters, the plaque codec, and a room at every cap holding the longest text fitting the encoding buffer |
| `label-atlas.test.ts` | atlas allocation (no shared or out-of-bounds cells under any sequence, reuse, a room's worth of labels always fitting once packed largest first) and lettering layout (auto size fits, even lines, fixed size breaking long words and leaving overflow below) |
| `instanced-mesh-capacity.test.ts` | the generated mesh capacity table matching current code, and a room full of any decodable appearance of every type fitting it |
| `lighting.test.ts` | light block propagation: occlusion, falloff, direction, accumulation, smoothing, nearness, never darkening, read-back |
| `room-prefs.test.ts` | room prefs encoding, defaults, head-lamp power, light palettes, sky color |
| `room-lighting-edit.test.ts` | client lighting edits and the pending-save rule |
| `range-input.test.ts` | typed slider values |
| `noise-field.test.ts` | the baked value-noise texture |
