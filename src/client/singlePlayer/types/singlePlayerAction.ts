import { ObjectMetadataKey } from "../../../shared/object/types/objectMetadataKey";
import Vec3 from "../../../shared/math/types/vec3";
import { FeatureFlag } from "../../../shared/system/types/featureFlag";
import SinglePlayerParam from "./singlePlayerParam";
import CameraMode from "../../graphics/types/cameraMode";

// A small tagged command a step carries out on its way in or on its way out (see
// SinglePlayerActionMap for what each one does).
//
// Whatever an action acts *with* — a coordinate, a count, a line of text — is a SinglePlayerParam
// rather than a value, so that a step may work it out from where the user has got to instead of
// having to know it in advance. Whatever names *what* the action acts on or which command it is —
// a feature flag, a face of a voxel, a UI element's id, an object's id — stays a plain value: those
// pick the command out rather than feed it.
type SinglePlayerAction =
    | {type: "clear_all_ui_and_gizmo"}
    | {type: "ui_headline", text: SinglePlayerParam<string>}
    | {type: "ui_diagram", diagram: "drag_up" | "drag_sideways", text: SinglePlayerParam<string>,
        placement?: "center" | "side"}
    | {type: "ui_arrow", targetElementId: string, arrowBias: "center" | "left" | "right",
        arrowSide?: "above" | "below"}
    | {type: "ui_outline_rect", targetElementId: string}
    | {type: "gizmo_navigation_arrow", targetX: SinglePlayerParam<number>,
        targetZ: SinglePlayerParam<number>}
    | {type: "gizmo_downward_arrow", targetX: SinglePlayerParam<number>,
        targetY: SinglePlayerParam<number>, targetZ: SinglePlayerParam<number>}
    | {type: "gizmo_voxel_quad_outline_rect", row: SinglePlayerParam<number>,
        col: SinglePlayerParam<number>, collisionLayer: SinglePlayerParam<number>,
        facingAxis: "x" | "y" | "z", orientation: "-" | "+"}
    | {type: "feature_flag", flag: FeatureFlag, enable: boolean}
    | {type: "select_voxel_quad", row: SinglePlayerParam<number>, col: SinglePlayerParam<number>,
        collisionLayer: SinglePlayerParam<number>, facingAxis: "x" | "y" | "z",
        orientation: "-" | "+"}
    | {type: "set_variable", name: string, computeValue: SinglePlayerParam<any>}
    | {type: "set_camera_mode", mode: CameraMode}
    | {type: "orbit_camera_pose", zoomAmount: SinglePlayerParam<number>,
        azimuthDeg: SinglePlayerParam<number>, polarDeg: SinglePlayerParam<number>}
    | {type: "orbit_camera_target_override", targetX: SinglePlayerParam<number>,
        targetY: SinglePlayerParam<number>, targetZ: SinglePlayerParam<number>}
    | {type: "clear_orbit_camera_target_override"}
    | {type: "remove_voxel_blocks", rowStart: SinglePlayerParam<number>,
        colStart: SinglePlayerParam<number>, numRows: SinglePlayerParam<number>,
        numCols: SinglePlayerParam<number>, collisionLayerMin: SinglePlayerParam<number>,
        collisionLayerMax: SinglePlayerParam<number>}
    | {type: "set_object_metadata", objectId: string,
        metadataKey: ObjectMetadataKey, metadataValue: SinglePlayerParam<string>}
    | {type: "object_bounce", objectId: string, durationSeconds: SinglePlayerParam<number>,
        positionOffset?: SinglePlayerParam<Vec3>, rotationOffset?: SinglePlayerParam<Vec3>,
        scaleMultiplier?: SinglePlayerParam<Vec3>, oscillations?: SinglePlayerParam<number>}

export default SinglePlayerAction;
