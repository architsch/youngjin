# Test Scenario Coverage

This document catalogs all integration test scenarios organized by category.

## Connection Lifecycle (`connection.test.ts`) — 9 tests

| Test | What it verifies |
|------|-----------------|
| connecting a user registers them in ServerUserManager | A connected user appears in `ServerUserManager` |
| disconnect with saveState=true persists player metadata + lastRoomID | Disconnect-with-save flushes `playerMetadata` and `lastRoomID` to the DB mock |
| disconnect with saveState=false does NOT call savePlayerMetadata | Disconnect-without-save performs no metadata write |
| lastRoomID is persisted on room join even without disconnect | Joining a room writes `lastRoomID` to DBUser immediately |
| Case A: new socket before old disconnect preserves metadata | Reconnect (new socket first) keeps player metadata |
| Case B: old disconnect before new socket preserves metadata | Reconnect (old disconnect first) keeps player metadata |
| handles rapid connect-disconnect-reconnect cycles | Invariants hold across many rapid cycles |
| player object's metadata reflects what the user joined the room with | The spawned player object carries its join-time metadata |
| player metadata is updated by chat and flushed on disconnect | Chat updates metadata; disconnect-with-save persists it |

## Room Management (`room.test.ts`) — 9 tests

| Test | What it verifies |
|------|-----------------|
| joining an unloaded room triggers loadRoom | Room loads from DB on first join |
| joining an already-loaded room adds user without reloading | A second user joins without a reload |
| joining a non-existent room returns gracefully | Graceful failure, no crash |
| all participants see consistent object state for every player | Users in a room see each other's player objects |
| users in different rooms have independent room IDs persisted to DBUser | Per-user `lastRoomID` stays independent across rooms |
| switching rooms saves state from previous room | A room switch persists the previous room's state |
| requestRoomChange persists the new lastRoomID + flushes prev room's metadata | `onRequestRoomChangeSignalReceived` writes the new `lastRoomID` and flushes the prior room's metadata |
| room unloads when last user leaves | An empty Regular room is removed from memory |
| graceful shutdown saves all rooms and user metadata | Shutdown persists and unloads all rooms and users |

## Room Generation (`room-generation.test.ts`) — 15 tests

Every Hub/Regular room is laid out procedurally from a seed, so its shape is unknowable in advance. What is asserted is the set of properties every generated room must have whichever seed produced it. See [room_generation.md](../../geometry/room_generation.md) for the behavior under test.

| Test | What it verifies |
|------|-----------------|
| leaves every part of the room reachable on foot from the entrance | A flood fill from where a player arrives reaches every walkable cell — no region is ever sealed off |
| leaves the wall the door hangs on standing, and the floor in front of it clear | The entrance cell is solid wall, since a door is hung on it, and the approach cells in front of it are free of generated content |
| keeps the boundary wall solid the whole way round | The perimeter is intact everywhere, the entrance cell included |
| gives every room an upper storey a player can climb to and walk around on | A walk from the entrance — stepping up at most one layer at a time, and needing headroom to stand — reaches the storey above, and reaches enough of it to be a floor rather than a ledge |
| builds stairs the physics engine actually carries a player up | The shortest route upstairs is replayed through `PhysicsManager` with a real player collider, gravity and step-up, and his feet end up on the storey floor |
| climbs to the upper storey by a flight wide enough to walk up | Every tread of a flight along the route upstairs — a run that climbs a layer at a time, more than once over, as opposed to a single step onto a piece of block work — has a second cell beside it at the same height that is equally standable, i.e. the flight is more than one cell across |
| leaves nothing standing in mid-air | Every block of the room is held up: it rests on the room's floor, on a block below it, or against a block beside it at the same height. Anything left over after that has spread as far as it can — a prop stood on a storey the room was left without, say — is floating |
| keeps the upper storey inside the room | The boundary wall is solid through the room's full height, so climbing the stairs is not a way out of it |
| opens some of its rooms through both storeys, and floors over the rest | Across the seeds, some rooms come out with a space open from floor to ceiling — and every room, whichever way it went, still has a reachable upper storey |
| furnishes a multiplayer room with its own way in and nothing else | A generated Hub carries exactly one object: a default-entrance door on the boundary wall at the entrance cell, facing into the room |
| builds the room in a texture pack whose palettes it drew from | The room's texture pack has palettes curated for it in `RoomPaletteMap`, and the pack varies across seeds |
| decorates a hub, and hands a regular room over plain | A Hub's visible quads carry several different textures; a Regular room's carry exactly one, i.e. each room type is finished with as much as its `RoomPaletteSelectionParams` offers and no more |
| keeps every palette within the reach of a texture pack atlas | Every curated palette's texture indices exist in the atlas, for every pack |
| rebuilds the same room from the same seed, and a different one from a different seed | Generation is deterministic per seed (layout and texture pack alike), and seeds do not collapse onto one layout |
| is what the room generator builds Hub and Regular rooms with | `RoomGenerationUtil.generateRoom` returns a procedurally generated room, texture pack included, for both multiplayer room types |

## Voxel Grid Migration (`voxel-grid-migration.test.ts`) — 63 tests

A room's contents are stored as an opaque binary blob, so an old room is migrated by the decoder on load rather than by a pass over storage. The fixtures these run against were produced by the previous commit's own encoder, in a git worktree, so what is being read is what the shipped code actually wrote — see the fixtures' README. Run per fixture: the bare shell a multiplayer room used to be, four fully generated rooms, and one with block work of assorted heights. See [voxel_grid.md](../../geometry/voxel_grid.md#stored-format-and-its-versions) for the behavior under test.

| Test | What it verifies |
|------|-----------------|
| is recognised as an older version than the one being written now | The blob declares the older version, and what comes out of it is written back in the current one |
| keeps every layer the room already had, face for face | Every quad of every layer the old room had survives the migration byte for byte |
| keeps every voxel standing where it stood, and adds the storey floor over it | Each cell keeps its collision layer mask, plus a slab at the height its ceiling used to hang at |
| leaves the storey above the slab empty | Every layer above the slab is unoccupied and holds no quads |
| leaves the room's floor exactly as it was | Every floor tile keeps its visibility and texture |
| shows the old ceiling from below, as the underside of the new storey floor | The slab's underside carries the old ceiling's texture, and is on show under exactly the cells the ceiling tile was |
| hangs the room's own ceiling over the empty storey instead | Every ceiling tile is on show over the empty storey, carrying the old ceiling texture |
| comes out of a second decode identical to the first | Migration is a function of the blob alone, so two servers loading the same room agree |
| survives a round trip through the current format unchanged | Re-encoding a migrated room and reading it back gives the same room, so a migrated room does not decay each time it is saved |
| is carried through every version up to the current one | A version-0 blob runs the whole chain of converters, arriving with both the corner walls version 1 introduced and the storey floor version 2 introduced |
| holds no quad outside the grid's own range | The migrated room addresses exactly the quads the current grid does |
| seals the doorway, so that the room's door has a wall to hang on | A migrated room's entrance cell is solid, since a wall attachment with nothing behind it is refused |
| fills the doorway in, and finishes it like the wall it is now part of | The filled cell is solid to the doorway's old height and carries the neighbouring wall's texture on the face that looks into the room |

## Room Population (`room-population.test.ts`) — 34 tests

See [room_population.md](../../networking/room_population.md) for the behavior under test.

### Per-room player cap

| Test | What it verifies |
|------|-----------------|
| a room fills up to its admission cap and turns further users away | The room stops admitting once it is almost full; the next join is rejected and leaves the user roomless |
| a room change refused for capacity leaves the user in the room they were already in | A refused join does not evict the user from their current room |
| a user re-entering the room they already occupy is not blocked by their own slot | Re-entering a room at exactly the admission cap succeeds, since the user releases their own slot |
| a full destination re-routes the user to an available hub when fallback is allowed | A routed-to (rather than asked-for) full destination lands the user in a hub |
| a destination that no longer exists re-routes the user to a hub when fallback is allowed | An unloadable destination also falls back rather than leaving the user roomless |
| a destination that could not be resolved at all is refused rather than left roomless | An empty destination is a refusal, not a request to put the user in no room |

### Telling the client about a refusal

| Test | What it verifies |
|------|-----------------|
| the client is told why its room change request was refused | A `roomChangeRejectedSignal` (reason: room is full) is queued, and no `roomChangedSignal` is |
| a room change request for a room that does not exist is refused as unavailable | The rejection reason distinguishes an unavailable room from a full one |
| a successful room change sends no rejection signal | The signal is only emitted on failure |

### Hub picking

| Test | What it verifies |
|------|-----------------|
| keeps filling one under-populated hub instead of spreading users across all of them | The busiest under-populated hub is still the one chosen |
| moves on to the next hub once the current one is no longer under-populated | Sitting at the threshold still counts as under-populated; one past it hands over to the next hub |
| distributes users evenly once every hub is medium-populated | With no under-populated hub left, the emptiest one wins |
| never routes a user into a hub that is already almost full | Such a hub is excluded from the candidates |
| opens a new hub once every existing hub is over-populated | A brand new, empty hub is created and preloaded |
| opens only one new hub when several users arrive at the same moment | Concurrent picks share a single hub creation |
| falls back to an over-populated hub when a new one cannot be opened | A failed hub creation still yields the emptiest hub that has a free slot |
| picks nothing when every hub is capped and no new one can be opened | The picker yields nothing, which the caller turns into a refusal |
| routes the reserved "hub" target through the hub balancer | The reserved hub keyword resolves via the same balancing rules |

### Where a user lands when the app starts

Exercised through `harness.appStartJoin()`, which mirrors what `SocketsServer` does on connection: pick a destination, join with a fallback allowed, and report a refusal.

| Test | What it verifies |
|------|-----------------|
| sends a returning user back to the room they were last in | The last room outranks the hub balancer |
| re-routes a returning user to a hub when their last room has filled up | A routed-to destination diverts silently — no rejection signal |
| re-routes a returning user to a hub when their last room no longer exists | A deleted last room is treated the same as a full one |
| sends a first-time user to the hub the balancer picks | With no history, the balancing rules decide |
| honours a room named in the connection URL over the user's last room | The URL target outranks the last room |
| sends a user who owes a single-player mode there first, whatever else they have | Single-player wins over both URL target and last room, and registers no participant |
| tells a connecting user when no room at all can take them | An empty pick reaches the client as a rejection rather than an endless wait |

### Leaving single-player mode (tutorial door / skip)

| Test | What it verifies |
|------|-----------------|
| routes a user leaving single-player mode through the picker | An unnamed destination means "you choose", not "refuse" |
| re-routes a user leaving single-player mode when the room they came for is full | The fallback applies on the way out of single-player too |

### Page refresh and server restart

| Test | What it verifies |
|------|-----------------|
| gives a refreshing user their slot back in a room that is otherwise full | The old socket is evicted before the new one picks, so the slot is free again |
| re-routes a refreshing user whose slot was taken while they were away | Losing the slot mid-refresh diverts rather than strands |
| lets everyone back into their room after a server restart | A shutdown followed by a simultaneous mass reconnect puts everyone back |
| records where every user was before the shutdown finishes | The shutdown leaves each user's room persisted, which is what the return trip reads |
| returns each user to their own room after a restart, not to a common one | Users spread across regular rooms and a hub each go back to their own |
| returns a hub visitor to the same hub rather than re-balancing them | Being remembered outranks being balanced, even though every hub is empty afterwards |
| takes a user who was mid-tutorial at shutdown back into the tutorial | A single-player user holds no room, and their mode still decides where they land |

## Object Management (`object.test.ts`) — 8 tests

| Test | What it verifies |
|------|-----------------|
| two players both spawn at the room entrance | Both players land where the room's own door puts an arrival, whichever room they came from |
| player can update own object transform | A move across open floor is accepted near the target |
| player cannot move another player's object | Authority check: a user cannot move someone else's player |
| objects are removed when user leaves room | A player object is cleaned up when its user leaves, while the room's own door stays put |
| a far position jump is accepted rather than force-resynced | Distance alone never reverts a move; only collision constrains it |
| ServerUserManager.getPlayerMetadata mirrors live player-object metadata | The metadata snapshot matches the live player object |
| disconnect-with-save persists lastRoomID and flushes the latest metadata | Disconnect-with-save writes `lastRoomID` and the latest metadata |
| chat messages are stored in player metadata | A chat message lands in the player object's metadata |

## Doors and the Admin Privilege (`door.test.ts`) — 14 tests

A door is how one room is joined to another, so laying one is an edit to the shape of the world rather than to a room's contents. See [admin.md](../../gameplay/admin.md) and [room_entrance.md](../../geometry/room_entrance.md) for the behavior under test.

### Who may do what

| Test | What it verifies |
|------|-----------------|
| lets an admin hang a door in a hub, and nobody else | An admin may add a door to a Hub; a member and a guest may not |
| refuses a door in a regular room, even to an admin | A Regular room keeps the one door generation gave it — not even an admin adds another |
| refuses a door hung under somebody else's name | The anti-spoof check rejects a door whose source user is not the requester |
| lets only an admin take a hub's door down, move it, or re-wire it | Removal, movement and metadata writes are all accepted for an admin and refused for a member and a guest |
| refuses a door move that would be resolved against physics | A door is placed rather than pushed, so a transform that is not physics-ignoring is rejected |
| answers only to the metadata a door has | Label, destination room, destination door label, door type and composition are accepted; an image path and a chat message are not |

### What a door makes of the values it is handed

| Test | What it verifies |
|------|-----------------|
| trims a label and cuts it to length, since a label is also a name to be found by | Surrounding whitespace goes, and an over-long label is cut to the maximum |
| snaps a door type to one the enum actually holds | A valid door type survives; anything else comes out as a custom entrance |
| reads a door with no metadata as a custom entrance leading nowhere | Every reader has a defined answer for a door that carries nothing |

### Choosing where a player arrives

| Test | What it verifies |
|------|-----------------|
| puts him behind the door he was sent to, wherever that door is | A named destination door is found by its label, and the player lands a pace out from its face, facing away from it |
| falls back on the room's own way in when the named door is not there | A label nothing answers to falls through to a door the room offers as a way in |
| falls back on any door at all when no door offers itself as the way in | A room whose doors are all custom entrances still receives arrivals |
| falls back on the middle of the room when it holds no door at all | A room with no doors is still somewhere a player can be put down |
| prefers a door that offers itself as the way in over one that does not | Repeated draws never land on a custom entrance while a default one exists |

## Voxel Operations (`voxel.test.ts`) — 13 tests

| Test | What it verifies |
|------|-----------------|
| adds a voxel block at an interior position | Block placed at an interior cell |
| removes a voxel block | Block removed after an add |
| builds and removes a column of blocks | Build then tear down a multi-layer column |
| voxel state is consistent after mixed add/remove operations | Mixed adds/removes leave exactly the expected blocks |
| adding a block at multiple collision layers | Blocks at non-contiguous layers (0, 1, 3) |
| removing a non-existent block is handled gracefully | No crash when removing an absent block |
| duplicate add to occupied layer is rejected | A second add to an occupied layer is rejected |
| refuses to take down a wall a door is hanging on | The wall behind the room's own door stays up, while the same wall a few cells over comes down — nothing protects the entrance by position any more, only the door itself |
| builds and hangs freely right up to the entrance, which nothing reserves any more | A block goes up directly in front of the door, and a picture goes up on the boundary wall beside it — the old no-build and no-removal zones are gone |
| a block holding a canvas can only be removed once the canvas goes first | A block with something hanging on it refuses to come down until the attachment has been taken off it |

A room's boundary used to have a hole at its entrance, plugged by an invisible collider. Both are gone: the way in is a door hung on the wall, so the wall is simply whole.

| Test | What it verifies |
|------|-----------------|
| stops a player at the entrance the same way it stops him anywhere else | A real player collider walked at the entrance through `PhysicsManager` is brought up against the wall the door hangs on, on both storeys alike |

A room is encoded into one reusable buffer, and writing past the end of a typed array is silently ignored rather than throwing — so these two cover the room nobody has built yet, which is the most a room can ever cost to write down.

| Test | What it verifies |
|------|-----------------|
| survives being written and read back when the room is filled solid | A room solid from its floor to its ceiling in every cell encodes within the format's own maximum and decodes back quad for quad |
| refuses an encoding that overflowed the buffer rather than handing back a short one | An encoding that ran past the buffer throws instead of returning a truncation, and leaves the buffer free for the next one |

## Game Mode (`game-mode.test.ts`) — 23 tests

Clicking something in the room means one thing in play mode and another in edit mode. See [game_mode.md](../../gameplay/game_mode.md) for the behavior under test.

| Test | What it verifies |
|------|-----------------|
| leaves the camera alone when the user selects a block | A selection made in play mode neither starts edit mode nor takes the camera out of the first-person view |
| drops the selection when the user clicks the same block again | In play mode, clicking the current selection again is still how it is let go of |
| selects the user's own character and orbits it | Entering edit mode picks out the character and frames it by its own size alone (no minimum distance asked for) |
| opens for a user who may not edit the room, on his own character | A visitor to someone else's room still gets the mode and his own character in it: the character is his wherever he is standing |
| turns away that user's click on the room itself, and says why | A click on a block in a room he may not edit selects nothing and raises a notification, while leaving him the mode and the character he came into it for |
| lets an editor's click on the room through | The same click by a user who may edit the room selects the block and raises nothing |
| carries the selection over to a block the user picks next | Picking a block inside the mode drops the character, keeps the mode, and re-frames the camera — this time with a minimum distance, so the block is seen among its surroundings |
| is left by a second click on the block being edited | Clicking the current selection again lets it go, and the mode goes with it: nothing is selected and the camera is back at the player's eye |
| is not left by a second click on the user's own character | The character is the exception, since opening the mode goes through the same call: it stays picked out and the mode stands |
| keeps the orbit through the gap left by a selection being replaced | A selection dropped on the way to another one (what an edit does as it moves the selection onto what it just built) does not read as the mode having ended |
| drops the selection and hands the camera back | Leaving the mode clears every selection and returns the camera to the first-person view |
| is left behind when the user's standing in the room is taken away | A role change that revokes editing drops what he had picked out of the room, ends the mode, and returns the camera |
| is left behind even while a scripted step is holding that selection in place | The step's hold is on the user giving a selection up, not on it being taken from him: the selection goes and the mode with it |
| takes a selection a scripted step had pinned along with it | A pinned selection is pinned for the sake of what is taught inside the mode, so leaving the mode drops it too rather than being blocked by it |
| keeps the way out shut | A step holding the user in his mode refuses the crossing itself — what the exit button and the back gesture both come down to — leaving mode, selection, and orbit as they were |
| keeps the way in shut | The same hold refuses the crossing the other way: edit mode does not open, and nothing is picked out |
| turns away a second click on the block being edited, selection and all | The third way out is refused whole, since dropping the selection alone would leave the user in a mode with nothing under it |
| lets the way out through again once it lets go | The step that teaches the way out opens it for itself, and the selection it had pinned meanwhile is no obstacle |
| holds the camera on its own place while the user's selection stands | A step that points the camera somewhere frames that place, and picks nothing out for the user — his own selection is untouched |
| outranks what the user selects meanwhile, and gives the camera back when it ends | The step's place wins over a selection made under it, and clearing the override re-frames the camera onto that selection |
| leaves the camera where it is in play mode | Pointing the camera is an edit-mode affair: in play mode the first-person view stands |
| replaces the character with a block, and the block with the character again | Only one of the three selections is ever active |
| replaces the character even while a step holds the character's own selection down | Pinning a selection stops the user from dropping it, not from picking something else instead |

## Single-Player Mode (`single-player.test.ts`) — 14 tests

| Test | What it verifies |
|------|-----------------|
| joining a single-player room does not load a server-side room or register a participant | No server-side room is loaded (the client generates it), the user is bound to no room, and the socket context is flagged `isInSinglePlayerRoom` |
| does not persist lastRoomID when joining a single-player room | `lastRoomID` stays empty — single-player rooms are re-entered via `user.singlePlayerMode` |
| joining a multiplayer room still registers the user as a participant | A Hub join registers the user (participant count 1) and leaves `isInSinglePlayerRoom` false |
| rejects a single-player user's edit signals — there is no server-side room to mutate | Defense-in-depth: firing all eight room-mutating signals (object add/remove/transform/metadata, voxel add/remove/move/setTexture) as a single-player user, at a real quad of the tutorial room's dividing wall, leaves the user unbound and creates no server-side room — every handler bails at its no-room guard |
| omits content for a single-player room and reconstructs it empty | The wire format sends a single-player room as a content-less descriptor: `RoomRuntimeMemory.encode/decode` preserves the room's identity but omits its voxels/objects, reconstructing them empty |
| still round-trips full content for a multiplayer room | A Hub room's voxel grid and object group survive the encode/decode round-trip intact |
| generates the tutorial room with the walls its steps take down | `RoomGenerationUtil` (the same shared generator the client uses) builds both walls the tutorial later opens — the one between the user and the receptionist, and the one across the way out — leaves the fallback patch of floor bare, and places the receptionist and the door the steps address by name |
| builds the tutorial room as a single storey the camera can look down into | Every space the tutorial opens is below the slab that caps the room, and no cell of the grid draws an upward face at or above that slab — so a camera drawn back above the room looks into it rather than down onto a lid |
| emits per-quad change events during generation (why the client listens only after voxels spawn) | Generation fires `voxelQuadChangeObservable` events per quad — guarding the ordering assumption that the client registers its quad-change listener only after the room's voxel objects exist |
| picks a bare patch of floor between the player and the camera | The patch the tutorial asks the user to select is settled while the step runs: it lies toward the camera, is never the one the user is standing on, and carries no block — so its outline is visible and the block he is asked to build has somewhere to go |
| keeps the whole block-building passage on the one patch it asked for | Every step of the passage reads back the one patch `select_floor` settled: the step advances only on that patch (row/col/layer/face all named) and turns the camera on it, and `add_block` and `remove_block` each end by putting the selection where the passage needs it next — on the block just built, then back on the floor it stood on |
| falls back to the room's own patch when the floor gives out at once | With a wall in the way of the search, the fallback patch written into the room's layout stands |
| loadSteps returns a name-keyed map with an 'initial' entry step and a terminal step | Tutorial steps form a name-keyed map (not a positional array), include the `initial` entry step, and have at least one terminal step (a rule whose `nextStep` is `""`) |
| every transition targets an existing step or the terminal, and all steps are reachable from 'initial' | Step-graph integrity: every transition `nextStep` names a defined step (or `""`), and walking from `initial` reaches every step (none orphaned) |

## FTUE (`ftue.test.ts`) — 26 tests

See [ftue.md](../../networking/ftue.md) for the behavior under test.

### Client side: how an experience is recorded

| Test | What it verifies |
|------|-----------------|
| stores each element as its own letter | Every FTUE element code maps to a distinct `[A-Za-z]` character — the record is embedded verbatim in the boot page, and two features sharing a character would silence each other |
| stores every element as the same character it has always been stored as | Pins the whole element-to-character mapping, including the reserved hole left by a retired element — renumbering would shift stored records onto the wrong features |
| reports an element the user's stored record already carries | A record loaded from the server is read back per element (one experienced, one not) |
| reports an element as added the moment it is added, without waiting for the server | The client's own copy is updated locally, and the user command is emitted once |
| tells the server about an element once, no matter how often the feature is used again | Repeated use of the same feature emits a single command and stores a single character |
| keeps every element the user goes through in one session | Three elements added in a row are all present and all reported as experienced |

### Client side: when a coach mark is shown

| Test | What it verifies |
|------|-----------------|
| puts a coach mark on the control the user has not used yet | `screenCoachMarksObservable` carries the target element id and the text |
| stays quiet about a feature the user has already been through | A mark whose element became experienced while it was pending is suppressed |
| leaves the marks already on screen alone when another one appears | A second mark joins the first, in the order they appeared, instead of replacing it |
| keeps one mark per control, no matter how often the trigger fires | A repeated trigger for the same control adds no second mark |
| takes a mark down the moment the user uses the feature it points at | Recording the element removes its mark from `screenCoachMarksObservable` |
| leaves the other marks up when one feature is used | Only the used feature's mark is removed; the rest stay exactly as they were |
| leaves a mark up when its target goes off screen, and takes it down only when told to | A hidden mark clears the observable, and — the element still being unexperienced — the guidance is offered afresh on the next trigger rather than lost |
| shows a mark without recording anything, so the control still has to be used | Showing a mark records no element and emits no command: guidance is an offer, and only the user's own click counts as the experience |

### Client and server agreement

| Test | What it verifies |
|------|-----------------|
| the server accepts every element the client can send | Each element the client emits is accepted by `UserCommandUtil` and persisted with the same character — the two sides cannot drift apart silently |

### Server side: the add-FTUE-element command

| Test | What it verifies |
|------|-----------------|
| appends the element to the user's record and persists it | The in-memory user carries the element and `DBUserUtil.setFTUE` is called once with it |
| accumulates elements across one session rather than overwriting | Three commands on the same session-long user object yield all three elements (a DB-only write would drop the earlier ones) |
| keeps whatever the user already had stored | A new element is appended to a pre-existing record |
| ignores an element the user already has | A duplicate performs no write |
| stores nothing that is not a single letter | Empty, multi-character, digit, quote, backslash, `<`, space and `$` are all rejected with no write |
| ignores an unknown command without touching the record | An unrecognized command type leaves the record alone |

### Persistence

| Test | What it verifies |
|------|-----------------|
| restarting the tutorial wipes the record, so the guidance runs again | `POST /restart_tutorial` sets the tutorial single-player mode and clears the FTUE record |
| does not wipe the record when the tutorial cannot be restarted | A user already in single-player mode gets 409 and nothing is written |
| carries the record across the user wire format | `User.toString`/`fromString` round-trips the record |
| treats a user string written before the record existed as an empty record | A positional user string without the field yields an empty record |
| migrates a user record written before the field existed to an empty record | Running `DBUserVersionMigration` from version 0 yields an empty record, leaving the rest of the row intact |

## Player Mesh Composition (`composition.test.ts`) — 16 tests

| Test | What it verifies |
|------|-----------------|
| a composition survives an encode/decode round-trip | Encoding a random composition and decoding it reproduces the same part types, colors, and part count |
| the same seed always yields the same composition | `PlayerCompositionCodec.getRandomComposition` is deterministic per seed (and different seeds differ) |
| decoding is idempotent — re-encoding a decoded composition reproduces the string | Decode → re-encode is stable for any seed (property-based) |
| decoding an arbitrary string never throws and still yields a full body | Property-based: any garbage string decodes without throwing into a renderable body |
| decoded params are canonical, so a hostile string cannot smuggle an out-of-range part type | Every decoded part type names a registered body-part builder variant (property-based) |
| part types far outside the valid range decode to a renderable body | A string encoding non-existent part-type indices still decodes to a renderable body |
| a truncated composition decodes to a renderable body | Every truncation length of a valid string still decodes safely |
| a user can set his/her own player's composition | The owner's composition metadata write is accepted and stored on the player object |
| a user cannot set another player's composition | Authority check: writing someone else's composition is rejected and a correcting signal goes back to the sender |
| a player rejects metadata keys outside the allowed set | A player object only accepts its allowed metadata keys (e.g. an `ImagePath` write is dropped) |
| an oversized composition is truncated by the server | Server preprocessing caps the stored string at the max composition length, and the truncated remainder still decodes to a renderable body |
| a composition change is relayed to the other participants | A composition update multicasts to the rest of the room |
| a hostile composition is relayed but still decodes to a body on the receiving side | The server relays the string verbatim, so receivers must (and do) decode it into a renderable body |
| a composition set in-session survives reconnection | The composition persists across a Case A reconnect |
| a restored composition survives a room switch | A composition restored from stored player metadata follows the player through a room change |
| the player object is configured with the codec these tests encode against | Guard: the player object's composer config uses the codec type/version the tests encode with |

## Door Mesh Composition (`composition.test.ts`) — 12 tests

| Test | What it verifies |
|------|-----------------|
| a composition survives an encode/decode round-trip | Encoding a random door and decoding it reproduces the same colors and part count |
| the same seed always yields the same door | `DoorCompositionCodec.getRandomComposition` is deterministic per seed |
| decoding is idempotent — re-encoding a decoded door reproduces the string | Decode → re-encode is stable for any seed (property-based) |
| every authored color scheme survives the palette the codec quantizes to | Each scheme's colors land exactly on entries of the timber palette, so a finish is decoded as it was authored |
| every palette round-trips its own colors, and none outgrows what can name it | Each named palette holds at most 94 colors, and every one of them comes back as the position it was stored at |
| decoding an arbitrary string never throws and still yields a drawable door | Property-based: any garbage string decodes without throwing into a door with valid moulding inputs on every part |
| a truncated composition decodes to a drawable door | Every truncation length of a valid string still decodes safely |
| a door's default appearance depends on where it stands, not on who is looking at it | The fallback composition is seeded from room + object id, so it is stable per room and varies across rooms |
| a door's default appearance is one of the authored schemes | The fallback never invents a color combination outside the curated set |
| a door is finished by an admin in a hub, and by nobody else anywhere | `DoorObjectTypeConfig` accepts composition metadata only from an admin, and only in a Hub |
| the door object is configured with the codec these tests encode against | Guard: the door's composer config uses the codec type/version the tests encode with, and does not collide with the player's |
| every part of a door is drawn by a mesh the composition itself declares | Every part names a declared mesh, carries moulding inputs, and stands at a non-zero relief with more than one distinct depth |

## Signal Emission (`signals.test.ts`) — 6 tests

| Test | What it verifies |
|------|-----------------|
| object transform multicast reaches all except sender | `setObjectTransformSignal` multicasts to everyone but the sender |
| voxel add multicast reaches all except sender | `addVoxelBlockSignal` multicasts to everyone but the sender |
| failed voxel operation sends rollback unicast to sender only | A rejected voxel op unicasts a rollback to the sender only |
| no signal leaks to users in other rooms | A signal in one room never reaches users in another |
| chat message multicast reaches room participants | `setObjectMetadataSignal` reaches room participants |
| desync transform signal reaches ALL participants including sender | A rejected transform broadcasts an authoritative correction to everyone, sender included |

## Permissions (`permissions.test.ts`) — 5 tests

| Test | What it verifies |
|------|-----------------|
| visitor cannot add voxel blocks in a Regular room | Default role in a Regular room is Visitor |
| visitor voxel add gets rollback signal | An unauthorized add triggers a `removeVoxelBlockSignal` |
| all users can edit voxels in a Hub room | Any user can edit voxels in Hub rooms |
| owner can edit voxels in their own Regular room | The room owner has the Owner role and can edit |
| editor role allows voxel editing in Regular room | A promoted Editor can edit in Regular rooms |

## Extended Permissions (`permissions-extended.test.ts`) — 16 tests

### Voxel Operations × Roles Matrix (12 tests)
Parameterized over 4 voxel operations (addVoxel, removeVoxel, moveVoxel, setVoxelTexture) and 3 roles (Owner, Editor, Visitor):
- Owner and Editor succeed in Regular rooms
- Visitor is rejected (gets a rollback) in Regular rooms

### Hub Permissions (1 test)
- Visitor can perform all voxel operations (add, remove, move, setTexture) in Hub rooms

### Mid-Session Role Changes (2 tests)
- Promoting a Visitor to Editor enables voxel editing
- Demoting an Editor to Visitor revokes voxel editing

### Cross-Room Role Behavior (1 test)
- A user's role resets to Visitor when switching to a different Regular room

## State Persistence (`state-persistence.test.ts`) — 9 tests

| Test | What it verifies |
|------|-----------------|
| player metadata is preserved across Case A reconnection | Metadata survives a Case A reconnection |
| player metadata is preserved across Case B reconnection | Metadata survives a Case B reconnection |
| chat message updates metadata and is visible to other users | A chat updates metadata and is seen by other users |
| survives 5 consecutive reconnection cycles | Invariants hold across 5 alternating reconnects |
| alternating Case A and B reconnects with observers | Observers stay present during alternating reconnection cycles |
| voxel blocks persist when all users leave and one rejoins | Blocks are saved when the room empties and seen on rejoin |
| voxel blocks placed by one user are visible to newly joined user | A new joiner sees blocks placed by others |
| extended invariants hold after mixed operations | Physics-room, physics-object, and role consistency after mixed ops |
| graceful shutdown preserves user states across multiple rooms | Shutdown preserves all user states across multiple rooms |

## Race Conditions (`race-conditions.test.ts`) — 26 tests

### RC1: Concurrent Joins to Unloaded Room (2 tests)
- Multiple users joining simultaneously share the same `loadRoom` promise (dedup)
- Concurrent joins under DB latency still dedup correctly

### RC2: Join During Leave — room save + unload race (2 tests)
- A joiner prevents the room from being unloaded during an async save
- Stayers keep the room alive when others leave under latency

### RC3: Simultaneous Voxel Edits on Same Block (3 tests)
- Two users adding to the same position: one succeeds, one gets a rollback
- One user adds while another removes: consistent final state
- Many users editing adjacent blocks concurrently

### RC4: Transform Updates During Room Transitions (1 test)
- Movement signals sent during a room switch are handled gracefully

### RC5: Concurrent Disconnections Under Latency (1 test)
- All gameplay states are saved correctly despite concurrent disconnects

### RC6: Join/Leave Churn with Concurrent Voxel Edits (1 test)
- Voxel edits succeed while users join and leave

### RC7: Reconnection During Active Operations (2 tests)
- Case A reconnect while another user is mid-move
- Case B reconnect while the room is being edited

### RC8: Simultaneous Room Switches (2 tests)
- Multiple users switching rooms concurrently maintain consistent state
- Users cross-switching rooms under latency

### RC9: Multiple Rooms Loading Simultaneously (1 test)
- Different rooms load in parallel without interference

### RC10: Graceful Shutdown During Active Operations (2 tests)
- Shutdown while users are mid-movement
- Shutdown while voxel edits are in progress

### RC11: Latency Stress Tests (2 tests)
- Reconnect under latency: restored state is visible to observers
- Join/leave churn under latency preserves stayer state

### RC12: Metadata-Cache Race (7 tests)
- Case A under latency: live metadata is captured even if the DB has not yet caught up
- Case A: a room owner's reconnect re-establishes the Owner role
- Case B: a brand-new chat message at disconnect lands on the next session
- Disconnect → reconnect across rooms: metadata follows the user
- `evictExpiredDisconnectMetadata` clears stale entries past the TTL
- Fallback to `DBUser` when nothing is cached
- Two rapid reconnects: only the latest chat is kept

## Property-Based Tests (`property-based.test.ts`) — 24 tests

### No-Latency Profiles (9 tests)

| Profile | Weights | Users | Actions | Runs |
|---------|---------|-------|---------|------|
| balanced | connect:2 disconnect:2 join:3 move:3 msg:1 voxel:1 | 10 | 50 | 30 |
| connect-heavy | connect:5 disconnect:1 join:3 | 10 | 40 | 30 |
| disconnect-heavy | connect:2 disconnect:5 join:2 | 10 | 40 | 30 |
| room-switch-heavy | connect:1 disconnect:1 join:6 move:3 | 10 | 40 | 30 |
| voxel-heavy | connect:2 disconnect:1 join:2 move:1 addVoxel:4 removeVoxel:2 | 8 | 40 | 20 |
| reconnect-heavy | connect:2 disconnect:1 join:3 move:2 reconnA:2 reconnB:2 | 8 | 30 | 15 |
| voxel-mixed | connect:2 disconnect:1 join:2 move:1 addVoxel:3 removeVoxel:2 moveVoxel:2 setVoxelTexture:2 | 6 | 40 | 20 |
| permission-mixed | connect:2 disconnect:1 join:3 move:1 addVoxel:2 setUserRole:3 | 8 | 40 | 20 |
| Clean state after all disconnect | balanced weights | 10 | 50 | 30 |

### With-Latency Profiles (7 tests)
Same profiles as above (except reconnect-heavy) with reduced parameters:
- Max users: min(profile, 6)
- Max actions: min(profile, 20)
- Num runs: min(profile, 15)
- DB latency simulated during the run

### Gameplay State Persistence (1 test)
- Saved gameplay state matches the last known in-room state after random action sequences

### Room Volume Geometry (5 tests)

The arithmetic room generation is built on. Every area a room is made of, every wall between two of
them and every opening cut through one is worked out with these, so a fault here is a fault in every
room in the game.

| Test | What it verifies |
|------|-----------------|
| expands a volume by the same amount on all six sides | `RoomVolumeUtil.getExpandedVolume` moves every bound outward by the given amount and returns a copy, leaving the volume it was asked about untouched |
| tells volumes that touch apart from volumes with a wall between them | The two separation questions generation asks: expanding one volume finds the pairs that would touch (which growth refuses), expanding both finds the pairs a single block of wall stands between (which a passage joins) |
| cuts a passage that reaches both volumes and stands between them | A passage fills exactly the gap between two volumes, stays within the stretch they share so it opens into both, and comes out no wider than allowed and never empty — including at a one-cell overlap |
| refuses a passage between volumes that already meet | Two volumes that intersect get no passage |
| carves the same room whatever order the volumes are carved in | Carving a set of overlapping and abutting volumes in any order leaves the same masks and the same quads — the property that keeps a passage from leaving faces drawn in mid-air |

### Integer Range Arithmetic (2 tests)

| Test | What it verifies |
|------|-----------------|
| intersects ranges to exactly the values both hold | `NumUtil.getRangeIntersection` holds exactly the integers in both ranges, and is null when there are none |
| finds the whole numbers standing between two ranges, and nothing else | `NumUtil.getGapBetweenIntegerRanges` holds exactly the integers strictly between the two ranges, and is null whenever they touch or overlap |

## Room Ownership (`room-ownership.test.ts`) — 7 tests

### Owner Enter/Exit

| Test | What it verifies |
|------|-----------------|
| owner enters their own room and gets Owner role | Owner gets the Owner role; participant count is correct |
| owner exits their own room and room unloads | The room unloads and state is saved with the correct `lastRoomID` |

### Visitor Enter/Exit

| Test | What it verifies |
|------|-----------------|
| visitor enters another user's room and gets Visitor role | Both users present, correct roles (Owner vs Visitor) |
| visitor exits another user's room while owner stays | Room stays loaded; participant count decremented; visitor state saved |

### Room Switching

| Test | What it verifies |
|------|-----------------|
| user moves from default hub to their own regular room | User ends up in their own room with Owner role; the vacated hub stays loaded but empty |
| user moves from one regular room to another regular room | Source room unloads; destination has both users |
| user moves between rooms via URL-style navigation (join by room ID) | Joining by room ID works; the source hub is left empty |

## Room API (`room-api.test.ts`) — 12 tests

### Create Room (Scenario 1)

| Test | What it verifies |
|------|-----------------|
| registered user can create a room | Room created in DB; `ownedRoomID` set on the user |
| guest user cannot create a room | 403 returned for a guest user type |
| user who already owns a room cannot create another | 409 returned for a duplicate room |

### Set Room User Role / Appoint Editor (Scenario 4)

| Test | What it verifies |
|------|-----------------|
| room owner can appoint another user as editor | DB role set; in-memory role sync called |
| owner cannot change their own role | 400 returned for a self-role change |
| user without a room cannot appoint editors | 403 returned |
| owner can demote an editor back to visitor | Role changed back to Visitor |
| appointing an editor past the limit is rejected with 409 | Exceeding `MAX_ROOM_EDITORS` returns 409 |
| /get_room_editors returns denormalized {userName, email} from the room | Editor list is projected from `DBRoom.editors` |

### Change Room Texture Pack (Scenario 9)

| Test | What it verifies |
|------|-----------------|
| room owner can change the texture pack | DB updated with the new texture pack path |
| user without a room cannot change textures | 403 returned |
| request without texturePackPath is rejected | 400 returned for the missing field |

## Authentication Lifecycle (`auth-lifecycle.test.ts`) — 25 tests

### Google OAuth (Scenario 10)

| Test | What it verifies |
|------|-----------------|
| new user via Google OAuth: upgrades existing guest to member | Guest upgraded to member via `upgradeGuestToMember` |
| new user via Google OAuth: creates member when no guest exists | New member created via `createUser` |
| existing user via Google OAuth: signs in and cleans up orphaned guest | Existing account used; orphaned guest deleted |
| signed-in member via Google OAuth: a new email leaves the member's own account untouched | A member session is not upgraded in place; the new identity gets its own account |
| signed-in member via Google OAuth: an existing email does not delete the account being left | Only a guest counts as an orphan; the member left behind keeps their account |
| Google OAuth fails gracefully when no auth code provided | 400 returned with "code not found" |
| Google OAuth fails gracefully when token exchange fails | 500 returned with an "access token" error |

### Stale Guest Tier Classification (Scenario 11)

| Test | What it verifies |
|------|-----------------|
| single-login guest is classified as disposable (tier 0) | A 1-login guest maps to tier 0 |
| multi-login guest (2-3 logins) is classified as casual (tier 1) | A 2–3 login guest maps to tier 1 |
| frequent guest (4+ logins) is classified as dedicated (tier 2) | A 4+ login guest maps to tier 2 |
| tier boundary: loginCount=1 stays disposable | The lower boundary stays in tier 0 |
| tier boundary: loginCount=3 stays casual | The upper boundary stays in tier 1 |
| tier max ages are whole days that grow with each tier | Every tier has a whole-day max-age cutoff, and returning guests get longer ones |
| tier names are defined for all 3 phases | All three tier names are present |

### loginCount Accuracy (Scenario 12)

| Test | What it verifies |
|------|-----------------|
| identifyAnyUser calls updateLastLogin with the user's stored lastLoginAt | Page-level identification (`/`) updates login stats, passing the previous login time |
| identifyRegisteredUser does NOT call updateLastLogin | API-level identification does not update login stats |
| identifyAdmin does NOT call updateLastLogin | Admin-level identification does not update login stats |
| multiple API calls via identifyRegisteredUser do not inflate loginCount | Repeated API identifications never call `updateLastLogin` |
| a failed lookup does not replace the token's account with a new guest | A lookup that fails leaves the token's account alone rather than minting a guest over it |
| a token naming a genuinely deleted account still yields a guest on a public route | A public route still admits the holder of a token whose account is really gone |
| a route reserved for members mints no guest for a visitor holding no token | A members-only route turns a tokenless visitor away instead of creating an account for them |
| minimum gap between distinct logins is one day | Pins `LOGIN_COUNT_MIN_GAP_MS` to `1 * DAY_IN_MS` |
| requests within the gap belong to the same login | Same-visit requests do not count as new logins |
| a request after the gap counts as a new distinct login | A return after the inactivity gap increments `loginCount` |
| a missing previous login timestamp counts as a distinct login | Absent `lastLoginAt` defaults to counting the login |

## Guest Creation Limits (`guest-creation-limit.test.ts`) — 4 tests

See [authentication.md](../../networking/authentication.md) for the behavior under test. These run
with the production caps in force, rather than the relaxed dev ones.

| Test | What it verifies |
|------|-----------------|
| allows up to the cap for one IP + User-Agent, then blocks | The per-client cap admits its budget and refuses the next request |
| gives each User-Agent on one IP its own budget, up to the IP cap | Several browsers behind one address get separate budgets, bounded by the per-IP cap |
| does not let one visitor exhaust the cap for others sharing a User-Agent | A visitor at their limit does not block unrelated visitors on the same browser version |
| does not spend IP budget on attempts the per-client cap rejects | Requests refused by one cap are not charged against the other |

## DB Query Layer (`db.test.ts`) — 61 tests

The only suite that runs against a real (emulated) Firestore rather than the DB mock — see
[framework.md](framework.md#the-db-suite) for why, and [workflow.md](workflow.md#the-db-suite-and-the-firestore-emulator)
for how to run it. It skips itself when no emulator is available.

### Insert (6 tests)

| Test | What it verifies |
|------|-----------------|
| stores the given values under a generated document id | An insert without an id returns the one Firestore generated |
| stores the given values under a caller-chosen document id | An insert with an id writes to exactly that document |
| writes over a document that already occupies the chosen id | The stored document is replaced wholesale, not merged into |
| stamps rows written through the DB utils with the current schema version | A newly created row is never one a later read has to migrate |
| does not store an id field, even when the caller supplies one | A row's identity stays the document's key; on this path a supplied id could not be right anyway, since the document has none until the insert creates it |
| does not store an id field under a caller-chosen document id either | Even an id agreeing with the key is a second copy of it, free to drift |

### Select (12 tests)

| Test | What it verifies |
|------|-----------------|
| reads a document by id and attaches the document's own id to the row | A row read by id carries the id callers identify it by |
| takes the row's id from the document, never from a stored "id" field | A row's identity comes from the document, even when an "id" field was stored inside it |
| succeeds with no rows when the document does not exist | A missing document is an empty result, not a failure |
| succeeds with no rows when the collection is empty | An empty collection is an empty result, not a failure |
| filters on a single equality condition | An equality condition selects only matching documents |
| ANDs multiple conditions | Several conditions on one query all have to hold |
| ORs condition groups | Condition groups separated by `or()` each admit their own matches |
| does not match documents that lack the field being filtered on | A row that never reached the version introducing a field is invisible to queries on it |
| orders rows ascending and descending | `orderBy` sorts in the requested direction |
| pages through rows with limit and offset | `limit`/`offset` return the requested page, and nothing past the end |
| reports failure instead of throwing when the collection has no migration defined | An unknown collection fails the query and is logged, rather than escaping the runner |
| reports failure instead of throwing when a row's version is not a number | An unreadable version fails the query and is logged |

### Update (9 tests)

| Test | What it verifies |
|------|-----------------|
| writes only the named fields and leaves the rest of the row alone | An update is a field-level write, not a row replacement |
| reports failure when the document does not exist | Updating a missing document is reported as a failure |
| applies a single-match query update to the one document it matched | A query update touches only what it matched |
| has already written a single-match query update by the time it reports success | The write is awaited, so a caller reading afterwards sees it |
| applies a multi-match query update to every matching document | Every match is updated, and nothing else |
| splits a query update spanning more documents than one commit allows | The write is issued as several commits, each within Firestore's limit |
| applies field transforms such as increment | Transform values reach Firestore as transforms |
| migrates an outdated row and applies the update in the same write | Migration and update land together, leaving no half-migrated row |
| does not store the row's id when a migration rewrites the document | The rewrite an update performs replaces the document wholesale, so it is the other place a stored id could appear from |

### Delete (5 tests)

| Test | What it verifies |
|------|-----------------|
| deletes a document by id | The named document goes, others stay |
| succeeds when the document does not exist | Deleting nothing is not a failure |
| deletes the single document a query matches | A query deletion touches only what it matched |
| deletes every document a query matches | Every match is deleted, and nothing else |
| splits a query deletion spanning more documents than one commit allows | The deletion is issued as several commits, each within Firestore's limit |

### Batch (5 tests)

| Test | What it verifies |
|------|-----------------|
| applies updates and deletions together | A batch mixes both kinds of write in one commit |
| succeeds without touching the DB when given no queries | An empty batch is a no-op |
| rejects the whole batch, writing nothing, when a query names no document | A batch that cannot be built applies none of its writes |
| rejects query types it cannot batch | Only updates and deletions are accepted |
| splits a batch spanning more queries than one commit allows | The batch is issued as several commits, each within Firestore's limit |

### Read-through cache (5 tests)

| Test | What it verifies |
|------|-----------------|
| serves a repeated read by id without going back to the DB | A second read within the entry's lifetime is served from memory |
| does not serve a cached row once an update has invalidated it | A write drops the cached row |
| keeps the cached row when an update opts out of invalidation | `noInvalidate()` leaves the cached row in place while still writing |
| does not serve a cached row once a delete has invalidated it | A deletion drops the cached row |
| caches every row a multi-document read returns | A query result populates the cache for each row it returned |

### Query rate monitor (2 tests)

| Test | What it verifies |
|------|-----------------|
| rejects writes once the window is saturated, and keeps serving reads | Past the critical rate, writes are refused and reads still answered |
| accepts writes again once the window is reset | A fresh window restores normal service |

### Version migration (7 tests)

| Test | What it verifies |
|------|-----------------|
| brings a row written by the oldest schema all the way up to the current one | Every step of the chain runs, in order, adding and dropping fields as declared |
| runs migration steps that themselves read the DB | A step that has to look something up completes before the row is returned |
| hands a migration step the document's own id, whichever query triggered it | One migration step runs under every runner, so each has to hand it the same row shape |
| drops the id field that rooms written before the rule still carry | The v3 → v4 step changes nothing itself; the version bump is what makes the row be rewritten, without its stored identity |
| drops the id field that migrated user accounts still carry | Accounts brought up through an earlier schema change were stored with the reader's copy of their own key; accounts created since were not |
| leaves the owner's name blank when the owner is gone | A lookup that finds nothing does not fail the migration |
| leaves a row that is already current entirely untouched | A current row is neither migrated nor rewritten |

### Migration write-back (10 tests)

| Test | What it verifies |
|------|-----------------|
| persists every outdated document a multi-document read returned | A read returning several outdated rows migrates all of them in the DB, not just the first |
| persists the one outdated document a multi-document read returned | The single-match case persists too |
| persists an outdated document read by id | A read by id persists its migration |
| leaves nothing to migrate for the next read of the same documents | The next read finds the rows current and rewrites nothing |
| does not store the row's id inside the document | The synthetic row id is not written into the document |
| persists outdated documents spanning more than one commit's worth | The write-back is issued as several transactions, each within Firestore's limit |
| leaves a document alone when someone else has already changed its version | A write-back computed from a stale read does not overwrite a newer row |
| skips a document that has been deleted since it was read | A write-back does not resurrect a deleted document |
| reports a failed write-back with a usable description of the failure | The log carries the error's description, not an empty object |
| never lets a failing write-back fail the read that triggered it | The read still succeeds, with fully migrated rows, when the write-back cannot run |

## Test Count Summary

| Category | Tests |
|----------|-------|
| Connection | 9 |
| Room | 9 |
| Room Generation | 15 |
| Voxel Grid Migration | 63 |
| Room Population | 34 |
| Object | 8 |
| Voxel | 13 |
| Voxel Quad Reselection | 32 |
| Game Mode | 23 |
| Single-Player | 14 |
| FTUE | 26 |
| Player Mesh Composition | 16 |
| Door Mesh Composition | 12 |
| Doors and the Admin Privilege | 14 |
| Signals | 6 |
| Permissions | 5 |
| Extended Permissions | 16 |
| State Persistence | 9 |
| Race Conditions | 26 |
| Property-Based | 24 |
| Room Ownership | 7 |
| Room API | 12 |
| Authentication Lifecycle | 25 |
| Guest Creation Limits | 4 |
| DB Query Layer | 61 |
| **Total** | **483** |
