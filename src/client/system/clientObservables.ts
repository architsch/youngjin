import * as THREE from "three";
import RoomRuntimeMemory from "../../shared/room/types/roomRuntimeMemory";
import Observable from "../../shared/system/types/observable";
import ObservableMap from "../../shared/system/types/observableMap";
import ObservableSet from "../../shared/system/types/observableSet";
import VoxelQuadSelection from "../graphics/types/gizmo/voxelQuadSelection";
import ObjectSelection from "../graphics/types/gizmo/objectSelection";
import PlayerSelection from "../graphics/types/gizmo/playerSelection";
import ManualEditKind from "../../shared/system/types/manualEditKind";
import ClientProcess from "./types/clientProcess";
import GameMode from "./types/gameMode";
import { UserRole, UserRoleEnumMap } from "../../shared/user/types/userRole";
import PopupState from "../ui/types/popupState";
import CoachMark from "../ui/types/coachMark";
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

// This observable notifies its listeners whenever the browser has taken the WebGL drawing context
// away and then handed it back — which is what a mobile browser does to a tab it has been keeping
// in the background. The renderer rebuilds everything the scene itself describes without help; what
// it cannot bring back is anything the app drew straight onto the GPU and kept no copy of (i.e. into
// a render target), so whoever drew into one draws it again upon being notified here. The value
// counts how many restorations there have been, which is of no interest beyond telling them apart.
export const graphicsContextRestoredObservable = new Observable<number>(0);

// This observable notifies its listeners whenever the user selects or unselects an object.
export const objectSelectionObservable = new Observable<ObjectSelection | null>(null);

// This observable notifies its listeners whenever the user selects or unselects his/her own player
// character. Selecting it is how the user asks to work on his/her own look, so this is also what
// puts the player-customization form on screen and takes it away again.
export const playerSelectionObservable = new Observable<PlayerSelection | null>(null);

// Which mode the user is currently playing in (see GameMode). Modes are entered and left
// deliberately, by GameModeUtil, and everything that differs between them — the camera, the player's
// freedom to move, which controls are on screen — follows from this one value.
// It is held here rather than read back out of the camera, because the two are not the same
// statement: the camera says where it is looking from, which a selection being swapped for another
// may leave momentarily unanswered, while this says what the user is doing — and that does not
// waver in between.
export const gameModeObservable = new Observable<GameMode>("play");

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

// The DOM element id that the 2D on-screen arrow should point at, or null to hide it.
// "arrowSide" is which side of the target the arrow sits on (and therefore which way it points):
// above it pointing down by default, or below it pointing up — which is what a target at the very
// top of the screen needs, there being no room above it for an arrow.
export const screenArrowTargetObservable = new Observable<{targetElementId: string,
    arrowBias: "center" | "left" | "right", arrowSide: "above" | "below"} | null>(null);

// The DOM element id that the 2D on-screen rectangular outline should surround, or null to hide it.
export const screenOutlineRectTargetObservable = new Observable<string | null>(null);

// Every coach mark (a short message pointing at a UI element, identified by its DOM element id)
// that is currently on screen. Several may be up at once, so a mark appearing joins this list
// instead of replacing it — a mark cut short by a newer one would be guidance the user never got
// to read. A mark stays on the list until it is taken off (see FTUEUtil): either by the user going
// through the feature it advertises, or by the UI that put it there once the control it points at
// is gone or beyond use.
export const screenCoachMarksObservable = new Observable<CoachMark[]>([]);

// The vector-graphics diagram (with its caption) to show on screen, or null to hide it.
// "diagram" selects which built-in drawing the ScreenDiagram component renders, and "placement"
// says whether it takes the middle of the screen or steps aside to its edge, drawn small, for a
// gesture the user is meant to perform while watching something else.
export const screenDiagramObservable = new Observable<
    { diagram: "drag_up" | "drag_sideways", text: string, placement: "center" | "side" } | null>(null);

// The world-space XZ location the navigation arrow should guide the player toward, or null to hide it.
export const navigationArrowTargetObservable = new Observable<{ x: number, z: number } | null>(null);

// The world-space location the downward arrow should point at, or null to hide it.
export const downwardArrowTargetObservable = new Observable<THREE.Vector3 | null>(null);

// The voxel-quad whose boundary should be highlighted in world space, or null to hide it.
export const voxelQuadHighlightObservable = new Observable<VoxelQuadSelection | null>(null);

// This observable notifies its listeners whenever a popup needs to be opened/closed.
export const popupStateObservable = new Observable<PopupState>({ popupType: "none" });

// This observable notifies its listeners whenever the user's player camera switches modes (e.g. from
// the normal first-person view to the pulled-back orbit view shown while inspecting one's character
// or whatever is currently selected). The orbit's target travels with the mode, so pointing the
// camera at something else is the same kind of change as switching modes.
// The camera framing (PlayerCamera) and the visibility of the user's own body (PlayerGameObject)
// both follow it.
export const cameraModeObservable = new Observable<CameraMode>({type: "firstPerson"});

// How far the orbit mode's zoom is currently pushed: 0 is as far back as the mode allows, and 1 is
// as close in as it allows. Every way the user has of zooming works through this one value — the
// wheel and the pinch write it as they are read, and the on-screen slider both shows it and sets it
// — so the slider tells the truth about the view however the view was last changed.
// What distance it amounts to is OrbitCameraPose's to answer, and deliberately not published here:
// the zoom is a position within a range measured against how far back the target has to be seen
// from, so the same value means a different distance for a character than for a wall block.
// Starts in the middle, which is the distance the mode would frame a target at unasked; an orbit
// beginning overwrites it with the view the user already had of what he pointed the camera at.
export const orbitCameraZoomObservable = new Observable<number>(0.5);

// Which way the orbit mode currently views its target from, in world space: "azimuth" is the angle
// around the vertical axis and "polar" the angle away from straight up, both in radians. Read and
// written by OrbitCameraPose exactly as the zoom above is, so that pointing the camera somewhere is
// the same kind of act whoever performs it — the user's drag, or a scripted step setting up a view
// it wants the user to start from.
export const orbitCameraAnglesObservable = new Observable<{azimuth: number, polar: number}>(
    {azimuth: 0, polar: 0.5 * Math.PI});

// This observable notifies its listeners whenever ChatTextInput's input text changes.
export const chatTextInputObservable = new Observable<string>("");

// How many edits of each kind the user has made by hand since entering the current room. Only the
// user's own doing is counted here — never an edit arriving from the server — so that whoever asks
// is asking about the user rather than about the room (see ManualEditKind).
export const manualEditCountsObservable = new Observable<{[kind in ManualEditKind]: number}>({
    voxelBlockAdded: 0,
    voxelBlockRemoved: 0,
    voxelQuadTextureChanged: 0,
    playerPartChanged: 0,
});

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