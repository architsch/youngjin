import ObjectTypeConfigMap from "../../object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../object/types/addObjectSignal";
import ObjectGroup from "../../object/types/objectGroup";
import { ObjectMetadataKeyEnumMap } from "../../object/types/objectMetadataKey";
import ObjectTransform from "../../object/types/objectTransform";
import RoomGenerationVoxelGrid from "../../room/types/roomGeneration/roomGenerationVoxelGrid";
import RoomGenerationHelperUtil from "../../room/util/roomGenerationHelperUtil";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, PLAYER_HEIGHT, TUTORIAL_SINGLE_PLAYER_MODE } from "../../system/sharedConstants";
import { FeatureFlag } from "../../system/types/featureFlag";
import VoxelGrid from "../../voxel/types/voxelGrid";
import SinglePlayerAction from "../types/singlePlayerAction";
import SinglePlayerModeConfig from "../types/singlePlayerModeConfig";
import SinglePlayerModeConfigMetadata from "../types/singlePlayerModeConfigMetadata";
import SinglePlayerStep from "../types/singlePlayerStep";

const cachedMetadataByMode: {[singlePlayerMode: string]: SinglePlayerModeConfigMetadata} = {};
const cachedStepsByMode: {[singlePlayerMode: string]: {[stepName: string]: SinglePlayerStep}} = {};

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
            table: {row: entranceVoxelRow - Z3 - Z2 + 1, col: entranceVoxelCol},
            obstacle: {row: z0 + Z1 + 0.5*(Z2 - 1), col: x0 + X1 + X2 - 1},
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
            [29, 25, 29, 29, 29, 29], 0, 1); // The table consists of layer-0 and layer-1 blocks. The player is meant to select the top (i.e. (+y)-facing) quad of the layer-1 block.

        // Carve out part of the wall and add the obstacle.
        RoomGenerationHelperUtil.removeWall(voxelGrid.voxels, c.hotspots.obstacle.row, c.hotspots.obstacle.col);
        RoomGenerationHelperUtil.addWall(voxelGrid.voxels, c.hotspots.obstacle.row, c.hotspots.obstacle.col,
            [43, 43, 43, 43, 43, 43], 2, 2); // The obstacle is a single voxel block which occupies layer-2 of the hotspot.
        
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
                    {type: "feature_flag", flag: FeatureFlag.DisableManualVoxelBlockAddition, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.DisableManualVoxelBlockRemoval, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.DisableManualVoxelBlockMovement, enable: true},
                    {type: "feature_flag", flag: FeatureFlag.DisableManualObjectAddition, enable: true},
                ],
                transitionRules: [{
                    requirements: [{type: "player_is_nearby", negate: true,
                        targetX: m.entranceVoxelCol+0.5, targetZ: m.entranceVoxelRow+0.5,
                        detectionDist: 0.5}],
                    nextStep: "go_to_table",
                    nextStepDelay: 500,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                ],
            },
            "go_to_table": {
                startDelay: 0,
                actionsOnStart: [
                    {type: "ui_headline", text: "Follow the arrow."},
                    {type: "gizmo_navigation_arrow",
                        targetX: m.hotspots.table.col+0.5, targetZ: m.hotspots.table.row+0.5},
                ],
                transitionRules: [{
                    requirements: [{type: "player_is_nearby", negate: false,
                        targetX: m.hotspots.table.col+0.5, targetZ: m.hotspots.table.row+0.5,
                        detectionDist: 5}],
                    nextStep: "select_table",
                    nextStepDelay: 0,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                ],
            },
            "select_table": {
                startDelay: 0,
                actionsOnStart: [
                    {type: "ui_headline", text: "Select the table."},
                    {type: "gizmo_downward_arrow", targetX: m.hotspots.table.col+0.5,
                        targetY: 1, targetZ: m.hotspots.table.row+0.5},
                    {type: "gizmo_voxel_quad_outline_rect",
                        row: m.hotspots.table.row, col: m.hotspots.table.col,
                        collisionLayer: 1, facingAxis: "y", orientation: "+"},
                    {type: "feature_flag", flag: FeatureFlag.DisableVoxelQuadSelectionChange, enable: false},
                ],
                transitionRules: [{
                    requirements: [{type: "voxel_quad_selected", negate: false,
                        row: m.hotspots.table.row, col: m.hotspots.table.col,
                        collisionLayer: 1, facingAxis: "y", orientation: "+"}],
                    nextStep: "change_table_texture",
                    nextStepDelay: 0,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                    {type: "feature_flag", flag: FeatureFlag.DisableVoxelQuadSelectionChange, enable: true},
                ],
            },
            "change_table_texture": {
                startDelay: 500,
                actionsOnStart: [
                    {type: "ui_headline", text: "Change the table's texture."},
                    {type: "ui_arrow", targetElementId: "voxelQuadTextureOptions", arrowBias: "right"},
                    {type: "ui_outline_rect", targetElementId: "voxelQuadTextureOptions"},
                ],
                transitionRules: [{
                    requirements: [{type: "voxel_quad_texture_equals", negate: true,
                        row: m.hotspots.table.row, col: m.hotspots.table.col,
                        collisionLayer: 1, facingAxis: "y", orientation: "+",
                        textureIndex: 25}],
                    nextStep: "add_block_to_table",
                    nextStepDelay: 0,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                ],
            },
            "add_block_to_table": {
                startDelay: 500,
                actionsOnStart: [
                    {type: "ui_headline", text: "Add a block to the table."},
                    {type: "ui_arrow", targetElementId: "addVoxelBlockButton", arrowBias: "center"},
                    {type: "ui_outline_rect", targetElementId: "addVoxelBlockButton"},
                    {type: "feature_flag", flag: FeatureFlag.DisableManualVoxelBlockAddition, enable: false},
                ],
                transitionRules: [{
                    requirements: [{type: "voxel_block_exists", negate: false,
                        row: m.hotspots.table.row, col: m.hotspots.table.col,
                        collisionLayer: 2}],
                    nextStep: "go_to_obstacle",
                    nextStepDelay: 0,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                    {type: "force_unselect_voxel"},
                    {type: "feature_flag", flag: FeatureFlag.DisableManualVoxelBlockAddition, enable: true},
                ],
            },
            "go_to_obstacle": {
                startDelay: 500,
                actionsOnStart: [
                    {type: "ui_headline", text: "Follow the arrow."},
                    {type: "gizmo_navigation_arrow",
                        targetX: m.hotspots.obstacle.col+0.5, targetZ: m.hotspots.obstacle.row+0.5},
                    {type: "remove_voxel_blocks",
                        rowStart: m.rects.wall1.rowStart,
                        colStart: m.rects.wall1.colStart,
                        numRows: m.rects.wall1.numRows,
                        numCols: m.rects.wall1.numCols,
                        collisionLayerMin: COLLISION_LAYER_MIN,
                        collisionLayerMax: COLLISION_LAYER_MAX},
                ],
                transitionRules: [{
                    requirements: [{type: "player_is_nearby", negate: false,
                        targetX: m.hotspots.obstacle.col+0.5, targetZ: m.hotspots.obstacle.row+0.5,
                        detectionDist: 5}],
                    nextStep: "select_obstacle",
                    nextStepDelay: 0,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                ],
            },
            "select_obstacle": {
                startDelay: 0,
                actionsOnStart: [
                    {type: "ui_headline", text: "Select the obstacle."},
                    {type: "gizmo_downward_arrow", targetX: m.hotspots.obstacle.col,
                        targetY: 1.5, targetZ: m.hotspots.obstacle.row+0.5},
                    {type: "gizmo_voxel_quad_outline_rect",
                        row: m.hotspots.obstacle.row, col: m.hotspots.obstacle.col,
                        collisionLayer: 2, facingAxis: "x", orientation: "-"},
                    {type: "feature_flag", flag: FeatureFlag.DisableVoxelQuadSelectionChange, enable: false},
                ],
                transitionRules: [{
                        requirements: [{type: "voxel_quad_selected", negate: false,
                            row: m.hotspots.obstacle.row, col: m.hotspots.obstacle.col,
                            collisionLayer: 2, facingAxis: "y", orientation: "+"}],
                        nextStep: "remove_obstacle",
                        nextStepDelay: 0,
                    },
                    {
                        requirements: [{type: "voxel_quad_selected", negate: false,
                            row: m.hotspots.obstacle.row, col: m.hotspots.obstacle.col,
                            collisionLayer: 2, facingAxis: "x", orientation: "-"}],
                        nextStep: "remove_obstacle",
                        nextStepDelay: 0,
                    }
                ],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                    {type: "feature_flag", flag: FeatureFlag.DisableVoxelQuadSelectionChange, enable: true},
                ],
            },
            "remove_obstacle": {
                startDelay: 500,
                actionsOnStart: [
                    {type: "ui_headline", text: "Remove the obstacle."},
                    {type: "ui_arrow", targetElementId: "removeVoxelBlockButton", arrowBias: "center"},
                    {type: "ui_outline_rect", targetElementId: "removeVoxelBlockButton"},
                    {type: "feature_flag", flag: FeatureFlag.DisableManualVoxelBlockRemoval, enable: false},
                ],
                transitionRules: [{
                    requirements: [{type: "voxel_block_exists", negate: true,
                        row: m.hotspots.obstacle.row, col: m.hotspots.obstacle.col,
                        collisionLayer: 2}],
                    nextStep: "go_to_npc",
                    nextStepDelay: 0,
                }],
                actionsOnEnd: [
                    {type: "clear_all_ui_and_gizmo"},
                    {type: "force_unselect_voxel"},
                    {type: "feature_flag", flag: FeatureFlag.DisableManualVoxelBlockRemoval, enable: true},
                ],
            },
            "go_to_npc": {
                startDelay: 500,
                actionsOnStart: [
                    {type: "ui_headline", text: "Follow the arrow."},
                    {type: "gizmo_navigation_arrow",
                        targetX: m.hotspots.npc.col+0.5, targetZ: m.hotspots.npc.row+0.5},
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
        // The tutorial is the only thing that turns feature flags on, and none of the
        // restrictions it imposes should outlive it — so when it ends (completed or skipped),
        // disable every feature flag rather than tracking which ones happen to still be on.
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