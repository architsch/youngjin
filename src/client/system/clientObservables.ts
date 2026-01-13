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

// Core

export const ongoingClientProcessesObservable = new ObservableMap<ClientProcess>();

// Graphics & UI

export const voxelQuadSelectionObservable = new Observable<VoxelQuadSelection | null>(null);
export const numActiveTextInputsObservable = new Observable<number>(0);
export const playerViewTargetPosObservable = new Observable<THREE.Vector3 | null>(null);

// Networking

export const roomRuntimeMemoryObservable = new Observable<RoomRuntimeMemory>();
export const objectSyncObservable = new Observable<ObjectSyncParams>();
export const objectDesyncResolveObservable = new Observable<ObjectDesyncResolveParams>();
export const objectSpawnObservable = new Observable<ObjectSpawnParams>();
export const objectDespawnObservable = new Observable<ObjectDespawnParams>();
export const objectMessageObservable = new Observable<ObjectMessageParams>();
export const updateVoxelGridObservable = new Observable<UpdateVoxelGridParams>();

//------------------------------------------------------------------------------
// Internal communication between observables
//------------------------------------------------------------------------------

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