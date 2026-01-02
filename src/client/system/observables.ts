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

// Core

export const ongoingProcessesObservable = new ObservableMap<ClientProcess>();

// Graphics & UI

export const voxelQuadSelectionObservable = new Observable<VoxelQuadSelection | null>(null);
export const numActiveTextInputsObservable = new Observable<number>(0);

// Networking

export const roomRuntimeMemoryObservable = new Observable<RoomRuntimeMemory>();
export const objectSyncObservable = new Observable<ObjectSyncParams>();
export const objectDesyncResolveObservable = new Observable<ObjectDesyncResolveParams>();
export const objectSpawnObservable = new Observable<ObjectSpawnParams>();
export const objectDespawnObservable = new Observable<ObjectDespawnParams>();
export const objectMessageObservable = new Observable<ObjectMessageParams>();
export const updateVoxelGridObservable = new Observable<UpdateVoxelGridParams>();
