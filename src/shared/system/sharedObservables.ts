import VoxelQuadChange from "../voxel/types/voxelQuadChange";
import LogEvent from "./types/logEvent";
import Observable from "./types/observable";

//--------------------------------------------------------------------------------
// Core
//--------------------------------------------------------------------------------

// This observable notifies its listeners whenever a log event is emitted.
export const logEventObservable = new Observable<LogEvent>();

//--------------------------------------------------------------------------------
// Gameplay
//--------------------------------------------------------------------------------

// This observable notifies its listeners whenever a room's voxelGrid needs to be modified.
export const voxelQuadChangeObservable = new Observable<VoxelQuadChange>();