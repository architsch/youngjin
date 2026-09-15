import * as THREE from "three";
import { ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import TutorialSinglePlayerModeConfig from "../../../../shared/singlePlayer/types/singlePlayerModeConfig/tutorialSinglePlayerModeConfig";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NEAR_EPSILON, NUM_VOXEL_COLS,
    NUM_VOXEL_ROWS } from "../../../../shared/system/sharedConstants";
import { FeatureFlag } from "../../../../shared/system/types/featureFlag";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import App from "../../../app";
import GraphicsManager from "../../../graphics/graphicsManager";
import { orbitCameraAnglesObservable, voxelQuadSelectionObservable } from "../../../system/clientObservables";
import { ClientEventType } from "../../../system/types/clientEventType";
import SinglePlayerManager from "../../singlePlayerManager";
import SinglePlayerAction from "../singlePlayerAction";
import SinglePlayerStep from "../singlePlayerStep";
import SinglePlayerModeClientConfig from "./singlePlayerModeClientConfig";

let cachedSteps: {[stepName: string]: SinglePlayerStep} | undefined;

// Thin outline for the small mode-switch capsule.
const MODE_SWITCH_OUTLINE_THICKNESS_PX = 2;

// How far the user has to swing the camera around before they are taken to have discovered that they can.
const TUTORIAL_CAMERA_TURN_DEG = 20;

// How far below the camera edit mode's opening face is looked for: about a block's height, landing in the
// middle of a block layer for a standing user rather than on the boundary between two.
const WALL_QUAD_DEPTH_BELOW_CAMERA = 0.75;

// How close to and how far from that face the camera may be as edit mode opens on it.
const WALL_QUAD_MIN_CAMERA_DIST = 2.5;
const WALL_QUAD_MAX_CAMERA_DIST = 6;

// Step variables (see "set_variable"). The edit-mode view is recorded (not imposed) so the
// camera-turning step measures from where the user already is.
const EDIT_VIEW_AZIMUTH_DEG_VARIABLE = "editViewAzimuthDeg";
const EDIT_VIEW_POLAR_DEG_VARIABLE = "editViewPolarDeg";
// The face edit mode opened on, which the building steps build against and return to.
const WALL_QUAD_VARIABLE = "wallQuadIndex";

const cameraPosTemp = new THREE.Vector3();
const cameraDirTemp = new THREE.Vector3();

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
                    // Kept out of view and out of the way of clicks meant for the room around it.
                    {type: "set_my_player_hidden", hidden: true},
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
                    // The next steps build against a wall, so the mode opens on the one ahead rather than
                    // on whatever is in view. Falls back to the layout's floor patch.
                    {type: "edit_mode_opening_voxel_quad", quadIndex: () => pickWallQuadAhead(
                        VoxelQueryUtil.getFloorVoxelQuadIndex(
                            Math.floor(p.hotspots.floor.z), Math.floor(p.hotspots.floor.x)))},
                ],
                transitionRules: [{
                    requirements: [{type: "edit_mode_active", negate: false}],
                    nextStep: "change_camera_angle",
                    nextStepDelay: 0,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                    {type: "clear_edit_mode_opening_voxel_quad"},
                    // Locked in edit mode until the step that teaches leaving it.
                    {type: "feature_flag", flag: FeatureFlag.DisableGameModeTransition, enable: true},
                    {type: "set_variable", name: WALL_QUAD_VARIABLE,
                        computeValue: () => voxelQuadSelectionObservable.peek()?.quadIndex ?? -1},
                    // The user may have switched while hugging the wall or from across the room.
                    {type: "orbit_camera_distance_range", minDistance: () => WALL_QUAD_MIN_CAMERA_DIST,
                        maxDistance: () => WALL_QUAD_MAX_CAMERA_DIST},
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
                    nextStep: "add_block",
                    nextStepDelay: 500,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                ],
            },
            // The selection stays locked through the build/texture/remove steps; the steps move it
            // themselves (see "select_voxel_quad").
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
                    // Onto the same face of the newly built block, which the next steps retexture and remove.
                    {type: "select_voxel_quad", quadIndex: () => getSameQuadOnBlockBuiltAgainst(
                        SinglePlayerManager.getVariable(WALL_QUAD_VARIABLE))},
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
                    // Back onto the face the block was built against, bare again now.
                    {type: "select_voxel_quad",
                        quadIndex: () => SinglePlayerManager.getVariable(WALL_QUAD_VARIABLE)},
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
        // Show the user's character again, restore edit mode's usual opening, and disable all feature flags.
        const actions: SinglePlayerAction[] = [
            {type: "set_my_player_hidden", hidden: false},
            {type: "clear_edit_mode_opening_voxel_quad"},
        ];
        for (const flag of Object.values(FeatureFlag))
        {
            if (typeof flag === "number")
                actions.push({type: "feature_flag", flag, enable: false});
        }
        return actions;
    },
};

// Picked as edit mode opens, since the user walks until then. Walks the grid from the camera along its
// horizontal facing, a little below it, and takes the face of the first block met; falls back if none is.
function pickWallQuadAhead(fallbackQuadIndex: number): number
{
    const room = App.getCurrentRoom();
    if (!room)
        return fallbackQuadIndex;

    const camera = GraphicsManager.getCamera();
    camera.getWorldPosition(cameraPosTemp);
    camera.getWorldDirection(cameraDirTemp);
    const collisionLayer = VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(
        cameraPosTemp.y - WALL_QUAD_DEPTH_BELOW_CAMERA);
    const horizontalLength = Math.hypot(cameraDirTemp.x, cameraDirTemp.z);
    if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX ||
        horizontalLength < NEAR_EPSILON)
    {
        return fallbackQuadIndex;
    }
    const dirX = cameraDirTemp.x / horizontalLength;
    const dirZ = cameraDirTemp.z / horizontalLength;

    let col = VoxelQueryUtil.getVoxelColFromWorldX(cameraPosTemp.x);
    let row = VoxelQueryUtil.getVoxelRowFromWorldZ(cameraPosTemp.z);

    // Walk length between successive column (row) boundaries, and to the next one.
    const colStride = 1 / Math.abs(dirX);
    const rowStride = 1 / Math.abs(dirZ);
    let colBoundary = (dirX != 0)
        ? Math.abs(col + ((dirX > 0) ? 1 : 0) - cameraPosTemp.x) * colStride : Infinity;
    let rowBoundary = (dirZ != 0)
        ? Math.abs(row + ((dirZ > 0) ? 1 : 0) - cameraPosTemp.z) * rowStride : Infinity;

    for (let step = 0; step < NUM_VOXEL_ROWS + NUM_VOXEL_COLS; ++step)
    {
        const crossesCol = colBoundary <= rowBoundary;
        if (crossesCol)
        {
            col += (dirX > 0) ? 1 : -1;
            colBoundary += colStride;
        }
        else
        {
            row += (dirZ > 0) ? 1 : -1;
            rowBoundary += rowStride;
        }

        const voxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, row, col);
        if (!voxel)
            break; // Left the room without meeting a block.
        if (!VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, collisionLayer))
            continue;

        // The face turned back toward the camera.
        const quadIndex = crossesCol
            ? VoxelQueryUtil.getVoxelQuadIndex(row, col, "x", (dirX > 0) ? "-" : "+", collisionLayer)
            : VoxelQueryUtil.getVoxelQuadIndex(row, col, "z", (dirZ > 0) ? "-" : "+", collisionLayer);
        return ((voxel.quadsMem.quads[quadIndex] & 0b10000000) != 0) ? quadIndex : fallbackQuadIndex;
    }
    return fallbackQuadIndex;
}

// The same face on the block that adding one against the given face builds (see
// VoxelQuadPlacementOptions).
function getSameQuadOnBlockBuiltAgainst(quadIndex: number): number
{
    if (!VoxelQueryUtil.isValidVoxelQuadIndex(quadIndex))
        return -1;

    const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
    const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
    const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
    const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);
    const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
    const step = (orientation == "+") ? 1 : -1;

    if (facingAxis != "y")
    {
        return VoxelQueryUtil.getVoxelQuadIndex(row + ((facingAxis == "z") ? step : 0),
            col + ((facingAxis == "x") ? step : 0), facingAxis, orientation, collisionLayer);
    }
    // The room's own floor and ceiling belong to no layer; a block built on one takes the layer next to it.
    const builtLayer = (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
        ? ((orientation == "+") ? COLLISION_LAYER_MIN : COLLISION_LAYER_MAX)
        : collisionLayer + step;
    return VoxelQueryUtil.getVoxelQuadIndex(row, col, "y", orientation, builtLayer);
}

export default TutorialSinglePlayerModeClientConfig;
