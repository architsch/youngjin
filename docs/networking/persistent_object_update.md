# Persistent Object Update Flows

Reference: @src/shared/object/types/update/updatePersistentObjectGroupParams.ts , @src/shared/object/util/persistentObjectUpdateUtil.ts

## Add Persistent Object
1. The client sends an `AddPersistentObjectParams` (with an objectId that the client computed on its own, based on the same objectId generation logic present on the server side) to the server via `VoxelQuadPersistentObjectOptions`. Immediately after this, the client also spawns a GameObject which corresponds to the added persistentObject.
2. The server receives the `AddPersistentObjectParams` and passes it over to `RoomPersistentObjectUtil`.
3. `RoomPersistentObjectUtil` compares the new objectId (which was computed on the server side) with the objectId found in the received `AddPersistentObjectParams`.
    - If the two objectIds match and all other add-conditions are satisfied:
        1. It means the addition of the persistentObject was successful (e.g. no race condition), so `RoomPersistentObjectUtil` broadcasts the received `AddPersistentObjectParams` to everyone (except the client who sent the `AddPersistentObjectParams`).
        2. Other clients (i.e. ones who didn't send the `AddPersistentObjectParams`) receive the `AddPersistentObjectParams` from the server and pass it over to `PersistentObjectManager`.
        3. `PersistentObjectManager` (of the other clients) proceeds to add the persistentObject described in `AddPersistentObjectParams` and also spawn a GameObject which corresponds to the added persistentObject.
    - If the two objectIds do NOT match or any other add-condition fails:
        1. It means there was a problem adding the persistentObject in a proper order, so `RoomPersistentObjectUtil` unicasts a `RemovePersistentObjectParams` back to the sender to let it know that the client-side addition of the persistentObject must be canceled.
        2. The client receives the `RemovePersistentObjectParams` from the server and passes it over to `PersistentObjectManager`.
        3. `PersistentObjectManager` proceeds to remove the persistentObject that was added on the client side (as well as its corresponding GameObject).

## Remove Persistent Object
1. The client sends a `RemovePersistentObjectParams` (with the objectId of the target persistentObject) to the server via `CanvasSelectionOptions`. Immediately after this, the client also optimistically removes the persistentObject and despawns its corresponding GameObject.
2. The server receives the `RemovePersistentObjectParams` and passes it over to `RoomPersistentObjectUtil`.
3. `RoomPersistentObjectUtil` attempts to remove the persistentObject via `PersistentObjectUpdateUtil.removePersistentObject`.
    - If removal succeeds:
        1. `RoomPersistentObjectUtil` broadcasts the received `RemovePersistentObjectParams` to everyone (except the client who sent it).
        2. Other clients receive the `RemovePersistentObjectParams` from the server and pass it over to `PersistentObjectManager`.
        3. `PersistentObjectManager` (of the other clients) proceeds to remove the persistentObject and despawn its corresponding GameObject.
    - If removal fails (e.g. the object no longer exists on the server):
        1. `RoomPersistentObjectUtil` unicasts an `AddPersistentObjectParams` back to the sender (using the captured pre-removal state of the object) to restore the client-side state.
        2. The client receives the `AddPersistentObjectParams` from the server and passes it over to `PersistentObjectManager`.
        3. `PersistentObjectManager` re-adds the persistentObject and re-spawns its corresponding GameObject, reverting the optimistic removal.

## Move Persistent Object
1. The client sends a `MovePersistentObjectParams` (with the objectId and displacement `dx`, `dy`, `dz`) to the server via `CanvasSelectionOptions`. Immediately after this, the client also optimistically applies the move to the persistentObject and updates the position/direction of its corresponding GameObject.
2. The server receives the `MovePersistentObjectParams` and passes it over to `RoomPersistentObjectUtil`.
3. `RoomPersistentObjectUtil` attempts to move the persistentObject via `PersistentObjectUpdateUtil.movePersistentObject`.
    - If the move succeeds:
        1. `RoomPersistentObjectUtil` broadcasts the received `MovePersistentObjectParams` to everyone (except the client who sent it).
        2. Other clients receive the `MovePersistentObjectParams` from the server and pass it over to `PersistentObjectManager`.
        3. `PersistentObjectManager` (of the other clients) applies the move to the persistentObject and updates the position/direction of its corresponding GameObject. It also deselects the object if it was selected locally.
    - If the move fails (e.g. position out of bounds, no wall support):
        1. `RoomPersistentObjectUtil` unicasts a `RemovePersistentObjectParams` followed by an `AddPersistentObjectParams` back to the sender (using the captured pre-move position/direction) to fully restore the client-side state.
        2. The client receives these params from the server and passes them over to `PersistentObjectManager`.
        3. `PersistentObjectManager` removes the persistentObject at its optimistically-moved position and re-adds it at the server's authoritative position/direction, then respawns the corresponding GameObject.

## Set Persistent Object Metadata
1. The client sends a `SetPersistentObjectMetadataParams` (with the objectId, metadataKey, and metadataValue) to the server via `CanvasSelectionOptions`. Immediately after this, the client also optimistically applies the metadata change to the persistentObject and updates the corresponding GameObject's metadata.
2. The server receives the `SetPersistentObjectMetadataParams` and passes it over to `RoomPersistentObjectUtil`.
3. `RoomPersistentObjectUtil` attempts to set the metadata via `PersistentObjectUpdateUtil.setPersistentObjectMetadata`.
    - If the update succeeds:
        1. `RoomPersistentObjectUtil` broadcasts the received `SetPersistentObjectMetadataParams` to everyone (except the client who sent it).
        2. Other clients receive the `SetPersistentObjectMetadataParams` from the server and pass it over to `PersistentObjectManager`.
        3. `PersistentObjectManager` (of the other clients) applies the metadata change to the persistentObject and updates the corresponding GameObject's metadata. It also deselects the object if it was selected locally.
    - If the update fails (e.g. object not found, metadata value too long):
        1. `RoomPersistentObjectUtil` unicasts a `SetPersistentObjectMetadataParams` back to the sender with the old metadata value (or an empty string if there was none) to revert the client-side change.
        2. The client receives the `SetPersistentObjectMetadataParams` from the server and passes it over to `PersistentObjectManager`.
        3. `PersistentObjectManager` reverts the metadata on the persistentObject and updates the corresponding GameObject's metadata back to the old value.