import * as THREE from "three";
import RoomRuntimeMemory from "../../shared/room/types/roomRuntimeMemory";
import Observable from "../../shared/system/types/observable";
import ObservableMap from "../../shared/system/types/observableMap";
import ObservableSet from "../../shared/system/types/observableSet";
import VoxelQuadSelection from "../graphics/types/gizmo/voxelQuadSelection";
import ObjectSelection from "../graphics/types/gizmo/objectSelection";
import Vec3 from "../../shared/math/types/vec3";
import ClientProcess from "./types/clientProcess";
import GameMode from "./types/gameMode";
import PopupState from "../ui/types/popupState";
import CoachMark from "../ui/types/coachMark";
import CameraMode from "../graphics/types/cameraMode";
import { FeatureFlag } from "../../shared/system/types/featureFlag";

// Core Observables

// Fires each update loop tick with deltaTime.
export const updateObservable = new Observable<number>();

// ClientProcesses: async routines that block the app behind the full-screen loading indicator.
export const ongoingClientProcessesObservable = new ObservableMap<ClientProcess>();

// Global feature flags (switches).
export const clientFeatureFlagsObservable = new ObservableSet<FeatureFlag>();

// Socket connection state (see socketsClient.ts).
export const connectionStateObservable = new Observable<string>();

// Fires when the current room has fully loaded.
export const roomChangedObservable = new Observable<RoomRuntimeMemory>();

// Graphics & UI Observables

// Selected voxel quad (one face of a voxel block), or null.
export const voxelQuadSelectionObservable = new Observable<VoxelQuadSelection | null>(null);

// The one quad a scripted step lets the user select, or null for no such restriction. Narrower than the
// selection lock, which refuses every quad (see VoxelQuadSelection.trySelect).
export const voxelQuadSelectionRestrictionObservable = new Observable<number | null>(null);

// Fires after a lost WebGL context is restored. Anything drawn only into render targets must redraw.
export const graphicsContextRestoredObservable = new Observable<number>(0);

// Selected object (including the user's own character), or null.
export const objectSelectionObservable = new Observable<ObjectSelection | null>(null);

// Current game mode (see GameModeUtil). Stored separately from camera state, which can briefly lack a
// target during selection swaps.
export const gameModeObservable = new Observable<GameMode>("play");

// A scripted step's own choice of what edit mode opens on: selects it and returns whether it did, or null
// for the usual opening (see GameModeUtil.enterEditMode).
export const editModeOpeningOverrideObservable = new Observable<(() => boolean) | null>(null);

// Number of focused UI inputs; 0 means game input is free.
export const numActiveInputElementsObservable = new Observable<number>(0);

// Brief notification message (errors, status).
export const notificationMessageObservable = new Observable<string | null>(null);

// Headline message (e.g. tutorial instructions).
export const headlineMessageObservable = new Observable<string | null>(null);

// Target element for the 2D arrow, or null. arrowSide "below" is for targets at the top of the screen.
export const screenArrowTargetObservable = new Observable<{targetElementId: string,
    arrowBias: "center" | "left" | "right", arrowSide: "above" | "below"} | null>(null);

// The DOM element id that the 2D on-screen rectangular outline should surround, or null to hide it.
export const screenOutlineRectTargetObservable = new Observable<string | null>(null);

// Target element for the capsule outline, or null. thicknessPx allows lighter lines on small controls.
export const screenOutlineCapsuleTargetObservable = new Observable<{targetElementId: string,
    thicknessPx: number} | null>(null);

// All visible coach marks. New marks join rather than replace; removal is handled by FTUEUtil.
export const screenCoachMarksObservable = new Observable<CoachMark[]>([]);

// Diagram (and caption) to show, or null. placement "edge" draws it small beside the action.
export const screenDiagramObservable = new Observable<
    { diagram: "drag_up" | "drag_sideways", text: string, placement: "center" | "side" } | null>(null);

// The world-space XZ location the navigation arrow should guide the player toward, or null to hide it.
export const navigationArrowTargetObservable = new Observable<{ x: number, z: number } | null>(null);

// The world-space location the downward arrow should point at, or null to hide it.
export const downwardArrowTargetObservable = new Observable<THREE.Vector3 | null>(null);

// The voxel-quad whose boundary should be highlighted in world space, or null to hide it. It also
// decides whether the marks are shown at all (see GenericWorldSpaceGizmos).
export const voxelQuadHighlightObservable = new Observable<VoxelQuadSelection | null>(null);

// This observable notifies its listeners whenever a popup needs to be opened/closed.
export const popupStateObservable = new Observable<PopupState>({ popupType: "none" });

// Camera mode, including the orbit target. Drives PlayerCamera and own-body visibility.
export const cameraModeObservable = new Observable<CameraMode>({type: "firstPerson"});

// Whether a scripted step hides the user's own character and its speech bubble, whatever the camera does.
// Hidden parts are parked out of the room, so raycasts pass through them too.
export const myPlayerHiddenObservable = new Observable<boolean>(false);

// A point the orbit camera is held on regardless of selection (scripted steps), or null. Framed like a
// selected block (see WorldSpaceSelectionUtil).
export const orbitCameraTargetOverrideObservable = new Observable<Vec3 | null>(null);

// Orbit zoom position (0 = far, 1 = near) shared by wheel, pinch and slider. The actual distance
// depends on the target (see OrbitCameraPose). An orbit starting overwrites the initial value.
export const orbitCameraZoomObservable = new Observable<number>(0.5);

// Orbit view angles in world space (radians; polar measured from straight up), written by OrbitCameraPose.
export const orbitCameraAnglesObservable = new Observable<{azimuth: number, polar: number}>(
    {azimuth: 0, polar: 0.5 * Math.PI});

// A requested orbit view (angles + zoom), or null once applied. A request rather than a direct write,
// because re-framing would overwrite it; PlayerCamera applies it after framing.
export const orbitCameraViewRequestObservable =
    new Observable<{azimuth: number, polar: number, zoomAmount: number} | null>(null);

// A requested range for the orbit camera's distance from its target, or null once applied. Applied after
// framing, like orbitCameraViewRequestObservable.
export const orbitCameraDistanceRangeRequestObservable =
    new Observable<{min: number, max: number} | null>(null);

// This observable notifies its listeners whenever ChatTextInput's input text changes.
export const chatTextInputObservable = new Observable<string>("");

// User State Observables

// Current texture pack URL. "" = none applied yet, so the first real URL registers as a change.
export const texturePackURLObservable = new Observable<string>("");

// Current single-player mode and step. Updated on env load, when the user's mode changes, and by
// SinglePlayerManager on step changes.
export const singlePlayerObservable = new Observable<{mode: string, step: string}>({mode: "", step: ""});