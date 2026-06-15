import { ObjectMetadataKey } from "../../object/types/objectMetadataKey";
import Vec3 from "../../math/types/vec3";
import { FeatureFlag } from "../../system/types/featureFlag";

type SinglePlayerAction =
    | {type: "clear_all_ui_and_gizmo"}
    | {type: "ui_headline", text: string}
    | {type: "ui_diagram", diagram: "drag_up", text: string}
    | {type: "ui_arrow", targetElementId: string, arrowBias: "center" | "left" | "right"}
    | {type: "ui_outline_rect", targetElementId: string}
    | {type: "gizmo_navigation_arrow", targetX: number, targetZ: number}
    | {type: "gizmo_downward_arrow", targetX: number, targetY: number, targetZ: number}
    | {type: "gizmo_voxel_quad_outline_rect", row: number, col: number,
        collisionLayer: number, facingAxis: "x" | "y" | "z", orientation: "-" | "+"}
    | {type: "feature_flag", flag: FeatureFlag, enable: boolean}
    | {type: "force_unselect_voxel"}
    | {type: "remove_voxel_blocks", rowStart: number, colStart: number,
        numRows: number, numCols: number, collisionLayerMin: number, collisionLayerMax: number}
    | {type: "set_object_metadata", objectId: string,
        metadataKey: ObjectMetadataKey, metadataValue: string}
    | {type: "object_bounce", objectId: string, durationSeconds: number,
        positionOffset?: Vec3, rotationOffset?: Vec3, scaleMultiplier?: Vec3, oscillations?: number}

export default SinglePlayerAction;