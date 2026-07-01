import * as THREE from "three";
import RoomRuntimeMemory from "../../shared/room/types/roomRuntimeMemory";
import Observable from "../../shared/system/types/observable";
import ObservableMap from "../../shared/system/types/observableMap";
import ObservableSet from "../../shared/system/types/observableSet";
import VoxelQuadSelection from "../graphics/types/gizmo/voxelQuadSelection";
import ObjectSelection from "../graphics/types/gizmo/objectSelection";
import ClientProcess from "./types/clientProcess";
import { UserRole, UserRoleEnumMap } from "../../shared/user/types/userRole";
import PopupState from "../ui/types/popupState";
import CameraMode from "../graphics/types/cameraMode";
import { FeatureFlag } from "../../shared/system/types/featureFlag";

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

// This observable notifies its listeners whenever a feature flag
// either gets added to or removed from the client app.
// Feature flags serve as global control parameters (i.e. switches).
export const clientFeatureFlagsObservable = new ObservableSet<FeatureFlag>();

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

// This observable notifies its listeners whenever an input element (UI)
// either gets focused or unfocused.
// If the number of active inputs goes down to 0, it will imply that the user is
// currently not interacting with any input element and thus should be able to interact
// freely with the game's 3D environment (without interfering with the input's state).
export const numActiveInputElementsObservable = new Observable<number>(0);

// This observable notifies its listeners whenever the user's player changes its viewTarget.
// A "viewTarget" is the point in 3D space that is supposed to be the main focus of the
// player's vision, which means it should be clearly visible to the player's camera all the time.
export const playerViewTargetPosObservable = new Observable<THREE.Vector3 | null>(null);

// This observable notifies its listeners whenever a brief notification message
// should be displayed to the user (e.g. error messages, status updates).
export const notificationMessageObservable = new Observable<string | null>(null);

// This observable notifies its listeners whenever the headline message
// should be displayed to the user (e.g. tutorial instructions).
export const headlineMessageObservable = new Observable<string | null>(null);

// The DOM element id that the 2D on-screen arrow should point down at, or null to hide it.
export const screenArrowTargetObservable = new Observable<{targetElementId: string, arrowBias: "center" | "left" | "right"} | null>(null);

// The DOM element id that the 2D on-screen rectangular outline should surround, or null to hide it.
export const screenOutlineRectTargetObservable = new Observable<string | null>(null);

// The vector-graphics diagram (with its caption) to show centered on screen, or null to hide it.
// "diagram" selects which built-in drawing the ScreenDiagram component renders.
export const screenDiagramObservable = new Observable<{ diagram: "drag_up", text: string } | null>(null);

// The world-space XZ location the navigation arrow should guide the player toward, or null to hide it.
export const navigationArrowTargetObservable = new Observable<{ x: number, z: number } | null>(null);

// The world-space location the downward arrow should point at, or null to hide it.
export const downwardArrowTargetObservable = new Observable<THREE.Vector3 | null>(null);

// The voxel-quad whose boundary should be highlighted in world space, or null to hide it.
export const voxelQuadHighlightObservable = new Observable<VoxelQuadSelection | null>(null);

// This observable notifies its listeners whenever a popup needs to be opened/closed.
export const popupStateObservable = new Observable<PopupState>({ popupType: "none" });

// This observable notifies its listeners whenever the user's player camera switches modes (e.g. from
// the normal first-person view to the pulled-back self-view shown while customizing one's character).
// The camera framing (FirstPersonCamera) and the visibility of the user's own body (PlayerGameObject)
// both follow it.
export const cameraModeObservable = new Observable<CameraMode>("firstPerson");

// This observable notifies its listeners whenever ChatTextInput's input text changes.
export const chatTextInputObservable = new Observable<string>("");

//--------------------------------------------------------------------------------
// User State Observables
//--------------------------------------------------------------------------------

// This observable notifies its listeners whenever the current user's role
// in the current room changes (e.g. from Visitor to Editor, or vice versa).
// This observable gets updated whenever:
//      (1) Room gets loaded on the client side (i.e. "loadRoom" in app.ts), or
//      (2) Server signals the client that the user's role in the current room has changed (i.e. "onSetUserRoleSignalReceived" in app.ts)
export const userRoleObservable = new Observable<UserRole>(UserRoleEnumMap.Visitor);

// This observable tracks the current room's latest texture pack URL.
// It is updated whenever a room loads or the current room's texture pack changes.
// Defaults to "" (the "no pack applied yet" sentinel) so that the very first
// applyVoxelTexturePack call can peek() it without throwing and always detects a
// change against the first real URL.
export const texturePackURLObservable = new Observable<string>("");

// This observable notifies its listeners whenever the current user's
// singlePlayerMode or singlePlayerStep changes on the client side
// (either when the user data gets fetched from the server,
// or when the client either enters or exits a single-player mode game,
// or when the client's single-player system modifies the current client-side singlePlayerStep value).
// This observable gets updated whenever:
//      (1) Client-side env variables get loaded (i.e. "setEnv" in app.ts), or
//      (2) User's "singlePlayerMode" field value changes during runtime, or
//      (3) Client's single-player gameplay logic (singlePlayerManager.ts) decides to change the current step.
export const singlePlayerObservable = new Observable<{mode: string, step: string}>({mode: "", step: ""});