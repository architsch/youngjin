import { ObjectMetadataKey } from "../../../shared/object/types/objectMetadataKey";
import { ClientEventType } from "../../system/types/clientEventType";
import SinglePlayerParam from "./singlePlayerParam";

// A tagged step predicate (see SinglePlayerConditionMap). Inputs are SinglePlayerParams, like actions.
type SinglePlayerCondition =
    | {type: "player_is_nearby", negate: boolean, targetX: SinglePlayerParam<number>,
        targetZ: SinglePlayerParam<number>, detectionDist: SinglePlayerParam<number>}
    // No quad given matches any selection at all.
    | {type: "voxel_quad_selected", negate: boolean, quadIndex?: SinglePlayerParam<number>}
    | {type: "voxel_quad_texture_equals", negate: boolean, quadIndex: SinglePlayerParam<number>,
        textureIndex: SinglePlayerParam<number>}
    | {type: "voxel_block_exists", negate: boolean, row: SinglePlayerParam<number>,
        col: SinglePlayerParam<number>, collisionLayer: SinglePlayerParam<number>}
    | {type: "edit_mode_active", negate: boolean}
    | {type: "client_events_occurred_after_step_began", negate: boolean, eventType: ClientEventType,
        minNumEvents: SinglePlayerParam<number>}
    | {type: "orbit_camera_angle_differs", negate: boolean,
        azimuthDeg: SinglePlayerParam<number>, polarDeg: SinglePlayerParam<number>,
        minDifferenceDeg: SinglePlayerParam<number>}
    | {type: "always_true"}
    | {type: "chat_input_passes_condition", chatInputCondition: (str: string) => boolean}
    | {type: "object_metadata_passes_condition", objectId: string,
        metadataKey: ObjectMetadataKey, metadataValueCondition: (str: string) => boolean}
    | {type: "room_exited"}

export default SinglePlayerCondition;
