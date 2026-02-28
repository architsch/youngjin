import * as THREE from "three";
import ObjectDespawnParams from "../../shared/object/types/objectDespawnParams";
import ObjectDesyncResolveParams from "../../shared/object/types/objectDesyncResolveParams";
import ObjectMessageParams from "../../shared/object/types/objectMessageParams";
import ObjectSpawnParams from "../../shared/object/types/objectSpawnParams";
import ObjectSyncParams from "../../shared/object/types/objectSyncParams";
import RoomRuntimeMemory from "../../shared/room/types/roomRuntimeMemory";
import Observable from "../../shared/system/types/observable";
import ObservableMap from "../../shared/system/types/observableMap";
import VoxelQuadSelection from "../graphics/types/gizmo/voxelQuadSelection";
import ClientProcess from "./types/clientProcess";
import UpdateVoxelGridParams from "../../shared/voxel/types/update/updateVoxelGridParams";
import { getVoxelQuadTransformDimensions } from "../../shared/voxel/util/voxelQueryUtil";

//--------------------------------------------------------------------------------
// Core Observables
//--------------------------------------------------------------------------------

// This observable notifies its listeners whenever a new clientProcess begins
// or an existing clientProcess ends.
// A "clientProcess" is any asynchronous routine which is supposed to block the app's
// normal mode of operation by showing the "Loading..." indicator over the whole screen.
export const ongoingClientProcessesObservable = new ObservableMap<ClientProcess>();

//--------------------------------------------------------------------------------
// Graphics & UI Observables
//--------------------------------------------------------------------------------

// This observable notifies its listeners whenever the user selects or unselects a voxelQuad.
// A "voxelQuad" is one of the 6 sides of a hexagonal volume in space called "voxelBlock".
// Each voxel consists of a stack of voxelBlocks.
export const voxelQuadSelectionObservable = new Observable<VoxelQuadSelection | null>(null);

// This observable notifies its listeners whenever a text input element (UI) either gets
// focused or unfocused.
// If the number of active text inputs goes down to 0, it will imply that the user is
// currently not interacting with any text input element and thus should be able to interact
// freely with the game's 3D environment (without interfering with the text input state).
export const numActiveTextInputsObservable = new Observable<number>(0);

// This observable notifies its listeners whenever the user's player changes its viewTarget.
// A "viewTarget" is the point in 3D space that is supposed to be the main focus of the
// player's vision, which means it should be clearly visible to the player's camera all the time.
export const playerViewTargetPosObservable = new Observable<THREE.Vector3 | null>(null);

//--------------------------------------------------------------------------------
// Networking Observables
//--------------------------------------------------------------------------------

// This observable notifies its listeners whenever the user's connectionState changes.
// The user's "connectionState" tells us the state of the user's socket connection
// (See 'gameSockets.ts' for details).
export const connectionStateObservable = new Observable<string>();

// This observable notifies its listeners whenever the server sends the
// room's data (i.e. RoomRuntimeMemory) to the user who has joined to room.
// The user will then use this data to initialize the room on the client side.
export const roomRuntimeMemoryObservable = new Observable<RoomRuntimeMemory>();

// This observable notifies its listeners whenever the server broadcasts a change
// in the transform (e.g. position, direction) of an object that is owned by another user.
export const objectSyncObservable = new Observable<ObjectSyncParams>();

// This observable notifies its listeners whenever the server broadcasts an instance of desync
// in the transform (e.g. position, direction) of an object that is owned by another user.
export const objectDesyncResolveObservable = new Observable<ObjectDesyncResolveParams>();

// This observable notifies its listeners whenever the server spawns an object and broadcasts it.
// However, this excludes an object which is either:
//      (1) The user's own player object (which spawns right when the user joins the room), or
//      (2) An object which has already been existing in the room by the time the user joined the room,
export const objectSpawnObservable = new Observable<ObjectSpawnParams>();

// This observable notifies its listeners whenever the server despawns an object and broadcasts it.
export const objectDespawnObservable = new Observable<ObjectDespawnParams>();

// This observable notifies its listeners whenever the server broadcasts a message
// that was sent by another user's object.
export const objectMessageObservable = new Observable<ObjectMessageParams>();

// This observable notifies its listeners whenever the server broadcasts a change in the
// room's voxelGrid that was made by another user.
export const updateVoxelGridObservable = new Observable<UpdateVoxelGridParams>();

//--------------------------------------------------------------------------------
// Internal communication between observables
//--------------------------------------------------------------------------------

// If a voxelQuad is selected, the player's viewTarget should be the selected voxelQuad.
voxelQuadSelectionObservable.addListener("global", (selection: VoxelQuadSelection | null) => {
    if (selection)
    {
        const v = selection.voxel;
        const quadIndex = selection.quadIndex;
        const { offsetX, offsetY, offsetZ, dirX, dirY, dirZ, scaleX, scaleY, scaleZ } =
            getVoxelQuadTransformDimensions(v, quadIndex);
        playerViewTargetPosObservable.set(
            new THREE.Vector3(v.col + 0.5 + offsetX, offsetY, v.row + 0.5 * offsetZ)
        );
    }
    else
        playerViewTargetPosObservable.set(null);
});