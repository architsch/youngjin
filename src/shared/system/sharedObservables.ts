import ColliderDebugBox from "../physics/types/colliderDebugBox";
import VoxelQuadChange from "../voxel/types/voxelQuadChange";
import LogEvent from "./types/logEvent";
import Observable from "./types/observable";
import ObservableMap from "./types/observableMap";

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

//--------------------------------------------------------------------------------
// Debug
//--------------------------------------------------------------------------------

// This observable holds whether collider debug gizmos are enabled.
export const colliderDebugEnabledObservable = new Observable<boolean>(false);

// This observable map tracks collider debug boxes by unique ID.
// Add a box with tryAdd(id, box), remove with tryRemove(id).
export const colliderDebugBoxMap = new ObservableMap<ColliderDebugBox>();