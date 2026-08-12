import { ObjectMetadataKey } from "../../object/types/objectMetadataKey";
import ManualEditKind from "../../system/types/manualEditKind";

type SinglePlayerCondition =
    | {type: "player_is_nearby", negate: boolean, targetX: number, targetZ: number, detectionDist: number}
    // Every property of the wanted quad is optional: a step that cares which quad the user picked
    // names as much of it as it cares about, while one that only asks for a quad names none of it.
    | {type: "voxel_quad_selected", negate: boolean, row?: number, col?: number,
        collisionLayer?: number, facingAxis?: "x" | "y" | "z", orientation?: "-" | "+"}
    | {type: "voxel_quad_texture_equals", negate: boolean, row: number, col: number,
        collisionLayer: number, facingAxis: "x" | "y" | "z", orientation: "-" | "+", textureIndex: number}
    | {type: "voxel_block_exists", negate: boolean, row: number, col: number, collisionLayer: number}
    | {type: "edit_mode_active", negate: boolean}
    | {type: "manual_edits_made", negate: boolean, editKind: ManualEditKind, minCount: number}
    | {type: "orbit_camera_angle_differs", negate: boolean,
        azimuthDeg: number, polarDeg: number, minDifferenceDeg: number}
    | {type: "always_true"}
    | {type: "chat_input_passes_condition", chatInputCondition: (str: string) => boolean}
    | {type: "object_metadata_passes_condition", objectId: string,
        metadataKey: ObjectMetadataKey, metadataValueCondition: (str: string) => boolean}
    | {type: "room_exited"}

export default SinglePlayerCondition;
