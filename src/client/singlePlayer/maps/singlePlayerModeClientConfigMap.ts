import * as THREE from "three";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import SinglePlayerModeConfigMap from "../../../shared/singlePlayer/maps/singlePlayerModeConfigMap";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, COLLISION_LAYER_NULL, NEAR_EPSILON,
    TUTORIAL_SINGLE_PLAYER_MODE } from "../../../shared/system/sharedConstants";
import { FeatureFlag } from "../../../shared/system/types/featureFlag";
import Voxel from "../../../shared/voxel/types/voxel";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import App from "../../app";
import GraphicsManager from "../../graphics/graphicsManager";
import ClientObjectManager from "../../object/clientObjectManager";
import { orbitCameraAnglesObservable } from "../../system/clientObservables";
import SinglePlayerManager from "../singlePlayerManager";
import SinglePlayerAction from "../types/singlePlayerAction";
import SinglePlayerModeClientConfig from "../types/singlePlayerModeClientConfig";
import SinglePlayerStep from "../types/singlePlayerStep";
import { ClientEventType } from "../../system/types/clientEventType";

const cachedStepsByMode: {[singlePlayerMode: string]: {[stepName: string]: SinglePlayerStep}} = {};

// How far the user has to swing the camera around before he is taken to have discovered that he can.
const TUTORIAL_CAMERA_TURN_DEG = 20;

// The view the camera is put in while the user is asked to pick out a patch of floor: high enough
// above it to look down on the ground rather than along it, and turned off the room's own axes so
// that the patch reads as a square of floor instead of as a line. Far enough back for the outline
// drawn around it to sit among its surroundings, which is what the user has to pick it out from.
const FLOOR_VIEW_AZIMUTH_DEG = 30;
const FLOOR_VIEW_POLAR_DEG = 45;
const FLOOR_VIEW_ZOOM = 0.5;

// What the tutorial's steps work out for each other while they are being played (see the
// "set_variable" action).
//
// The view the camera settled into when edit mode opened, which the step about turning the camera
// measures the user's own turning against. Noted down rather than arranged, so that the step asks
// the user to move from where he already is instead of jolting him somewhere else first.
const EDIT_VIEW_AZIMUTH_DEG_VARIABLE = "editViewAzimuthDeg";
const EDIT_VIEW_POLAR_DEG_VARIABLE = "editViewPolarDeg";
// The patch of floor the user is asked to select (see pickFloorHotspot).
const FLOOR_HOTSPOT_VARIABLE = "floorHotspot";

// How far from the player, in voxels, the tutorial looks for that patch of floor.
const FLOOR_HOTSPOT_MIN_DIST = 1;
const FLOOR_HOTSPOT_MAX_DIST = 3;

const cameraPosTemp = new THREE.Vector3();

//------------------------------------------------------------------------
// What each single-player mode does to the client while it is being played: the steps the user is
// walked through, and the teardown that follows them (see SinglePlayerModeClientConfig). The room
// those steps are played in is described elsewhere, by the shared SinglePlayerModeConfigMap, since
// the server generates that room too.
//------------------------------------------------------------------------

const SinglePlayerModeClientConfigMap: {[singlePlayerMode: string]: SinglePlayerModeClientConfig} = {};

SinglePlayerModeClientConfigMap[TUTORIAL_SINGLE_PLAYER_MODE] = {
    loadSteps: () =>
    {
        const cachedSteps = cachedStepsByMode[TUTORIAL_SINGLE_PLAYER_MODE];
        if (cachedSteps)
            return cachedSteps;

        const m = SinglePlayerModeConfigMap[TUTORIAL_SINGLE_PLAYER_MODE].loadMetadata();

        const steps: {[stepName: string]: SinglePlayerStep} = {
            "initial": { // Drag to move
                startDelay: 0,
                actionsOnStart: [
                    {type: "ui_diagram", diagram: "drag_up", text: () => "Drag to move"},
                    {type: "feature_flag", flag: FeatureFlag.HideChatInput, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.DisableChatSend, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.ExitSinglePlayerOnDoorClick, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.DisableVoxelQuadSelectionChange, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.DisablePlayerSelectionChange, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.DisableManualVoxelBlockAddition, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.DisableManualVoxelBlockRemoval, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.DisableManualObjectAddition, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.DisableGameModeTransition, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.HideUserIdentityLabels, enable: true},
                ],
                transitionRules: [{
                    requirements: [{type: "player_is_nearby", negate: true,
                        targetX: () => m.entranceVoxelCol+0.5, targetZ: () => m.entranceVoxelRow+0.5,
                        detectionDist: () => 0.5}],
                    nextStep: "start_edit",
                    nextStepDelay: 500,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                ],
            },
            "start_edit": {
                startDelay: 0,
                actionsOnStart: [
                    {type: "ui_headline", text: () => "Start the edit mode."},
                    // The button sits in the top-right corner, with no room above it for an arrow.
                    {type: "ui_arrow", targetElementId: "editModeButton", arrowBias: "center",
                        arrowSide: "below"},
                    {type: "ui_outline_rect", targetElementId: "editModeButton"},
                    {type: "feature_flag", flag: FeatureFlag.DisableGameModeTransition, enable: false},
                    {type: "feature_flag", flag: FeatureFlag.DisablePlayerSelectionChange, enable: false},
                ],
                transitionRules: [{
                    requirements: [{type: "edit_mode_active", negate: false}],
                    nextStep: "change_camera_angle",
                    nextStepDelay: 0,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                    // The user is now inside the mode, and stays there until the step that teaches
                    // him the way out of it.
                    {type: "feature_flag", flag: FeatureFlag.DisableGameModeTransition, enable: true},
                    // The character stays selected from here until the user is asked to pick
                    // something else, so the next few steps have it to talk about.
                    {type: "feature_flag", flag: FeatureFlag.DisablePlayerSelectionChange, enable: true},
                ],
            },
            "change_camera_angle": {
                // Long enough for the camera to have settled into the orbit the mode opens in,
                // since that settled view is the one noted down below.
                startDelay: 500,
                actionsOnStart: [
                    {type: "ui_headline", text: () => "This is you.<br>Watch it from different angles!"},
                    // The view the user is asked to move away from is the one the mode gave him,
                    // noted down here rather than arranged: a camera that swung somewhere else the
                    // moment the step began would undo the framing he had just been handed, and
                    // answer a question he had not asked.
                    {type: "set_variable", name: EDIT_VIEW_AZIMUTH_DEG_VARIABLE,
                        computeValue: () => THREE.MathUtils.radToDeg(
                            orbitCameraAnglesObservable.peek().azimuth)},
                    {type: "set_variable", name: EDIT_VIEW_POLAR_DEG_VARIABLE,
                        computeValue: () => THREE.MathUtils.radToDeg(
                            orbitCameraAnglesObservable.peek().polar)},
                    {type: "ui_diagram", diagram: "drag_sideways", text: () => "Drag to look around",
                        placement: "side"},
                ],
                transitionRules: [{
                    requirements: [{type: "orbit_camera_angle_differs", negate: false,
                        azimuthDeg: () => SinglePlayerManager.getVariable(EDIT_VIEW_AZIMUTH_DEG_VARIABLE),
                        polarDeg: () => SinglePlayerManager.getVariable(EDIT_VIEW_POLAR_DEG_VARIABLE),
                        minDifferenceDeg: () => TUTORIAL_CAMERA_TURN_DEG}],
                    nextStep: "customize_player",
                    nextStepDelay: 500,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                ],
            },
            "customize_player": {
                startDelay: 500,
                actionsOnStart: [
                    {type: "ui_headline", text: () => "Customize your look."},
                    {type: "ui_arrow", targetElementId: "customizePlayerOptions", arrowBias: "left"},
                    {type: "ui_outline_rect", targetElementId: "customizePlayerOptions"},
                ],
                transitionRules: [{
                    requirements: [{type: "client_events_occurred_after_step_began", negate: false,
                        eventType: ClientEventType.ManuallyChangedPlayerPart, minNumEvents: () => 1}],
                    nextStep: "before_select_floor",
                    nextStepDelay: 1000,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                ],
            },
            "before_select_floor": {
                startDelay: 0,
                actionsOnStart: [
                    // Which patch of floor to ask for cannot be known until the user is standing
                    // somewhere (see pickFloorHotspot), so it is settled here, once, and everything
                    // this step points with reads it back.
                    {type: "set_variable", name: FLOOR_HOTSPOT_VARIABLE,
                        computeValue: () => pickFloorHotspot(m.hotspots.floor)},
                    // The camera is turned on that patch instead of on the character, which puts it
                    // in the middle of the view: showing the user the thing he is being asked to
                    // pick out beats telling him where to look for it. Since it is framed exactly
                    // as the quad itself would be, picking it hands the camera on without a jolt.
                    {type: "orbit_camera_target_override",
                        targetX: () => SinglePlayerManager.getVariable(FLOOR_HOTSPOT_VARIABLE).col+0.5,
                        targetY: () => 0,
                        targetZ: () => SinglePlayerManager.getVariable(FLOOR_HOTSPOT_VARIABLE).row+0.5},
                    // Whichever way the user had turned the camera by now, a patch of floor seen
                    // from close to its own level is a sliver, so this step asks for a view of its
                    // own rather than keeping his.
                    {type: "orbit_camera_pose", zoomAmount: () => FLOOR_VIEW_ZOOM,
                        azimuthDeg: () => FLOOR_VIEW_AZIMUTH_DEG,
                        polarDeg: () => FLOOR_VIEW_POLAR_DEG},
                    {type: "gizmo_downward_arrow",
                        targetX: () => SinglePlayerManager.getVariable(FLOOR_HOTSPOT_VARIABLE).col+0.5, targetY: () => 0,
                        targetZ: () => SinglePlayerManager.getVariable(FLOOR_HOTSPOT_VARIABLE).row+0.5},
                    {type: "gizmo_voxel_quad_outline_rect",
                        row: () => SinglePlayerManager.getVariable(FLOOR_HOTSPOT_VARIABLE).row,
                        col: () => SinglePlayerManager.getVariable(FLOOR_HOTSPOT_VARIABLE).col,
                        collisionLayer: () => COLLISION_LAYER_NULL, facingAxis: "y", orientation: "+"},
                ],
                transitionRules: [{
                    requirements: [{type: "always_true"}],
                    nextStep: "select_floor",
                    nextStepDelay: 750,
                }],
                actionsOnEnd: [
                ],
            },
            "select_floor": {
                startDelay: 0,
                actionsOnStart: [
                    {type: "ui_headline", text: () => "Select the floor."},
                    {type: "feature_flag", flag: FeatureFlag.DisableVoxelQuadSelectionChange, enable: false},
                ],
                transitionRules: [{
                    // The patch being pointed at, and no other. Everything the next three steps do
                    // happens on this one patch — its texture, the block built on it, the floor
                    // uncovered when that block goes again — so the step waits until the user has
                    // picked out the patch it is pointing at rather than working with whichever
                    // one he happened to click.
                    requirements: [{type: "voxel_quad_selected", negate: false,
                        row: () => SinglePlayerManager.getVariable(FLOOR_HOTSPOT_VARIABLE).row,
                        col: () => SinglePlayerManager.getVariable(FLOOR_HOTSPOT_VARIABLE).col,
                        collisionLayer: () => COLLISION_LAYER_NULL, facingAxis: "y",
                        orientation: "+"}],
                    nextStep: "change_texture",
                    nextStepDelay: 0,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                    {type: "clear_orbit_camera_target_override"},
                    // The patch is now the user's selection, and it stays his selection until the
                    // block he is about to build on it has been built and taken away again. Each
                    // of the three steps in between is about this one patch of floor, and a click
                    // that wandered off to another face of the room would leave the user texturing,
                    // building on, or removing something the instruction was never about. The steps
                    // themselves move the selection where they need it (see "select_voxel_quad").
                    {type: "feature_flag", flag: FeatureFlag.DisableVoxelQuadSelectionChange, enable: true},
                ],
            },
            "change_texture": {
                startDelay: 500,
                actionsOnStart: [
                    {type: "ui_headline", text: () => "Change the texture."},
                    {type: "ui_arrow", targetElementId: "voxelQuadTextureOptions", arrowBias: "right"},
                    {type: "ui_outline_rect", targetElementId: "voxelQuadTextureOptions"},
                ],
                transitionRules: [{
                    requirements: [{type: "client_events_occurred_after_step_began", negate: false,
                        eventType: ClientEventType.ManuallyChangedVoxelQuadTexture, minNumEvents: () => 1}],
                    nextStep: "add_block",
                    nextStepDelay: 0,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                ],
            },
            "add_block": {
                startDelay: 500,
                actionsOnStart: [
                    {type: "ui_headline", text: () => "Add a block."},
                    {type: "ui_arrow", targetElementId: "addVoxelBlockButton", arrowBias: "center"},
                    {type: "ui_outline_rect", targetElementId: "addVoxelBlockButton"},
                    {type: "feature_flag", flag: FeatureFlag.DisableManualVoxelBlockAddition, enable: false},
                ],
                transitionRules: [{
                    requirements: [{type: "client_events_occurred_after_step_began", negate: false,
                        eventType: ClientEventType.ManuallyAddedVoxelBlock, minNumEvents: () => 1}],
                    nextStep: "remove_block",
                    nextStepDelay: 0,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                    {type: "feature_flag", flag: FeatureFlag.DisableManualVoxelBlockAddition, enable: true},
                    // Up onto the block the user has just built, which stands on the patch of floor
                    // he selected and which the next step asks him to remove.
                    {type: "select_voxel_quad",
                        row: () => SinglePlayerManager.getVariable(FLOOR_HOTSPOT_VARIABLE).row,
                        col: () => SinglePlayerManager.getVariable(FLOOR_HOTSPOT_VARIABLE).col,
                        collisionLayer: () => COLLISION_LAYER_MIN, facingAxis: "y", orientation: "+"},
                ],
            },
            "remove_block": {
                startDelay: 500,
                actionsOnStart: [
                    {type: "ui_headline", text: () => "Remove the block."},
                    {type: "ui_arrow", targetElementId: "removeVoxelBlockButton", arrowBias: "center"},
                    {type: "ui_outline_rect", targetElementId: "removeVoxelBlockButton"},
                    {type: "feature_flag", flag: FeatureFlag.DisableManualVoxelBlockRemoval, enable: false},
                ],
                transitionRules: [{
                    requirements: [{type: "client_events_occurred_after_step_began", negate: false,
                        eventType: ClientEventType.ManuallyRemovedVoxelBlock, minNumEvents: () => 1}],
                    nextStep: "exit_edit_mode",
                    nextStepDelay: 0,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                    {type: "feature_flag", flag: FeatureFlag.DisableManualVoxelBlockRemoval, enable: true},
                    // Back down onto the patch of floor the block was standing on, bare again now.
                    {type: "select_voxel_quad",
                        row: () => SinglePlayerManager.getVariable(FLOOR_HOTSPOT_VARIABLE).row,
                        col: () => SinglePlayerManager.getVariable(FLOOR_HOTSPOT_VARIABLE).col,
                        collisionLayer: () => COLLISION_LAYER_NULL, facingAxis: "y", orientation: "+"},
                ],
            },
            "exit_edit_mode": {
                startDelay: 500,
                actionsOnStart: [
                    {type: "ui_headline", text: () => "Exit the edit mode."},
                    // The button shares the top edge with the headline, so it is pointed at from
                    // below, like the one that opened the mode.
                    {type: "ui_arrow", targetElementId: "modeExitButton", arrowBias: "center",
                        arrowSide: "below"},
                    // The way out is opened for this step alone. The selection standing in the mode
                    // stays pinned throughout: leaving the mode drops it along with the mode, so
                    // there is no need to hand the room back to the user's clicks to let him go.
                    {type: "feature_flag", flag: FeatureFlag.DisableGameModeTransition, enable: false},
                ],
                transitionRules: [{
                    requirements: [{type: "edit_mode_active", negate: true}],
                    nextStep: "go_to_npc",
                    nextStepDelay: 0,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                    // Play mode is where the rest of the tutorial takes place, so the user is held
                    // in it just as he was held in the one he has just left.
                    {type: "feature_flag", flag: FeatureFlag.DisableGameModeTransition, enable: true},
                    // Nothing is asked of the room itself again, so the rest of the tutorial goes
                    // back to leaving the scenery alone.
                    {type: "feature_flag", flag: FeatureFlag.DisableVoxelQuadSelectionChange, enable: true},
                ],
            },
            "go_to_npc": {
                startDelay: 500,
                actionsOnStart: [
                    {type: "ui_headline", text: () => "Follow the arrow."},
                    {type: "gizmo_navigation_arrow",
                        targetX: () => m.hotspots.npc.col+0.5, targetZ: () => m.hotspots.npc.row+0.5},
                    {type: "remove_voxel_blocks",
                        rowStart: () => m.rects.wall1.rowStart,
                        colStart: () => m.rects.wall1.colStart,
                        numRows: () => m.rects.wall1.numRows,
                        numCols: () => m.rects.wall1.numCols,
                        collisionLayerMin: () => COLLISION_LAYER_MIN,
                        collisionLayerMax: () => COLLISION_LAYER_MAX},
                ],
                transitionRules: [{
                    requirements: [{type: "player_is_nearby", negate: false,
                        targetX: () => m.hotspots.npc.col+0.5, targetZ: () => m.hotspots.npc.row+0.5,
                        detectionDist: () => 5}],
                    nextStep: "type_chat_message",
                    nextStepDelay: 0,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                ],
            },
            "type_chat_message": {
                startDelay: 0,
                actionsOnStart: [
                    {type: "ui_headline", text: () => "This is your receptionist.<br>Type your message to say \"Hello\"."},
                    {type: "ui_arrow", targetElementId: "chatTextInput", arrowBias: "center"},
                    {type: "ui_outline_rect", targetElementId: "chatTextInput"},
                    {type: "feature_flag", flag: FeatureFlag.HideChatInput, enable: false},
                    {type: "feature_flag", flag: FeatureFlag.UseFallbackChatMessage, enable: true},
                ],
                transitionRules: [{
                    requirements: [{type: "chat_input_passes_condition",
                        chatInputCondition: (str: string) => str.trim().length > 0}],
                    nextStep: "send_chat_message",
                    nextStepDelay: 500,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                ],
            },
            "send_chat_message": {
                startDelay: 0,
                actionsOnStart: [
                    {type: "ui_headline", text: () => "Click 'Send' to send your message."},
                    {type: "ui_arrow", targetElementId: "chatSendButton", arrowBias: "center"},
                    {type: "ui_outline_rect", targetElementId: "chatSendButton"},
                    {type: "feature_flag", flag: FeatureFlag.DisableChatSend, enable: false},
                ],
                transitionRules: [{
                    requirements: [{type: "object_metadata_passes_condition",
                        objectId: "my_player",
                        metadataKey: ObjectMetadataKeyEnumMap.SentMessage,
                        metadataValueCondition: (str: string) => str.trim().length > 0}],
                    nextStep: "watch_npc_reply",
                    nextStepDelay: 1000,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                ],
            },
            "watch_npc_reply": {
                startDelay: 0,
                actionsOnStart: [
                    {type: "ui_headline", text: () => "Look! The receptionist greeted you back."},
                    {type: "set_object_metadata", objectId: "npc",
                            metadataKey: ObjectMetadataKeyEnumMap.SentMessage,
                            metadataValue: () => "Hello!"},
                    {type: "object_bounce", objectId: "npc", durationSeconds: () => 1.25,
                            positionOffset: () => ({x: 0, y: 0.3, z: 0}), oscillations: () => 3}, // The NPC bobs up and down to "nod" as it greets back.
                ],
                transitionRules: [{
                    requirements: [{type: "always_true"}],
                    nextStep: "exit_through_door",
                    nextStepDelay: 3500,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                ],
            },
            "exit_through_door": {
                startDelay: 0,
                actionsOnStart: [
                    {type: "ui_headline", text: () => "Exit through the door."},
                    {type: "gizmo_navigation_arrow",
                        targetX: () => m.hotspots.door.col+0.5, targetZ: () => m.hotspots.door.row-5},
                    {type: "remove_voxel_blocks",
                        rowStart: () => m.rects.wall2.rowStart,
                        colStart: () => m.rects.wall2.colStart,
                        numRows: () => m.rects.wall2.numRows,
                        numCols: () => m.rects.wall2.numCols,
                        collisionLayerMin: () => COLLISION_LAYER_MIN,
                        collisionLayerMax: () => COLLISION_LAYER_MAX},
                ],
                transitionRules: [{
                    requirements: [{type: "room_exited"}],
                    nextStep: "",
                    nextStepDelay: 0,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                    // Feature-flag teardown is handled centrally by onModeEnd (below), so it
                    // also runs when the tutorial is skipped rather than exited through the door.
                ],
            },
        };
        cachedStepsByMode[TUTORIAL_SINGLE_PLAYER_MODE] = steps;
        return steps;
    },
    onModeEnd: () =>
    {
        // When the tutorial ends (completed or skipped), disable every feature flag and give the
        // camera back to whatever the user selects from here on.
        const actions: SinglePlayerAction[] = [{type: "clear_orbit_camera_target_override"}];
        for (const flag of Object.values(FeatureFlag))
        {
            if (typeof flag === "number")
                actions.push({type: "feature_flag", flag, enable: false});
        }
        return actions;
    },
};

// Picks the patch of floor the user is asked to select, at the moment he is asked for it.
//
// A patch written into the room's layout would sooner or later be the very one the user is standing
// on, where the outline drawn around it and the arrow hanging over it would be lost inside his own
// character. So one is looked for afresh, out from his feet toward the camera: ground he is already
// facing, and which lies between him and the view, so that turning the camera on it leaves him in
// the picture. The search walks outward and keeps the furthest bare patch it reaches before the
// floor gives out — a wall, a block standing on it, or the edge of the room — and falls back to the
// patch in the layout if it finds nothing at all.
function pickFloorHotspot(fallback: {row: number, col: number}): {row: number, col: number}
{
    const room = App.getCurrentRoom();
    const playerPos = ClientObjectManager.getMyPlayer()?.position;
    if (!room || !playerPos)
        return fallback;

    GraphicsManager.getCamera().getWorldPosition(cameraPosTemp);
    const towardCameraX = cameraPosTemp.x - playerPos.x;
    const towardCameraZ = cameraPosTemp.z - playerPos.z;
    const distToCamera = Math.hypot(towardCameraX, towardCameraZ);
    if (distToCamera < NEAR_EPSILON) // The camera stands right over him, and points nowhere.
        return fallback;

    const playerRow = Math.floor(playerPos.z);
    const playerCol = Math.floor(playerPos.x);
    let hotspot: {row: number, col: number} | undefined = undefined;

    for (let dist = FLOOR_HOTSPOT_MIN_DIST; dist <= FLOOR_HOTSPOT_MAX_DIST; ++dist)
    {
        const row = Math.floor(playerPos.z + (towardCameraZ / distToCamera) * dist);
        const col = Math.floor(playerPos.x + (towardCameraX / distToCamera) * dist);
        if (row == playerRow && col == playerCol)
            continue; // Still the patch he is standing on, which is the one patch of no use here.
        if (!isBareFloor(room.voxelGrid.voxels, row, col))
            break; // The floor has given out; whatever was reached before it stands.
        hotspot = {row, col};
    }
    return hotspot ?? fallback;
}

// Whether the given cell is a bare patch of the room's own floor: floor the user can see and click
// on, with nothing standing on it — so that an outline drawn around it is visible, and the block he
// is asked to build on it afterwards has somewhere to go.
function isBareFloor(voxels: Voxel[], row: number, col: number): boolean
{
    const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
    if (!voxel || VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, COLLISION_LAYER_MIN))
        return false;
    const floorQuadIndex = VoxelQueryUtil.getVoxelQuadIndex(row, col, "y", "+", COLLISION_LAYER_NULL);
    return floorQuadIndex >= 0 && (voxel.quadsMem.quads[floorQuadIndex] & 0b10000000) != 0;
}

export default SinglePlayerModeClientConfigMap;
