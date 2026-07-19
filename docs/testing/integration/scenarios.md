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
| room unloads when last user leaves | An empty room is removed from memory |
| graceful shutdown saves all rooms and user metadata | Shutdown persists and unloads all rooms and users |

## Object Management (`object.test.ts`) — 8 tests

| Test | What it verifies |
|------|-----------------|
| two players both spawn at the room entrance | Both players spawn at the entrance cell (`MULTI_PLAYER_ENTRANCE_VOXEL_COL + 0.5`, `MULTI_PLAYER_ENTRANCE_VOXEL_ROW + 0.5`) |
| player can update own object transform | A small move (within the desync threshold) is accepted near the target |
| player cannot move another player's object | Authority check: a user cannot move someone else's player |
| objects are removed when user leaves room | A player object is cleaned up when its user leaves |
| desync detection triggers when position jumps too far | A jump ≥ 3 units resets the player to the server-authoritative position |
| ServerUserManager.getPlayerMetadata mirrors live player-object metadata | The metadata snapshot matches the live player object |
| disconnect-with-save persists lastRoomID and flushes the latest metadata | Disconnect-with-save writes `lastRoomID` and the latest metadata |
| chat messages are stored in player metadata | A chat message lands in the player object's metadata |

## Voxel Operations (`voxel.test.ts`) — 9 tests

| Test | What it verifies |
|------|-----------------|
| adds a voxel block at an interior position | Block placed at an interior cell |
| removes a voxel block | Block removed after an add |
| builds and removes a column of blocks | Build then tear down a multi-layer column |
| voxel state is consistent after mixed add/remove operations | Mixed adds/removes leave exactly the expected blocks |
| adding a block at multiple collision layers | Blocks at non-contiguous layers (0, 1, 3) |
| removing a non-existent block is handled gracefully | No crash when removing an absent block |
| duplicate add to occupied layer is rejected | A second add to an occupied layer is rejected |
| cannot add a block inside the entrance's no-build zone | Adds in the 3×3 entrance zone are rejected; a cell just outside the zone is allowed |
| cannot remove the wall blocks framing the entrance | Removing entrance-row jambs is rejected; a far boundary block is removable |

## Single-Player Mode (`single-player.test.ts`) — 10 tests

| Test | What it verifies |
|------|-----------------|
| joining a single-player room does not load a server-side room or register a participant | No server-side room is loaded (the client generates it), the user is bound to no room, and the socket context is flagged `isInSinglePlayerRoom` |
| does not persist lastRoomID when joining a single-player room | `lastRoomID` stays empty — single-player rooms are re-entered via `user.singlePlayerMode` |
| joining a multiplayer room still registers the user as a participant | A Hub join registers the user (participant count 1) and leaves `isInSinglePlayerRoom` false |
| rejects a single-player user's edit signals — there is no server-side room to mutate | Defense-in-depth: firing all eight room-mutating signals (object add/remove/transform/metadata, voxel add/remove/move/setTexture) as a single-player user leaves the user unbound and creates no server-side room — every handler bails at its no-room guard |
| omits content for a single-player room and reconstructs it empty | The wire format sends a single-player room as a content-less descriptor: `RoomRuntimeMemory.encode/decode` preserves the room's identity but omits its voxels/objects, reconstructing them empty |
| still round-trips full content for a multiplayer room | A Hub room's voxel grid and object group survive the encode/decode round-trip intact |
| generates the tutorial room with its hotspot blocks | `RoomGenerationUtil` (the same shared generator the client uses) builds the tutorial room with the table (collision layer 1) and obstacle (collision layer 2) hotspot blocks at their metadata coordinates |
| emits per-quad change events during generation (why the client listens only after voxels spawn) | Generation fires `voxelQuadChangeObservable` events per quad — guarding the ordering assumption that the client registers its quad-change listener only after the room's voxel objects exist |
| loadSteps returns a name-keyed map with an 'initial' entry step and a terminal step | Tutorial steps form a name-keyed map (not a positional array), include the `initial` entry step, and have at least one terminal step (a rule whose `nextStep` is `""`) |
| every transition targets an existing step or the terminal, and all steps are reachable from 'initial' | Step-graph integrity: every transition `nextStep` names a defined step (or `""`), and walking from `initial` reaches every step (none orphaned) |

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

## Signal Emission (`signals.test.ts`) — 6 tests

| Test | What it verifies |
|------|-----------------|
| object transform multicast reaches all except sender | `setObjectTransformSignal` multicasts to everyone but the sender |
| voxel add multicast reaches all except sender | `addVoxelBlockSignal` multicasts to everyone but the sender |
| failed voxel operation sends rollback unicast to sender only | A rejected voxel op unicasts a rollback to the sender only |
| no signal leaks to users in other rooms | A signal in one room never reaches users in another |
| chat message multicast reaches room participants | `setObjectMetadataSignal` reaches room participants |
| desync transform signal reaches ALL participants including sender | A desync correction broadcasts to everyone, sender included |

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

## Property-Based Tests (`property-based.test.ts`) — 17 tests

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
| user moves from default hub to their own regular room | User ends up in their own room with Owner role; hub unloads |
| user moves from one regular room to another regular room | Source room unloads; destination has both users |
| user moves between rooms via URL-style navigation (join by room ID) | Joining by room ID works; the source room unloads |

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

## Authentication Lifecycle (`auth-lifecycle.test.ts`) — 20 tests

### Google OAuth (Scenario 10)

| Test | What it verifies |
|------|-----------------|
| new user via Google OAuth: upgrades existing guest to member | Guest upgraded to member via `upgradeGuestToMember` |
| new user via Google OAuth: creates member when no guest exists | New member created via `createUser` |
| existing user via Google OAuth: signs in and cleans up orphaned guest | Existing account used; orphaned guest deleted |
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
| tier max ages use correct day thresholds | Each tier maps to its expected max-age threshold |
| tier names are defined for all 3 phases | All three tier names are present |

### loginCount Accuracy (Scenario 12)

| Test | What it verifies |
|------|-----------------|
| identifyAnyUser calls updateLastLogin with the user's stored lastLoginAt | Page-level identification (`/`) updates login stats, passing the previous login time |
| identifyRegisteredUser does NOT call updateLastLogin | API-level identification does not update login stats |
| identifyAdmin does NOT call updateLastLogin | Admin-level identification does not update login stats |
| multiple API calls via identifyRegisteredUser do not inflate loginCount | Repeated API identifications never call `updateLastLogin` |
| minimum gap between distinct logins is one day | Pins `LOGIN_COUNT_MIN_GAP_MS` to `1 * DAY_IN_MS` |
| requests within the gap belong to the same login | Same-visit requests do not count as new logins |
| a request after the gap counts as a new distinct login | A return after the inactivity gap increments `loginCount` |
| a missing previous login timestamp counts as a distinct login | Absent `lastLoginAt` defaults to counting the login |

## Test Count Summary

| Category | Tests |
|----------|-------|
| Connection | 9 |
| Room | 9 |
| Object | 8 |
| Voxel | 9 |
| Single-Player | 10 |
| Player Mesh Composition | 16 |
| Signals | 6 |
| Permissions | 5 |
| Extended Permissions | 16 |
| State Persistence | 9 |
| Race Conditions | 26 |
| Property-Based | 17 |
| Room Ownership | 7 |
| Room API | 12 |
| Authentication Lifecycle | 20 |
| **Total** | **179** |
