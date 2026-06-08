import { ObjectMetadataKey } from "../../object/types/objectMetadataKey";

type SinglePlayerCondition =
    | {type: "player_is_nearby", negate: boolean, targetX: number, targetZ: number, detectionDist: number}
    | {type: "voxel_quad_selected", negate: boolean, row: number, col: number,
        collisionLayer: number, facingAxis: "x" | "y" | "z", orientation: "-" | "+"}
    | {type: "voxel_quad_texture_equals", negate: boolean, row: number, col: number,
        collisionLayer: number, facingAxis: "x" | "y" | "z", orientation: "-" | "+", textureIndex: number}
    | {type: "voxel_block_exists", negate: boolean, row: number, col: number, collisionLayer: number}
    | {type: "always_true"}
    | {type: "chat_input_passes_condition", chatInputCondition: (str: string) => boolean}
    | {type: "object_metadata_passes_condition", objectId: string,
        metadataKey: ObjectMetadataKey, metadataValueCondition: (str: string) => boolean}
    | {type: "room_exited"}

export default SinglePlayerCondition;