import * as THREE from "three";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import App from "../../app";
import GameModeUtil from "../../system/util/gameModeUtil";
import NumUtil from "../../../shared/math/util/numUtil";
import ClientObjectManager from "../../object/clientObjectManager";
import ClientObjectUtil from "../../object/util/clientObjectUtil";
import { chatTextInputObservable, orbitCameraAnglesObservable,
    voxelQuadSelectionObservable } from "../../system/clientObservables";
import ManualEditCountUtil from "../../system/util/manualEditCountUtil";
import { ongoingClientProcessExists } from "../../system/types/clientProcess";
import SinglePlayerCondition from "../types/singlePlayerCondition";

// Each condition is asked of the game as it stands at that moment, which it reaches for directly.
// What it measures against comes from its own parameters, read here rather than written into the
// step (see SinglePlayerParam).
const SinglePlayerConditionMap: {
    [K in SinglePlayerCondition["type"]]:
        (condition: Extract<SinglePlayerCondition, {type: K}>) => boolean;
} =
{
    "player_is_nearby": (condition) =>
    {
        const result = ClientObjectUtil.playerIsInCircle(condition.targetX(),
            condition.targetZ(), condition.detectionDist());
        return condition.negate ? !result : result;
    },
    "voxel_quad_selected": (condition) =>
    {
        // Whatever the condition left unsaid, it does not care about: a step may ask for one
        // particular quad, or merely for the user having picked one out at all.
        const selection = voxelQuadSelectionObservable.peek();
        const result = selection != null &&
            (condition.row == undefined || selection.voxel.row == condition.row()) &&
            (condition.col == undefined || selection.voxel.col == condition.col()) &&
            (condition.orientation == undefined || condition.orientation ==
                VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(selection.quadIndex)) &&
            (condition.facingAxis == undefined || condition.facingAxis ==
                VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(selection.quadIndex)) &&
            (condition.collisionLayer == undefined || condition.collisionLayer() ==
                VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(selection.quadIndex));
        return condition.negate ? !result : result;
    },
    "voxel_quad_texture_equals": (condition) =>
    {
        let result = false;
        const room = App.getCurrentRoom();
        if (room)
        {
            const quadIndex = VoxelQueryUtil.getVoxelQuadIndex(condition.row(), condition.col(),
                condition.facingAxis, condition.orientation, condition.collisionLayer());
            const quadTextureIndex = App.getVoxelQuads()[quadIndex] & 0b01111111;
            result = quadTextureIndex == condition.textureIndex();
        }
        return condition.negate ? !result : result;
    },
    "voxel_block_exists": (condition) =>
    {
        let result = false;
        const room = App.getCurrentRoom();
        if (room)
        {
            const voxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels,
                condition.row(), condition.col());
            result = voxel != undefined &&
                VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, condition.collisionLayer());
        }
        return condition.negate ? !result : result;
    },
    "edit_mode_active": (condition) =>
    {
        const result = GameModeUtil.isInEditMode();
        return condition.negate ? !result : result;
    },
    "manual_edits_made": (condition) =>
    {
        // What the user has changed with his own hands, rather than how the world has ended up:
        // a step that teaches an edit lets the user pick what to edit, so the act is the lesson.
        const result = ManualEditCountUtil.getCount(condition.editKind) >= condition.minCount();
        return condition.negate ? !result : result;
    },
    "orbit_camera_angle_differs": (condition) =>
    {
        // Measured against a view the step noted down for itself when it began, which is what makes
        // "the user has moved the camera" a question about the here and now rather than about
        // everything he has done since.
        const angles = orbitCameraAnglesObservable.peek();
        const azimuthDiff = NumUtil.getAngleDifference(angles.azimuth,
            THREE.MathUtils.degToRad(condition.azimuthDeg()));
        const polarDiff = NumUtil.getAngleDifference(angles.polar,
            THREE.MathUtils.degToRad(condition.polarDeg()));
        const result = Math.max(azimuthDiff, polarDiff) >=
            THREE.MathUtils.degToRad(condition.minDifferenceDeg());
        return condition.negate ? !result : result;
    },
    "always_true": (condition) =>
    {
        return true;
    },
    "chat_input_passes_condition": (condition) =>
    {
        const chatInput = chatTextInputObservable.peek();
        return condition.chatInputCondition(chatInput);
    },
    "object_metadata_passes_condition": (condition) =>
    {
        const obj = ClientObjectManager.getObjectById(condition.objectId);
        if (!obj)
        {
            console.error(`SinglePlayerConditionMap :: Object doesn't exits (objectId = ${condition.objectId})`);
            return false;
        }
        const metadataValueEncoded = obj.params.metadata[condition.metadataKey];
        return metadataValueEncoded != undefined &&
            condition.metadataValueCondition(metadataValueEncoded.str);
    },
    "room_exited": (condition) =>
    {
        return ongoingClientProcessExists("roomChange") ||
            App.getCurrentRoom()?.roomType != RoomTypeEnumMap.SinglePlayer;
    },
}

export default SinglePlayerConditionMap;
