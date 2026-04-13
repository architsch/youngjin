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

## Room Management (`room.test.ts`) — 8 tests

| Test | What it verifies |
|------|-----------------|
| Join unloaded room | Room loads from DB on first join |
| Join already-loaded room | Second user joins without reloading |
| Join non-existent room | Graceful failure, no crash |
| Cross-user visibility | Users in same room see each other's player objects |
| Multi-room independence | Users in different rooms don't see each other |
| Room switch saves state | Previous room state saved on room change |
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

## Property-Based Tests (`property-based.test.ts`) — 13 tests

### No-Latency Profiles (7 tests)

| Profile | Weights | Users | Actions | Runs |
|---------|---------|-------|---------|------|
| balanced | connect:2 disconnect:2 join:3 move:3 msg:1 voxel:1 | 10 | 50 | 30 |
| connect-heavy | connect:5 disconnect:1 join:3 | 10 | 40 | 30 |
| disconnect-heavy | connect:2 disconnect:5 join:2 | 10 | 40 | 30 |
| room-switch-heavy | connect:1 disconnect:1 join:6 move:3 | 10 | 40 | 30 |
| voxel-heavy | connect:2 disconnect:1 join:2 move:1 addVoxel:4 removeVoxel:2 | 8 | 40 | 20 |
| reconnect-heavy | connect:2 disconnect:1 join:3 move:2 reconnA:2 reconnB:2 | 8 | 30 | 15 |
| Clean state after all disconnect | balanced weights | 10 | 50 | 30 |

### With-Latency Profiles (5 tests)
Same profiles as above (except reconnect-heavy) with reduced parameters:
- Max users: min(profile, 6)
- Max actions: min(profile, 20)
- Num runs: min(profile, 15)
- DB latency: 0-3ms random

### State Persistence (1 test)
- Saved gameplay state matches last known in-room state after random action sequences

## Test Count Summary

| Category | Tests |
|----------|-------|
| Connection | 8 |
| Room | 8 |
| Object | 8 |
| Voxel | 7 |
| Signals | 6 |
| Permissions | 5 |
| Race Conditions | 19 |
| Property-Based | 13 |
| **Total** | **74** |
