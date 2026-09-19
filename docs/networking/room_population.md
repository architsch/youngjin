# Room Population Flows

Reference: @src/shared/system/sharedConstants.ts , @src/server/room/serverRoomManager.ts , @src/server/room/util/roomPickerUtil.ts , @src/server/room/util/hubRoomUtil.ts , @src/shared/room/types/roomChangeRejectedSignal.ts

Every player in a room costs every other client in it (a mesh-pool slice, plus physics and sync work). Room population is bounded by a hard cap — the Player category's per-room cap in `ObjectCategoryConfigMap` — and hubs are load-balanced so they rarely approach it.

## Population bands
- **Under-populated** (≤ `ROOM_UNDER_POPULATION_THRESHOLD`): too empty to be worth visiting.
- **Medium**: healthy.
- **Over-populated** (≥ `ROOM_OVER_POPULATION_THRESHOLD`): route new users elsewhere if possible.
- **Almost full**: admits nobody. A margin below the cap absorbs joins that are already in flight.

Capacity checks and registration are separated by async work, so a burst of joins can exceed the cap. The cap is a target rather than an invariant. When instance pools run dry, parts that cannot get an instance are left undrawn until one frees up.

## Choosing a destination
![Room Join Flow](figures/room_join_flow.jpg)

`RoomPickerUtil` decides where the user goes, and `ServerRoomManager` decides whether they may enter. When the user names no room, the picker takes the URL room, then the last room, then the hub balancer. The `hub` keyword (in a URL or on a door) goes straight to the balancer. Where the user lands inside the room is decided by its doors ([room_entrance.md](../geometry/room_entrance.md)).

## Picking a hub
All hubs are kept in memory, so balancing needs no DB query. Almost-full hubs are excluded, then:
- **All over-populated** (or no hubs at all): a new hub is created. Concurrent callers share a single creation. If creation fails, the user goes to the emptiest hub that still accepts players.

  ![Over-Populated Hub Logic](figures/over_populated_room_logic.jpg)
- **Some under-populated**: fill **one** of them (lowest room id) until it passes the threshold, so hubs become meeting places instead of many near-empty rooms.

  ![Under-Populated Hub Logic](figures/under_populated_room_logic.jpg)
- **All medium**: the emptiest hub.

  ![Medium-Populated Hub Logic](figures/medium_populated_room_logic.jpg)

## Entering a room
- A room change is flagged as **user-picked** (a door, or the user's own room), which is refused if the room cannot be entered, or **server-routed** (last room, URL, hub keyword), which falls back to a hub. "Cannot be entered" means almost full or failing to load.
- `ServerRoomManager` vets the destination **before** leaving the current room, so a refused user stays where they are. The user's own slot does not count against a room they re-enter.
- A refusal sends `RoomChangeRejectedSignal` with a `RoomChangeRejectionReason`. This releases the client's loading screen and shows a notification.

## Hub residency
Regular rooms unload when empty. Hubs are preloaded at startup (`HubRoomUtil`) and stay in memory for balancing.
