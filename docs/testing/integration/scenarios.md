# Test Scenario Coverage

This document catalogs all integration test scenarios organized by category.

## Connection Lifecycle (`connection.test.ts`) — 8 tests

| Test | What it verifies |
|------|-----------------|
| Basic connect | User appears in `ServerUserManager.socketUserContexts` |
| Disconnect with save | Gameplay state saved to DB mock |
| Disconnect without save | No gameplay state saved |
| Case A reconnect | New socket before old disconnect: state preserved, player object restored |
| Case B reconnect | Old disconnect before new socket: state preserved, player object restored |
| Rapid connect/disconnect | 20 cycles: invariants hold, clean state after all disconnect |
| Gameplay state extraction | `getUserGameplayState` returns correct position/direction |
| Position persistence | User position survives disconnect + rejoin to same room |

## Room Management (`room.test.ts`) — 9 tests

| Test | What it verifies |
|------|-----------------|
| Join unloaded room | Room loads from DB on first join |
| Join already-loaded room | Second user joins without reloading |
| Join non-existent room | Graceful failure, no crash |
| Cross-user visibility | Users in same room see each other's player objects |
| Multi-room independence | Users in different rooms don't see each other |
| Room switch saves state | Previous room state saved on room change |
| requestRoomChange saves state | `onRequestRoomChangeSignalReceived` (the signal handler used by `visitMyRoomForm`) persists gameplay state from the previous room to the DB |
| Room unloads when empty | Room removed from memory after last user leaves |
| Graceful shutdown | All rooms saved and unloaded, all users disconnected |

## Object Management (`object.test.ts`) — 8 tests

| Test | What it verifies |
|------|-----------------|
| Player spawns at stored position | Transform matches `dbUserRoomStateUtil` data |
| Own transform update | Player can move their own character |
| Authority check | Cannot move another user's player object |
| Objects removed on leave | Player object cleaned up when user leaves room |
| Desync detection | Movement > 3 units triggers corrected broadcast to all |
| State-transform match | `getUserGameplayState` matches actual object transform |
| Saved state matches in-room | DB-saved state matches last known transform |
| Chat message delivery | `setObjectMetadataSignal` reaches room participants |

## Voxel Operations (`voxel.test.ts`) — 7 tests

| Test | What it verifies |
|------|-----------------|
| Add voxel block | Block placed at interior position |
| Remove voxel block | Block removed after add |
| Column build/remove | Build and tear down a 4-layer column |
| Mixed add/remove | 4 blocks placed, 2 diagonal removed, 2 remaining verified |
| Multi-layer blocks | Blocks at layers 0, 1, 3 (not 2) |
| Remove non-existent | Graceful handling, no crash |
| Duplicate add rejected | Second add to occupied layer is rejected |

## Signal Emission (`signals.test.ts`) — 6 tests

| Test | What it verifies |
|------|-----------------|
| Transform multicast | `setObjectTransformSignal` reaches all except sender |
| Voxel add multicast | `addVoxelBlockSignal` reaches all except sender |
| Rollback unicast | Failed voxel add sends `removeVoxelBlockSignal` only to sender |
| No cross-room leaks | Signal in room-A doesn't reach user in room-B |
| Chat message multicast | `setObjectMetadataSignal` reaches room participants |
| Desync broadcast | Desync correction reaches ALL participants (including sender) |

## Permissions (`permissions.test.ts`) — 5 tests

| Test | What it verifies |
|------|-----------------|
| Visitor cannot add voxels | Default role in Regular room is Visitor |
| Visitor gets rollback | Unauthorized add triggers `removeVoxelBlockSignal` |
| Hub allows all edits | Any user can edit voxels in Hub rooms |
| Owner can edit | Room owner has Owner role, can edit |
| Editor can edit | Promoted Editor can edit in Regular rooms |

## Extended Permissions (`permissions-extended.test.ts`) — 16 tests

### Voxel Operations × Roles Matrix (12 tests)
Parameterized over 4 voxel operations (addVoxel, removeVoxel, moveVoxel, setVoxelTexture) and 3 roles (Owner, Editor, Visitor):
- Owner and Editor succeed in Regular rooms
- Visitor gets rollback signal in Regular rooms

### Hub Permissions (1 test)
- Visitor can perform all voxel operations (add, setTexture, move, remove) in Hub rooms

### Mid-Session Role Changes (2 tests)
- Promoting Visitor to Editor enables voxel editing
- Demoting Editor to Visitor revokes voxel editing

### Cross-Room Role Behavior (1 test)
- User role resets to Visitor when switching to a different Regular room

## State Persistence (`state-persistence.test.ts`) — 9 tests

| Test | What it verifies |
|------|-----------------|
| Metadata persists across reconnect A | Player metadata (display name) survives Case A reconnection |
| Metadata persists across reconnect B | Player metadata survives Case B reconnection |
| Chat visible to all | Chat messages update metadata and are visible to other users |
| 5 consecutive reconnection cycles | User survives alternating Case A/B reconnections |
| Alternating reconnects with observers | Observer remains present during reconnection cycles |
| Voxels persist across empty room | Voxel blocks saved when all users leave |
| Voxels visible to new joiner | Blocks placed by one user are seen by newly joined user |
| Extended invariants | Physics room, physics object, and role consistency after mixed ops |
| Graceful shutdown multi-room | Shutdown preserves all user states across 3 rooms |

## Race Conditions (`race-conditions.test.ts`) — 19 tests

### RC1: Concurrent Joins to Unloaded Room (2 tests)
- Multiple users joining simultaneously share the same `loadRoom` promise (dedup)
- Concurrent joins under DB latency still dedup correctly

### RC2: Join During Leave (2 tests)
- New joiner prevents room from being unloaded during async save
- Stayers keep the room alive when others leave under latency

### RC3: Simultaneous Voxel Edits (3 tests)
- Two users adding to same position: one succeeds, one gets rollback
- One user adds while another removes: consistent final state
- Many users editing adjacent blocks concurrently

### RC4: Transform During Room Transition (1 test)
- Movement signals sent during room switch are handled gracefully

### RC5: Concurrent Disconnects (1 test)
- All gameplay states saved correctly despite concurrent disconnect

### RC6: Join/Leave Churn with Edits (1 test)
- Voxel edits succeed while users join and leave

### RC7: Reconnection During Operations (2 tests)
- Case A reconnect while other user is mid-move
- Case B reconnect while room is being edited

### RC8: Simultaneous Room Switches (2 tests)
- Multiple users switching rooms concurrently maintain consistent state
- Users cross-switching rooms under latency

### RC9: Parallel Room Loads (1 test)
- Different rooms load in parallel without interference

### RC10: Graceful Shutdown During Active Operations (2 tests)
- Shutdown while users are mid-movement
- Shutdown while voxel edits are in progress

### RC11: Latency Stress Tests (2 tests)
- Reconnect under latency: restored state visible to observers
- Join/leave churn under latency preserves stayer state

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
- DB latency: 0-3ms random

### State Persistence (1 test)
- Saved gameplay state matches last known in-room state after random action sequences

## Room Ownership (`room-ownership.test.ts`) — 7 tests

### Owner Enter/Exit (Scenario 3)

| Test | What it verifies |
|------|-----------------|
| Owner enters own room | Owner gets Owner role, room participant count correct |
| Owner exits own room | Room unloads, gameplay state saved with correct lastRoomID |

### Visitor Enter/Exit (Scenario 2)

| Test | What it verifies |
|------|-----------------|
| Visitor enters another's room | Both users in room, correct roles (Owner vs Visitor) |
| Visitor exits while owner stays | Room stays loaded, participant count decremented, visitor state saved |

### Room Switching (Scenario 12)

| Test | What it verifies |
|------|-----------------|
| Move from hub to own room | User ends up in own room with Owner role, hub unloads |
| Move between regular rooms | Source room unloads, destination room has both users |
| URL-style room navigation | Join by room ID works, source room unloads |

## Room API (`room-api.test.ts`) — 10 tests

### Create Room (Scenario 1)

| Test | What it verifies |
|------|-----------------|
| Registered user can create a room | Room created in DB, ownedRoomID set on user |
| Guest user cannot create a room | 403 returned for guest user type |
| User who already owns a room cannot create another | 409 returned for duplicate room |

### Set Room User Role / Appoint Editor (Scenario 4)

| Test | What it verifies |
|------|-----------------|
| Owner can appoint another user as editor | DB role set, in-memory sync called |
| Owner cannot change their own role | 400 returned for self-role change |
| User without a room cannot appoint editors | 403 returned |
| Owner can demote an editor back to visitor | Role changed to Visitor |

### Change Room Texture Pack (Scenario 9)

| Test | What it verifies |
|------|-----------------|
| Owner can change the texture pack | DB updated with new texture pack path |
| User without a room cannot change textures | 403 returned |
| Request without texturePackPath is rejected | 400 returned for missing field |

## Authentication Lifecycle (`auth-lifecycle.test.ts`) — 14 tests

### Google OAuth (Scenario 10)

| Test | What it verifies |
|------|-----------------|
| New user with existing guest session | Guest upgraded to member via `upgradeGuestToMember` |
| New user without guest session | New member created via `createUser` |
| Existing user signs in | Existing account used, orphaned guest deleted |
| No auth code provided | 400 returned with "code not found" |
| Token exchange fails | 500 returned with "access token" error |

### Stale Guest Cleanup (Scenario 11)

| Test | What it verifies |
|------|-----------------|
| deleteStaleGuestsByTier callable | Returns expected deletion count |
| Tier 0 (disposable) cleanup | Guests older than 3 days deleted |
| Tier 1 (casual) cleanup | Guests older than 7 days deleted |
| Tier 2 (dedicated) cleanup | Guests older than 30 days deleted |
| No stale guests | Returns 0 when nothing to clean |

### loginCount Accuracy (Scenario 12)

| Test | What it verifies |
|------|-----------------|
| identifyAnyUser calls updateLastLogin | Page-level identification (`/mypage`) increments `loginCount` |
| identifyRegisteredUser skips updateLastLogin | API-level identification (e.g. `/create_room`) does not increment `loginCount` |
| identifyAdmin skips updateLastLogin | Admin-level identification (e.g. `/console`) does not increment `loginCount` |
| Multiple API calls don't inflate loginCount | 5 sequential `identifyRegisteredUser` calls result in zero `updateLastLogin` invocations |

## Test Count Summary

| Category | Tests |
|----------|-------|
| Connection | 8 |
| Room | 9 |
| Object | 8 |
| Voxel | 7 |
| Signals | 6 |
| Permissions | 5 |
| Extended Permissions | 16 |
| State Persistence | 9 |
| Race Conditions | 19 |
| Property-Based | 17 |
| Room Ownership | 7 |
| Room API | 10 |
| Authentication Lifecycle | 14 |
| **Total** | **135** |
