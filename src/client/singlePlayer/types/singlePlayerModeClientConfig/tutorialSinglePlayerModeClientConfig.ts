import * as THREE from "three";
import { ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import TutorialSinglePlayerModeConfig from "../../../../shared/singlePlayer/types/singlePlayerModeConfig/tutorialSinglePlayerModeConfig";
import { COLLISION_LAYER_MIN, COLLISION_LAYER_NULL, NEAR_EPSILON } from "../../../../shared/system/sharedConstants";
import { FeatureFlag } from "../../../../shared/system/types/featureFlag";
import Voxel from "../../../../shared/voxel/types/voxel";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import App from "../../../app";
import GraphicsManager from "../../../graphics/graphicsManager";
import ClientObjectManager from "../../../object/clientObjectManager";
import { orbitCameraAnglesObservable } from "../../../system/clientObservables";
import { ClientEventType } from "../../../system/types/clientEventType";
import SinglePlayerManager from "../../singlePlayerManager";
import SinglePlayerAction from "../singlePlayerAction";
import SinglePlayerStep from "../singlePlayerStep";
import SinglePlayerModeClientConfig from "./singlePlayerModeClientConfig";

let cachedSteps: {[stepName: string]: SinglePlayerStep} | undefined;

// Thin outline for the small mode-switch capsule.
const MODE_SWITCH_OUTLINE_THICKNESS_PX = 2;

// How far the user has to swing the camera around before he is taken to have discovered that he can.
const TUTORIAL_CAMERA_TURN_DEG = 20;

// Camera view for the floor-picking step: looking down at an angle so the patch reads as a square,
// far enough back to show its surroundings.
const FLOOR_VIEW_AZIMUTH_DEG = 30;
const FLOOR_VIEW_POLAR_DEG = 45;
const FLOOR_VIEW_ZOOM = 0.5;

// Step variables (see "set_variable"). The edit-mode view is recorded (not imposed) so the
// camera-turning step measures from where the user already is.
const EDIT_VIEW_AZIMUTH_DEG_VARIABLE = "editViewAzimuthDeg";
const EDIT_VIEW_POLAR_DEG_VARIABLE = "editViewPolarDeg";
// The patch of floor the user is asked to select (see pickFloorHotspot).
const FLOOR_HOTSPOT_VARIABLE = "floorHotspot";

// How far from the player, in voxels, the tutorial looks for that patch of floor.
const FLOOR_HOTSPOT_MIN_DIST = 1;
const FLOOR_HOTSPOT_MAX_DIST = 3;

const cameraPosTemp = new THREE.Vector3();

// Tutorial steps and teardown. The room is in the shared TutorialSinglePlayerModeConfig.
const TutorialSinglePlayerModeClientConfig: SinglePlayerModeClientConfig =
{
    loadSteps: () =>
    {
        if (cachedSteps)
            return cachedSteps;

        const p = TutorialSinglePlayerModeConfig.getRoomBuilderParams();

        const steps: {[stepName: string]: SinglePlayerStep} = {
            "initial": { // Drag to move
                startDelay: 0,
                actionsOnStart: [
                    {type: "ui_diagram", diagram: "drag_up", text: () => "Drag to move"},
                    {type: "feature_flag", flag: FeatureFlag.HideChatInput, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.DisableChatSend, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.DisableVoxelQuadSelectionChange, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.DisableObjectSelectionChange, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.DisableManualVoxelBlockAddition, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.DisableManualVoxelBlockRemoval, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.DisableManualObjectAddition, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.DisableGameModeTransition, enable: true},
                ],
                transitionRules: [{
                    requirements: [{type: "player_is_nearby", negate: true,
                        targetX: () => p.entranceVoxelCol+0.5, targetZ: () => p.entranceVoxelRow+0.5,
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
                    {type: "ui_headline", text: () => "Switch to Edit mode."},
                    // The switch sits in the top-right corner, with no room above it for an arrow.
                    {type: "ui_arrow", targetElementId: "gameModeToggleSwitch", arrowBias: "center",
                        arrowSide: "below"},
                    // Outline only the track, not its labels.
                    {type: "ui_outline_capsule", targetElementId: "gameModeToggleSwitchTrack",
                        thicknessPx: () => MODE_SWITCH_OUTLINE_THICKNESS_PX},
                    {type: "feature_flag", flag: FeatureFlag.DisableGameModeTransition, enable: false},
                    // The mode opens on whatever the user faces, which may be either kind.
                    {type: "feature_flag", flag: FeatureFlag.DisableVoxelQuadSelectionChange, enable: false},
                    {type: "feature_flag", flag: FeatureFlag.DisableObjectSelectionChange, enable: false},
                ],
                transitionRules: [{
                    requirements: [{type: "edit_mode_active", negate: false}],
                    nextStep: "change_camera_angle",
                    nextStepDelay: 0,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                    // Locked in edit mode until the step that teaches leaving it.
                    {type: "feature_flag", flag: FeatureFlag.DisableGameModeTransition, enable: true},
                    // Keep the selection the mode opened on for the next step.
                    {type: "feature_flag", flag: FeatureFlag.DisableVoxelQuadSelectionChange, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.DisableObjectSelectionChange, enable: true},
                ],
            },
            "change_camera_angle": {
                // Wait for the orbit to settle before recording its view.
                startDelay: 500,
                actionsOnStart: [
                    {type: "ui_headline", text: () => "Edit mode selects what you were looking at.<br>Watch it from different angles!"},
                    // Record the current view rather than imposing one.
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
                    nextStep: "before_select_floor",
                    nextStepDelay: 500,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                ],
            },
            "before_select_floor": {
                startDelay: 0,
                actionsOnStart: [
                    // The patch depends on where the user stands (see pickFloorHotspot), so pick it once.
                    {type: "set_variable", name: FLOOR_HOTSPOT_VARIABLE,
                        computeValue: () => pickFloorHotspot(
                            {row: Math.floor(p.hotspots.floor.z), col: Math.floor(p.hotspots.floor.x)})},
                    // Show the patch by centring the camera on it; framed like the quad, so selecting
                    // it doesn't jolt the camera.
                    {type: "orbit_camera_target_override",
                        targetX: () => SinglePlayerManager.getVariable(FLOOR_HOTSPOT_VARIABLE).col+0.5,
                        targetY: () => 0,
                        targetZ: () => SinglePlayerManager.getVariable(FLOOR_HOTSPOT_VARIABLE).row+0.5},
                    // Force a top-down-ish view: a floor patch seen near its level is a sliver.
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
                    // Require this exact patch, since the next steps all act on it.
                    requirements: [{type: "voxel_quad_selected", negate: false,
                        row: () => SinglePlayerManager.getVariable(FLOOR_HOTSPOT_VARIABLE).row,
                        col: () => SinglePlayerManager.getVariable(FLOOR_HOTSPOT_VARIABLE).col,
                        collisionLayer: () => COLLISION_LAYER_NULL, facingAxis: "y",
                        orientation: "+"}],
                    nextStep: "add_block",
                    nextStepDelay: 0,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                    {type: "clear_orbit_camera_target_override"},
                    // Lock the selection through the build/texture/remove steps; the steps move it
                    // themselves (see "select_voxel_quad").
                    {type: "feature_flag", flag: FeatureFlag.DisableVoxelQuadSelectionChange, enable: true},
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
                    nextStep: "change_texture",
                    nextStepDelay: 0,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                    {type: "feature_flag", flag: FeatureFlag.DisableManualVoxelBlockAddition, enable: true},
                    // Select the top of the newly built block, which the next steps retexture and remove.
                    {type: "select_voxel_quad",
                        row: () => SinglePlayerManager.getVariable(FLOOR_HOTSPOT_VARIABLE).row,
                        col: () => SinglePlayerManager.getVariable(FLOOR_HOTSPOT_VARIABLE).col,
                        collisionLayer: () => COLLISION_LAYER_MIN, facingAxis: "y", orientation: "+"},
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
                    nextStep: "remove_block",
                    nextStepDelay: 0,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
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
                    {type: "ui_headline", text: () => "Switch back to Play mode."},
                    // The same switch that opened the mode, pointed at from below for the same reason.
                    {type: "ui_arrow", targetElementId: "gameModeToggleSwitch", arrowBias: "center",
                        arrowSide: "below"},
                    {type: "ui_outline_capsule", targetElementId: "gameModeToggleSwitchTrack",
                        thicknessPx: () => MODE_SWITCH_OUTLINE_THICKNESS_PX},
                    // Allow leaving edit mode for this step only (leaving drops the pinned selection anyway).
                    {type: "feature_flag", flag: FeatureFlag.DisableGameModeTransition, enable: false},
                ],
                transitionRules: [{
                    requirements: [{type: "edit_mode_active", negate: true}],
                    nextStep: "go_to_npc",
                    nextStepDelay: 0,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                    // Lock play mode for the rest of the tutorial.
                    {type: "feature_flag", flag: FeatureFlag.DisableGameModeTransition, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.DisableVoxelQuadSelectionChange, enable: true},
                ],
            },
            "go_to_npc": {
                startDelay: 500,
                actionsOnStart: [
                    {type: "ui_headline", text: () => "Follow the arrow."},
                    {type: "gizmo_navigation_arrow",
                        targetX: () => p.hotspots.npc.x, targetZ: () => p.hotspots.npc.z},
                    {type: "remove_voxel_blocks",
                        rowStart: () => p.volumes.wall1.rowMin,
                        colStart: () => p.volumes.wall1.colMin,
                        numRows: () => p.volumes.wall1.rowMax - p.volumes.wall1.rowMin + 1,
                        numCols: () => p.volumes.wall1.colMax - p.volumes.wall1.colMin + 1,
                        // Stop at the capping slab (the ceiling must stay).
                        collisionLayerMin: () => p.volumes.wall1.collisionLayerMin,
                        collisionLayerMax: () => p.volumes.wall1.collisionLayerMax},
                ],
                transitionRules: [{
                    requirements: [{type: "player_is_nearby", negate: false,
                        targetX: () => p.hotspots.npc.x, targetZ: () => p.hotspots.npc.z,
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
                    // Aimed past the door, pointing the way out.
                    {type: "gizmo_navigation_arrow",
                        targetX: () => p.hotspots.door.x, targetZ: () => p.hotspots.door.z - 5},
                    {type: "remove_voxel_blocks",
                        rowStart: () => p.volumes.wall2.rowMin,
                        colStart: () => p.volumes.wall2.colMin,
                        numRows: () => p.volumes.wall2.rowMax - p.volumes.wall2.rowMin + 1,
                        numCols: () => p.volumes.wall2.colMax - p.volumes.wall2.colMin + 1,
                        // As above: the wall comes down only as far as the slab that caps the room.
                        collisionLayerMin: () => p.volumes.wall2.collisionLayerMin,
                        collisionLayerMax: () => p.volumes.wall2.collisionLayerMax},
                ],
                transitionRules: [{
                    requirements: [{type: "room_exited"}],
                    nextStep: "",
                    nextStepDelay: 0,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                    // Flag teardown lives in onModeEnd, so it also runs on skip.
                ],
            },
        };
        cachedSteps = steps;
        return steps;
    },
    onModeEnd: () =>
    {
        // Disable all feature flags and release the camera override.
        const actions: SinglePlayerAction[] = [{type: "clear_orbit_camera_target_override"}];
        for (const flag of Object.values(FeatureFlag))
        {
            if (typeof flag === "number")
                actions.push({type: "feature_flag", flag, enable: false});
        }
        return actions;
    },
};

// Picks the floor patch at request time: a fixed patch could be under the player. Walks outward from
// the player toward the camera and keeps the furthest bare patch before the floor ends; falls back to
// the layout's patch.
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

// Visible, clickable floor with nothing on it.
function isBareFloor(voxels: Voxel[], row: number, col: number): boolean
{
    const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
    if (!voxel || VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, COLLISION_LAYER_MIN))
        return false;
    const floorQuadIndex = VoxelQueryUtil.getFloorVoxelQuadIndex(row, col);
    return floorQuadIndex >= 0 && (voxel.quadsMem.quads[floorQuadIndex] & 0b10000000) != 0;
}

export default TutorialSinglePlayerModeClientConfig;
