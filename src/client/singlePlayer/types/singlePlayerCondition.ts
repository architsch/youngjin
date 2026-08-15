import { ObjectMetadataKey } from "../../../shared/object/types/objectMetadataKey";
import ManualEditKind from "../../../shared/system/types/manualEditKind";
import SinglePlayerParam from "./singlePlayerParam";

// A small tagged predicate a step waits on (see SinglePlayerConditionMap for what each one asks).
// Whatever the condition measures against is a SinglePlayerParam, on the same terms as an action's
// parameters (see SinglePlayerAction): a step may be waiting for the user to move away from a view
// that was only settled when the step began.
type SinglePlayerCondition =
    | {type: "player_is_nearby", negate: boolean, targetX: SinglePlayerParam<number>,
        targetZ: SinglePlayerParam<number>, detectionDist: SinglePlayerParam<number>}
    // Every property of the wanted quad is optional: a step that cares which quad the user picked
    // names as much of it as it cares about, while one that only asks for a quad names none of it.
    | {type: "voxel_quad_selected", negate: boolean, row?: SinglePlayerParam<number>,
        col?: SinglePlayerParam<number>, collisionLayer?: SinglePlayerParam<number>,
        facingAxis?: "x" | "y" | "z", orientation?: "-" | "+"}
    | {type: "voxel_quad_texture_equals", negate: boolean, row: SinglePlayerParam<number>,
        col: SinglePlayerParam<number>, collisionLayer: SinglePlayerParam<number>,
        facingAxis: "x" | "y" | "z", orientation: "-" | "+",
        textureIndex: SinglePlayerParam<number>}
    | {type: "voxel_block_exists", negate: boolean, row: SinglePlayerParam<number>,
        col: SinglePlayerParam<number>, collisionLayer: SinglePlayerParam<number>}
    | {type: "edit_mode_active", negate: boolean}
    | {type: "manual_edits_made", negate: boolean, editKind: ManualEditKind,
        minCount: SinglePlayerParam<number>}
    | {type: "orbit_camera_angle_differs", negate: boolean,
        azimuthDeg: SinglePlayerParam<number>, polarDeg: SinglePlayerParam<number>,
        minDifferenceDeg: SinglePlayerParam<number>}
    | {type: "always_true"}
    | {type: "chat_input_passes_condition", chatInputCondition: (str: string) => boolean}
    | {type: "object_metadata_passes_condition", objectId: string,
        metadataKey: ObjectMetadataKey, metadataValueCondition: (str: string) => boolean}
    | {type: "room_exited"}

export default SinglePlayerCondition;
