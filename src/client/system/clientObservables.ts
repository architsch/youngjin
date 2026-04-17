import * as THREE from "three";
import RoomRuntimeMemory from "../../shared/room/types/roomRuntimeMemory";
import Observable from "../../shared/system/types/observable";
import ObservableMap from "../../shared/system/types/observableMap";
import VoxelQuadSelection from "../graphics/types/gizmo/voxelQuadSelection";
import ObjectSelection from "../graphics/types/gizmo/objectSelection";
import ClientProcess from "./types/clientProcess";
import { UserRole, UserRoleEnumMap } from "../../shared/user/types/userRole";

//--------------------------------------------------------------------------------
// Core Observables
//--------------------------------------------------------------------------------

// This observable notifies its listeners whenever the client app's update loop runs
// (i.e. each tick inside the "update" function of "src/client/app.ts").
// Each loop's deltaTime will be passed as the observable's "number" property.
export const updateObservable = new Observable<number>();

// This observable notifies its listeners whenever a new clientProcess begins
// or an existing clientProcess ends.
// A "clientProcess" is any asynchronous routine which is supposed to block the app's
// normal mode of operation by showing the "Loading..." indicator over the whole screen.
export const ongoingClientProcessesObservable = new ObservableMap<ClientProcess>();

// This observable notifies its listeners whenever the user's connectionState changes.
// The user's "connectionState" tells us the state of the user's socket connection
// (See 'socketsClient.ts' for details).
export const connectionStateObservable = new Observable<string>();

// This observable notifies its listeners whenever the current room
// is fully loaded on the client side.
export const roomChangedObservable = new Observable<RoomRuntimeMemory>();

//--------------------------------------------------------------------------------
// Graphics & UI Observables
//--------------------------------------------------------------------------------

// This observable notifies its listeners whenever the user selects or unselects a voxelQuad.
// A "voxelQuad" is one of the 6 sides of a hexagonal volume in space called "voxelBlock".
// Each voxel consists of a stack of voxelBlocks.
export const voxelQuadSelectionObservable = new Observable<VoxelQuadSelection | null>(null);

// This observable notifies its listeners whenever the user selects or unselects an object.
export const objectSelectionObservable = new Observable<ObjectSelection | null>(null);

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

// This observable notifies its listeners whenever a brief notification message
// should be displayed to the user (e.g. error messages, status updates).
export const notificationMessageObservable = new Observable<string | null>(null);

//--------------------------------------------------------------------------------
// User State Observables
//--------------------------------------------------------------------------------

// This observable notifies its listeners whenever the current user's role
// in the current room changes (e.g. from Visitor to Editor, or vice versa).
export const userRoleObservable = new Observable<UserRole>(UserRoleEnumMap.Visitor);

// This observable tracks the current room's latest texture pack path.
// It is updated whenever a room loads or the current room's texture pack changes.
export const texturePackPathObservable = new Observable<string>();