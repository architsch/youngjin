import ObjectTypeConfigMap from "../../object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../object/types/addObjectSignal";
import ObjectGroup from "../../object/types/objectGroup";
import { ObjectMetadataKeyEnumMap } from "../../object/types/objectMetadataKey";
import ObjectTransform from "../../object/types/objectTransform";
import RoomGenerationVoxelGrid from "../../room/types/roomGeneration/roomGenerationVoxelGrid";
import RoomGenerationHelperUtil from "../../room/util/roomGenerationHelperUtil";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, COLLISION_LAYER_NULL, PLAYER_HEIGHT, TUTORIAL_SINGLE_PLAYER_MODE } from "../../system/sharedConstants";
import { FeatureFlag } from "../../system/types/featureFlag";
import VoxelGrid from "../../voxel/types/voxelGrid";
import SinglePlayerAction from "../types/singlePlayerAction";
import SinglePlayerModeConfig from "../types/singlePlayerModeConfig";
import SinglePlayerModeConfigMetadata from "../types/singlePlayerModeConfigMetadata";
import SinglePlayerStep from "../types/singlePlayerStep";

const cachedMetadataByMode: {[singlePlayerMode: string]: SinglePlayerModeConfigMetadata} = {};
const cachedStepsByMode: {[singlePlayerMode: string]: {[stepName: string]: SinglePlayerStep}} = {};

// The view the tutorial arranges for the user each time it wants him looking at something in
// particular in edit mode: from behind and above the entrance, facing the way the room runs. Given
// in world terms rather than relative to the player, so that the same numbers frame the same thing
// however the user happened to be turned when he entered the mode. The two steps that use it differ
// only in how far back they stand: the one about the character stays close in on it, while the one
// about the floor pulls back far enough to take in the ground around him.
const TUTORIAL_EDIT_VIEW_AZIMUTH_DEG = 25;
const TUTORIAL_CHARACTER_VIEW_POLAR_DEG = 65;
const TUTORIAL_CHARACTER_VIEW_ZOOM = 0.55;
const TUTORIAL_FLOOR_VIEW_POLAR_DEG = 55;
const TUTORIAL_FLOOR_VIEW_ZOOM = 0.3;

// How far the user has to swing the camera around before he is taken to have discovered that he can.
const TUTORIAL_CAMERA_TURN_DEG = 20;

const SinglePlayerModeConfigMap: {[singlePlayerMode: string]: SinglePlayerModeConfig} = {};

SinglePlayerModeConfigMap[TUTORIAL_SINGLE_PLAYER_MODE] = {
    loadMetadata: () => {
        const cachedMetadata = cachedMetadataByMode[TUTORIAL_SINGLE_PLAYER_MODE];
        if (cachedMetadata)
            return cachedMetadata;

        // Manually set parameters:
        const entranceVoxelCol = 5;
        const entranceVoxelRow = 30;
        const X1 = 5, X2 = 9, X3 = 7, Z1 = 7, Z2 = 5, Z3 = 9;

        if (X1 % 2 == 0 || X2 % 2 == 0 || X3 % 2 == 0 || Z1 % 2 == 0 || Z2 % 2 == 0 || Z3 % 2 == 0)
            throw new Error("X1,X2,X3,Z1,Z2,Z3 must all be positive odd integers.");

        // Algebraically derived parameters:
        const X = X1 + X2 + X3;
        const Z = Z1 + Z2 + Z3;
        const x0 = entranceVoxelCol - 0.5 * (X1 - 1);
        const z0 = entranceVoxelRow - Z + 1;

        const hotspots = {
            floor: {row: entranceVoxelRow - 3, col: entranceVoxelCol}, // The patch of floor the user is asked to select, a few steps in front of the entrance.
            table: {row: entranceVoxelRow - Z3 - Z2 + 1, col: entranceVoxelCol},
            passage: {row: z0 + Z1 + 0.5*(Z2 - 1), col: x0 + X1 + X2 - 1}, // The way through the wall that divides the second region from the third.
            npc: {row: z0 + Z1 + 0.5*(Z2 - 1), col: x0 + X - 1},
            door: {row: z0, col: x0 + X - 1 - 0.5*(X3 - 1)},
        };
        const rects = {
            floor1: {rowStart: z0 + Z1, colStart: x0, numRows: Z2 + Z3, numCols: X1},
            floor2: {rowStart: z0 + Z1, colStart: x0 + X1, numRows: Z2, numCols: X2},
            floor3: {rowStart: z0, colStart: x0 + X1 + X2, numRows: Z1 + Z2, numCols: X3},
            wall1: {rowStart: z0 + Z1, colStart: x0 + X1, numRows: Z2, numCols: 1},
            wall2: {rowStart: z0 + Z1, colStart: x0 + X1 + X2 - 1, numRows: Z2, numCols: 1},
            wall3: {rowStart: z0 + Z1, colStart: x0 + X - 2, numRows: Z2, numCols: 1},
            wall4: {rowStart: z0 + Z1 - 1, colStart: x0 + X1 + X2, numRows: 1, numCols: X3},
        };

        const metadata: SinglePlayerModeConfigMetadata = {entranceVoxelCol, entranceVoxelRow, hotspots, rects};
        cachedMetadataByMode[TUTORIAL_SINGLE_PLAYER_MODE] = metadata;
        return metadata;
    },
    texturePackPath: "default",
    buildRoom: (voxelGrid: VoxelGrid, objectGroup: ObjectGroup) =>
    {
        // Note: See the "Tutorial Room" section of `docs/geometry/room_generation.md` for
        // more details on what these variables mean geometrically.

        const config = SinglePlayerModeConfigMap[TUTORIAL_SINGLE_PLAYER_MODE];
        const c = config.loadMetadata();

        // Add the floors and walls.
        const grid = new RoomGenerationVoxelGrid();
        grid.createRegion(c.rects.floor1.rowStart, c.rects.floor1.colStart, c.rects.floor1.numRows, c.rects.floor1.numCols, 16, 51, 41);
        grid.createRegion(c.rects.floor2.rowStart, c.rects.floor2.colStart, c.rects.floor2.numRows, c.rects.floor2.numCols, 6, 51, 43);
        grid.createRegion(c.rects.floor3.rowStart, c.rects.floor3.colStart, c.rects.floor3.numRows, c.rects.floor3.numCols, 31, 51, 46);
        grid.createWalls(c.rects.wall1.rowStart, c.rects.wall1.colStart, c.rects.wall1.numRows, c.rects.wall1.numCols);
        grid.createWalls(c.rects.wall2.rowStart, c.rects.wall2.colStart, c.rects.wall2.numRows, c.rects.wall2.numCols);
        grid.createWalls(c.rects.wall3.rowStart, c.rects.wall3.colStart, c.rects.wall3.numRows, c.rects.wall3.numCols);
        grid.createWalls(c.rects.wall4.rowStart, c.rects.wall4.colStart, c.rects.wall4.numRows, c.rects.wall4.numCols);
        grid.generate(voxelGrid);

        // Add the table.
        RoomGenerationHelperUtil.addWall(voxelGrid.voxels, c.hotspots.table.row, c.hotspots.table.col,
            [29, 25, 29, 29, 29, 29], 0, 1); // The table consists of layer-0 and layer-1 blocks.

        // Carve the way through into the third region.
        RoomGenerationHelperUtil.removeWall(voxelGrid.voxels, c.hotspots.passage.row, c.hotspots.passage.col);

        // Add the NPC.
        objectGroup.objectById["npc"] = new AddObjectSignal("", "@npc", "Receptionist",
            ObjectTypeConfigMap.getIndexByType("Player"), "npc",
            new ObjectTransform(
                {x: c.hotspots.npc.col + 0.5, y: 0.5 * PLAYER_HEIGHT, z: c.hotspots.npc.row + 0.5},
                {x: 1, y: 0, z: 0}));

        // Add the door.
        objectGroup.objectById["door"] = new AddObjectSignal("", "", "",
            ObjectTypeConfigMap.getIndexByType("Door"), "door",
            new ObjectTransform(
                {x: c.hotspots.door.col + 0.5, y: 0, z: c.hotspots.door.row + 0.001},
                {x: 0, y: 0, z: 1}));
    },
    loadSteps: () =>
    {
        const cachedSteps = cachedStepsByMode[TUTORIAL_SINGLE_PLAYER_MODE];
        if (cachedSteps)
            return cachedSteps;

        const config = SinglePlayerModeConfigMap[TUTORIAL_SINGLE_PLAYER_MODE];
        const m = config.loadMetadata();

        const steps: {[stepName: string]: SinglePlayerStep} = {
            "initial": { // Drag to move
                startDelay: 0,
                actionsOnStart: [
                    {type: "ui_diagram", diagram: "drag_up", text: "Drag to move"},
                    {type: "feature_flag", flag: FeatureFlag.HideChatInput, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.DisableChatSend, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.ExitSinglePlayerOnDoorClick, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.DisableVoxelQuadSelectionChange, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.DisablePlayerSelectionChange, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.DisableManualVoxelBlockAddition, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.DisableManualVoxelBlockRemoval, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.DisableManualObjectAddition, enable: true},
                    // The way into edit mode, and the way back out of it, are each held back until
                    // the step that teaches them; who the user is and what he may do here is noise
                    // he has no use for while being led by the hand. What stays is the button that
                    // leaves the app, which must never be out of reach.
                    {type: "feature_flag", flag: FeatureFlag.HideEditModeButton, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.HideModeExitButton, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.HideUserIdentityLabels, enable: true},
                ],
                transitionRules: [{
                    requirements: [{type: "player_is_nearby", negate: true,
                        targetX: m.entranceVoxelCol+0.5, targetZ: m.entranceVoxelRow+0.5,
                        detectionDist: 0.5}],
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
                    {type: "ui_headline", text: "Start the edit mode."},
                    // The button sits in the top-right corner, with no room above it for an arrow.
                    {type: "ui_arrow", targetElementId: "editModeButton", arrowBias: "center",
                        arrowSide: "below"},
                    {type: "feature_flag", flag: FeatureFlag.HideEditModeButton, enable: false},
                    {type: "feature_flag", flag: FeatureFlag.DisablePlayerSelectionChange, enable: false},
                ],
                transitionRules: [{
                    requirements: [{type: "edit_mode_active", negate: false}],
                    nextStep: "change_camera_angle",
                    nextStepDelay: 0,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                    {type: "feature_flag", flag: FeatureFlag.HideEditModeButton, enable: true},
                    // The character stays selected from here until the user is asked to pick
                    // something else, so the next few steps have it to talk about.
                    {type: "feature_flag", flag: FeatureFlag.DisablePlayerSelectionChange, enable: true},
                ],
            },
            "change_camera_angle": {
                // Long enough for the camera to have settled into the orbit it enters the mode
                // with, since the view below is set against the one it has settled at.
                startDelay: 500,
                actionsOnStart: [
                    {type: "ui_headline", text: "This is you.<br>Watch it from different angles!"},
                    {type: "orbit_camera_pose", zoomAmount: TUTORIAL_CHARACTER_VIEW_ZOOM,
                        azimuthDeg: TUTORIAL_EDIT_VIEW_AZIMUTH_DEG,
                        polarDeg: TUTORIAL_CHARACTER_VIEW_POLAR_DEG},
                    {type: "ui_diagram", diagram: "drag_sideways", text: "Drag to look around",
                        placement: "side"},
                ],
                transitionRules: [{
                    requirements: [{type: "orbit_camera_angle_differs", negate: false,
                        azimuthDeg: TUTORIAL_EDIT_VIEW_AZIMUTH_DEG,
                        polarDeg: TUTORIAL_CHARACTER_VIEW_POLAR_DEG,
                        minDifferenceDeg: TUTORIAL_CAMERA_TURN_DEG}],
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
                    {type: "ui_headline", text: "Customize your look."},
                    {type: "ui_arrow", targetElementId: "customizePlayerOptions", arrowBias: "left"},
                ],
                transitionRules: [{
                    requirements: [{type: "manual_edits_made", negate: false,
                        editKind: "playerPartChanged", minCount: 1}],
                    nextStep: "select_floor",
                    nextStepDelay: 1000,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                ],
            },
            "select_floor": {
                startDelay: 0,
                actionsOnStart: [
                    {type: "ui_headline", text: "Select the floor."},
                    // Pulled back from the character, so that the ground he is standing on — and
                    // the patch of it being pointed at — is in the picture at all.
                    {type: "orbit_camera_pose", zoomAmount: TUTORIAL_FLOOR_VIEW_ZOOM,
                        azimuthDeg: TUTORIAL_EDIT_VIEW_AZIMUTH_DEG,
                        polarDeg: TUTORIAL_FLOOR_VIEW_POLAR_DEG},
                    {type: "gizmo_downward_arrow", targetX: m.hotspots.floor.col+0.5,
                        targetY: 0, targetZ: m.hotspots.floor.row+0.5},
                    {type: "gizmo_voxel_quad_outline_rect",
                        row: m.hotspots.floor.row, col: m.hotspots.floor.col,
                        collisionLayer: COLLISION_LAYER_NULL, facingAxis: "y", orientation: "+"},
                    {type: "feature_flag", flag: FeatureFlag.DisableVoxelQuadSelectionChange, enable: false},
                ],
                transitionRules: [{
                    // Any quad will do: the one being pointed at is an invitation, not a demand,
                    // and the steps that follow work on whichever one the user picked.
                    requirements: [{type: "voxel_quad_selected", negate: false}],
                    nextStep: "change_texture",
                    nextStepDelay: 0,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                    {type: "feature_flag", flag: FeatureFlag.DisableVoxelQuadSelectionChange, enable: true},
                ],
            },
            "change_texture": {
                startDelay: 500,
                actionsOnStart: [
                    {type: "ui_headline", text: "Change the texture."},
                    {type: "ui_arrow", targetElementId: "voxelQuadTextureOptions", arrowBias: "right"},
                    {type: "ui_outline_rect", targetElementId: "voxelQuadTextureOptions"},
                ],
                transitionRules: [{
                    requirements: [{type: "manual_edits_made", negate: false,
                        editKind: "voxelQuadTextureChanged", minCount: 1}],
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
                    {type: "ui_headline", text: "Add a block."},
                    {type: "ui_arrow", targetElementId: "addVoxelBlockButton", arrowBias: "center"},
                    {type: "ui_outline_rect", targetElementId: "addVoxelBlockButton"},
                    {type: "feature_flag", flag: FeatureFlag.DisableManualVoxelBlockAddition, enable: false},
                    // The selection follows the block that is about to be built, which is what
                    // leaves the next step something to take away again.
                    {type: "feature_flag", flag: FeatureFlag.DisableVoxelQuadSelectionChange, enable: false},
                ],
                transitionRules: [{
                    requirements: [{type: "manual_edits_made", negate: false,
                        editKind: "voxelBlockAdded", minCount: 1}],
                    nextStep: "remove_block",
                    nextStepDelay: 0,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                    {type: "feature_flag", flag: FeatureFlag.DisableManualVoxelBlockAddition, enable: true},
                ],
            },
            "remove_block": {
                startDelay: 500,
                actionsOnStart: [
                    {type: "ui_headline", text: "Remove the block."},
                    {type: "ui_arrow", targetElementId: "removeVoxelBlockButton", arrowBias: "center"},
                    {type: "ui_outline_rect", targetElementId: "removeVoxelBlockButton"},
                    {type: "feature_flag", flag: FeatureFlag.DisableManualVoxelBlockRemoval, enable: false},
                ],
                transitionRules: [{
                    requirements: [{type: "manual_edits_made", negate: false,
                        editKind: "voxelBlockRemoved", minCount: 1}],
                    nextStep: "exit_edit_mode",
                    nextStepDelay: 0,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                    {type: "feature_flag", flag: FeatureFlag.DisableManualVoxelBlockRemoval, enable: true},
                ],
            },
            "exit_edit_mode": {
                startDelay: 500,
                actionsOnStart: [
                    {type: "ui_headline", text: "Exit the edit mode."},
                    // The button shares the top edge with the headline, so it is pointed at from
                    // below, like the one that opened the mode.
                    {type: "ui_arrow", targetElementId: "modeExitButton", arrowBias: "center",
                        arrowSide: "below"},
                    {type: "feature_flag", flag: FeatureFlag.HideModeExitButton, enable: false},
                ],
                transitionRules: [{
                    requirements: [{type: "edit_mode_active", negate: true}],
                    nextStep: "go_to_npc",
                    nextStepDelay: 0,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                    {type: "feature_flag", flag: FeatureFlag.HideModeExitButton, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.DisableVoxelQuadSelectionChange, enable: true},
                ],
            },
            "go_to_npc": {
                startDelay: 500,
                actionsOnStart: [
                    {type: "ui_headline", text: "Follow the arrow."},
                    {type: "gizmo_navigation_arrow",
                        targetX: m.hotspots.npc.col+0.5, targetZ: m.hotspots.npc.row+0.5},
                    // Both walls between the user and the receptionist come down at once, the whole
                    // way there being one errand now.
                    {type: "remove_voxel_blocks",
                        rowStart: m.rects.wall1.rowStart,
                        colStart: m.rects.wall1.colStart,
                        numRows: m.rects.wall1.numRows,
                        numCols: m.rects.wall1.numCols,
                        collisionLayerMin: COLLISION_LAYER_MIN,
                        collisionLayerMax: COLLISION_LAYER_MAX},
                    {type: "remove_voxel_blocks",
                        rowStart: m.rects.wall3.rowStart,
                        colStart: m.rects.wall3.colStart,
                        numRows: m.rects.wall3.numRows,
                        numCols: m.rects.wall3.numCols,
                        collisionLayerMin: COLLISION_LAYER_MIN,
                        collisionLayerMax: COLLISION_LAYER_MAX},
                ],
                transitionRules: [{
                    requirements: [{type: "player_is_nearby", negate: false,
                        targetX: m.hotspots.npc.col+0.5, targetZ: m.hotspots.npc.row+0.5,
                        detectionDist: 5}],
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
                    {type: "ui_headline", text: "This is your receptionist.<br>Type your message to say \"Hello\"."},
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
                    {type: "ui_headline", text: "Click 'Send' to send your message."},
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
                    {type: "ui_headline", text: "Look! The receptionist greeted you back."},
                    {type: "set_object_metadata", objectId: "npc",
                            metadataKey: ObjectMetadataKeyEnumMap.SentMessage, metadataValue: "Hello!"},
                    {type: "object_bounce", objectId: "npc", durationSeconds: 1.25,
                            positionOffset: {x: 0, y: 0.3, z: 0}, oscillations: 3}, // The NPC bobs up and down to "nod" as it greets back.
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
                    {type: "ui_headline", text: "Exit through the door."},
                    {type: "gizmo_navigation_arrow",
                        targetX: m.hotspots.door.col+0.5, targetZ: m.hotspots.door.row-5},
                    {type: "remove_voxel_blocks",
                        rowStart: m.rects.wall4.rowStart,
                        colStart: m.rects.wall4.colStart,
                        numRows: m.rects.wall4.numRows,
                        numCols: m.rects.wall4.numCols,
                        collisionLayerMin: COLLISION_LAYER_MIN,
                        collisionLayerMax: COLLISION_LAYER_MAX},
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
        // When the tutorial ends (completed or skipped), disable every feature flag.
        const actions: SinglePlayerAction[] = [];
        for (const flag of Object.values(FeatureFlag))
        {
            if (typeof flag === "number")
                actions.push({type: "feature_flag", flag, enable: false});
        }
        return actions;
    },
};

export default SinglePlayerModeConfigMap;