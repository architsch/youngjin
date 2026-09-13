import ColliderDebugBox from "../physics/types/colliderDebugBox";
import VoxelQuadChange from "../voxel/types/voxelQuadChange";
import LogEvent from "./types/logEvent";
import Observable from "./types/observable";
import ObservableMap from "./types/observableMap";

// Core

// This observable notifies its listeners whenever a log event is emitted.
export const logEventObservable = new Observable<LogEvent>();

// Gameplay

// This observable notifies its listeners whenever a room's voxelGrid needs to be modified.
export const voxelQuadChangeObservable = new Observable<VoxelQuadChange>();

// Fires with a room id when its restricted zones are replaced (listeners read the room's own list).
export const restrictedZonesChangedObservable = new Observable<string>("");

// Fires with a room id when its prefs are replaced (listeners read the room's own string).
export const roomPrefsChangedObservable = new Observable<string>("");

// Debug

// This observable holds whether collider debug gizmos are enabled.
export const colliderDebugEnabledObservable = new Observable<boolean>(false);

// Fills DestinationChooserForm with dummy entries to test scrolling.
export const roomListDebugEnabledObservable = new Observable<boolean>(false);

// Fills ImageListChooserForm with dummy entries to test pagination and scrolling.
export const imageListChooserDebugEnabledObservable = new Observable<boolean>(false);

// Collider debug boxes by id (tryAdd / tryRemove).
export const colliderDebugBoxMap = new ObservableMap<ColliderDebugBox>();