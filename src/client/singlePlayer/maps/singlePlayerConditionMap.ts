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
import ClientEventHistoryUtil from "../../system/util/clientEventHistoryUtil";
import { ongoingClientProcessExists } from "../../system/types/clientProcess";
import SinglePlayerCondition from "../types/singlePlayerCondition";
import { ClientEventType } from "../../system/types/clientEventType";

// Evaluated against live game state; parameters are evaluated here (see SinglePlayerParam).
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
        // No quad given matches any selection at all.
        const selection = voxelQuadSelectionObservable.peek();
        const result = selection != null &&
            (condition.quadIndex == undefined || selection.quadIndex == condition.quadIndex());
        return condition.negate ? !result : result;
    },
    "voxel_quad_texture_equals": (condition) =>
    {
        let result = false;
        const room = App.getCurrentRoom();
        if (room)
        {
            const quadTextureIndex = App.getVoxelQuads()[condition.quadIndex()] & 0b01111111;
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
    "client_events_occurred_after_step_began": (condition) =>
    {
        const stepStartTime = ClientEventHistoryUtil.getLatestEventTime(ClientEventType.SinglePlayerStepChanged);
        const numEvents = ClientEventHistoryUtil.getNumEventsAfterTime(condition.eventType, stepStartTime);
        const result = numEvents >= condition.minNumEvents();
        return condition.negate ? !result : result;
    },
    "orbit_camera_angle_differs": (condition) =>
    {
        // Compared against the view the step recorded when it began.
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
