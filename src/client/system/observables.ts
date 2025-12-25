import ObjectDespawnParams from "../../shared/object/types/objectDespawnParams";
import ObjectDesyncResolveParams from "../../shared/object/types/objectDesyncResolveParams";
import ObjectMessageParams from "../../shared/object/types/objectMessageParams";
import ObjectSpawnParams from "../../shared/object/types/objectSpawnParams";
import ObjectSyncParams from "../../shared/object/types/objectSyncParams";
import RoomRuntimeMemory from "../../shared/room/types/roomRuntimeMemory";
import Observable from "../../shared/system/types/observable";
import ObservableMap from "../../shared/system/types/observableMap";
import VoxelCubeAddParams from "../../shared/voxel/types/voxelCubeAddParams";
import VoxelCubeChangeYParams from "../../shared/voxel/types/voxelCubeChangeYParams";
import VoxelCubeRemoveParams from "../../shared/voxel/types/voxelCubeRemoveParams";
import VoxelTextureChangeParams from "../../shared/voxel/types/voxelTextureChangeParams";
import VoxelQuadSelection from "../graphics/types/gizmo/voxelQuadSelection";
import ClientProcess from "./types/clientProcess";

// Core

export const ongoingProcessesObservable = new ObservableMap<ClientProcess>();

// Graphics & UI

export const voxelQuadSelectionObservable = new Observable<VoxelQuadSelection | null>(null);

// Networking

export const roomRuntimeMemoryObservable = new Observable<RoomRuntimeMemory>();
export const objectSyncObservable = new Observable<ObjectSyncParams>();
export const objectDesyncResolveObservable = new Observable<ObjectDesyncResolveParams>();
export const objectSpawnObservable = new Observable<ObjectSpawnParams>();
export const objectDespawnObservable = new Observable<ObjectDespawnParams>();
export const objectMessageObservable = new Observable<ObjectMessageParams>();
export const voxelCubeChangeYObservable = new Observable<VoxelCubeChangeYParams>();
export const voxelCubeAddObservable = new Observable<VoxelCubeAddParams>();
export const voxelCubeRemoveObservable = new Observable<VoxelCubeRemoveParams>();
export const voxelTextureChangeObservable = new Observable<VoxelTextureChangeParams>();