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

// This observable notifies its listeners, with the ID of the room in question, whenever a room's
// restricted zones have been replaced — however they arrived, and whether one was drawn, moved,
// resized or taken away. It carries the room rather than the zones themselves, so that whoever
// answers to it reads the room's own list rather than a copy of it that may already be behind.
export const restrictedZonesChangedObservable = new Observable<string>("");

//--------------------------------------------------------------------------------
// Debug
//--------------------------------------------------------------------------------

// This observable holds whether collider debug gizmos are enabled.
export const colliderDebugEnabledObservable = new Observable<boolean>(false);

// If this observable is enabled, DestinationChooserForm will be filled with a huge number of
// dummy room entries (to let the user test the list's scrolling behavior.)
export const roomListDebugEnabledObservable = new Observable<boolean>(false);

// If this observable is enabled, ImageListChooserForm will be filled with a huge number of paginated
// dummy image entries (to let the user test the list's pagination and scrolling behavior.)
export const imageListChooserDebugEnabledObservable = new Observable<boolean>(false);

// This observable map tracks collider debug boxes by unique ID.
// Add a box with tryAdd(id, box), remove with tryRemove(id).
export const colliderDebugBoxMap = new ObservableMap<ColliderDebugBox>();