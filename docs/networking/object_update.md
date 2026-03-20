# Object Update Flows

Reference: @src/shared/object/util/objectUpdateUtil.ts , @src/server/object/serverObjectManager.ts

## Add Object
1. The client sends an `AddObjectSignal` (with an objectId that the client computed on its own, based on the same objectId generation logic present on the server side) to the server via `VoxelQuadPersistentObjectOptions`. Immediately after this, the client also spawns a GameObject which corresponds to the added object.
2. The server receives the `AddObjectSignal` and passes it over to `ServerObjectManager.onAddObjectSignalReceived`.
3. `ServerObjectManager` compares the new objectId (which was computed on the server side) with the objectId found in the received `AddObjectSignal`.
    - If the two objectIds match and all other add-conditions are satisfied:
        1. It means the addition of the object was successful (e.g. no race condition), so `ServerObjectManager` broadcasts the received `AddObjectSignal` to everyone (except the client who sent it).
        2. Other clients receive the `AddObjectSignal` from the server and pass it over to `ClientObjectManager`.
        3. `ClientObjectManager` (of the other clients) proceeds to add the object described in `AddObjectSignal` and also spawn a GameObject which corresponds to the added object.
    - If the two objectIds do NOT match or any other add-condition fails:
        1. It means there was a problem adding the object in a proper order, so `ServerObjectManager` unicasts a `RemoveObjectSignal` back to the sender to let it know that the client-side addition must be canceled.
        2. The client receives the `RemoveObjectSignal` from the server and passes it over to `ObjectManager`.
        3. `ClientObjectManager` proceeds to remove the object that was added on the client side (as well as its corresponding GameObject).

## Remove Object
1. The client sends a `RemoveObjectSignal` (with the objectId of the target object) to the server via `CanvasSelectionOptions`. Immediately after this, the client also optimistically removes the object and despawns its corresponding GameObject.
2. The server receives the `RemoveObjectSignal` and passes it over to `ServerObjectManager.onRemoveObjectSignalReceived`.
3. `ServerObjectManager` attempts to remove the object.
    - If removal succeeds:
        1. `ServerObjectManager` broadcasts the received `RemoveObjectSignal` to everyone (except the client who sent it).
        2. Other clients receive the `RemoveObjectSignal` from the server and pass it over to `ClientObjectManager`.
        3. `ClientObjectManager` (of the other clients) proceeds to remove the object and despawn its corresponding GameObject.
    - If removal fails (e.g. the object no longer exists on the server):
        1. `ServerObjectManager` unicasts an `AddObjectSignal` back to the sender (using the captured pre-removal state of the object) to restore the client-side state.
        2. The client receives the `AddObjectSignal` from the server and passes it over to `ObjectManager`.
        3. `ClientObjectManager` re-adds the object and re-spawns its corresponding GameObject, reverting the optimistic removal.

## Set Object Transform
1. The client sends a `SetObjectTransformSignal` (with the objectId and the object's full absolute transform including position and direction) to the server. Canvas objects emit this signal via `CanvasWorldSpaceGizmos` when dragged. Player objects with an `objectTransformEmitter` component emit this signal continuously while the player is moving.
2. The server receives the `SetObjectTransformSignal` and passes it over to `ServerObjectManager.onSetObjectTransformSignalReceived`.
3. `ServerObjectManager.onSetObjectTransformSignalReceived` checks the object's type configuration to determine whether it has a `dynamicCollider` component:
    - **If the object has a `dynamicCollider`** (e.g. player objects):
        1. The server calls `PhysicsManager.trySetTransform`, which validates the new transform against physics constraints (collision detection) and returns a resolved position.
        2. If a desync is detected (the resolved position differs from the requested position):
            - The server broadcasts a `ResolveObjectTransformDesyncSignal` (with the server-authoritative resolved position) to **all** clients (including the sender).
            - All clients receive the signal and snap the object to the server-authoritative position.
        3. If no desync is detected:
            - The server broadcasts the `SetObjectTransformSignal` to everyone except the sender.
            - Other clients apply the transform update to the object.
    - **If the object does NOT have a `dynamicCollider`** (e.g. canvas objects):
        1. The server calls `PhysicsManager.forceSetTransform`, which directly places the object at the requested position without physics validation.
        2. The server marks the object as dirty (for DB persistence) and broadcasts the `SetObjectTransformSignal` to everyone except the sender.
        3. Other clients apply the transform update to the object.

## Set Object Metadata
1. The client sends a `SetObjectMetadataSignal` (with the objectId, metadataKey, and metadataValue) to the server via `CanvasSelectionOptions`. Immediately after this, the client also optimistically applies the metadata change to the object and updates the corresponding GameObject's metadata.
2. The server receives the `SetObjectMetadataSignal` and passes it over to `ServerObjectManager.onSetObjectMetadataSignalReceived`.
3. `ServerObjectManager` attempts to set the metadata via `ObjectUpdateUtil.setObjectMetadata`.
    - If the update succeeds:
        1. `ServerObjectManager` broadcasts the received `SetObjectMetadataSignal` to everyone (except the client who sent it).
        2. Other clients receive the `SetObjectMetadataSignal` from the server and pass it over to `ClientObjectManager`.
        3. `ClientObjectManager` (of the other clients) applies the metadata change to the object and updates the corresponding GameObject's metadata. It also deselects the object if it was selected locally.
    - If the update fails (e.g. object not found, metadata value too long):
        1. `ServerObjectManager` unicasts a `SetObjectMetadataSignal` back to the sender with the old metadata value (or an empty string if there was none) to revert the client-side change.
        2. The client receives the `SetObjectMetadataSignal` from the server and passes it over to `ObjectManager`.
        3. `ClientObjectManager` reverts the metadata on the object and updates the corresponding GameObject's metadata back to the old value.
