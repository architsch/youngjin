import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import SinglePlayerCondition from "../../../shared/singlePlayer/types/singlePlayerCondition";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import App from "../../app";
import ClientObjectManager from "../../object/clientObjectManager";
import ClientObjectUtil from "../../object/util/clientObjectUtil";
import { chatTextInputObservable, voxelQuadSelectionObservable } from "../../system/clientObservables";
import { ongoingClientProcessExists } from "../../system/types/clientProcess";

const SinglePlayerConditionMap: {
    [K in SinglePlayerCondition["type"]]: (condition: Extract<SinglePlayerCondition, {type: K}>) => boolean;
} =
{
    "player_is_nearby": (condition) =>
    {
        const result = ClientObjectUtil.playerIsInCircle(
            condition.targetX, condition.targetZ, condition.detectionDist);
        return condition.negate ? !result : result;
    },
    "voxel_quad_selected": (condition) =>
    {
        let result = false;
        const selection = voxelQuadSelectionObservable.peek();
        if (selection && selection.voxel.row == condition.row && selection.voxel.col == condition.col)
        {
            const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(selection.quadIndex);
            const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(selection.quadIndex);
            const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(selection.quadIndex);
            if (orientation == condition.orientation && facingAxis == condition.facingAxis &&
                collisionLayer == condition.collisionLayer)
            {
                result = true;
            }
        }
        return condition.negate ? !result : result;
    },
    "voxel_quad_texture_equals": (condition) =>
    {
        let result = false;
        const room = App.getCurrentRoom();
        if (room)
        {
            const quadIndex = VoxelQueryUtil.getVoxelQuadIndex(condition.row, condition.col,
                condition.facingAxis, condition.orientation, condition.collisionLayer);
            const quadTextureIndex = App.getVoxelQuads()[quadIndex] & 0b01111111;
            result = quadTextureIndex == condition.textureIndex;
        }
        return condition.negate ? !result : result;
    },
    "voxel_block_exists": (condition) =>
    {
        let result = false;
        const room = App.getCurrentRoom();
        if (room)
        {
            const voxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, condition.row, condition.col);
            result = voxel != undefined &&
                VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, condition.collisionLayer);
        }
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