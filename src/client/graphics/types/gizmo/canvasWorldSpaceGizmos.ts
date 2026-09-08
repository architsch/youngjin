import ObjectTypeConfigMap from "../../../../shared/object/maps/objectTypeConfigMap";
import CanvasObjectTypeConfig from "../../../../shared/object/types/objectTypeConfig/canvasObjectTypeConfig";
import installWallAttachmentMoveGizmos from "./wallAttachmentMoveGizmos";

// A canvas is a 1x1 square of wall, and moving one is an ordinary room edit — anybody who may edit
// the room may slide a picture along its wall, so there is nobody to turn away here.
installWallAttachmentMoveGizmos({
    listenerName: "canvasWorldSpaceGizmos",
    objectTypeIndex: ObjectTypeConfigMap.getIndexByType("Canvas"),
    footprintWidth: CanvasObjectTypeConfig.components.spawnedByAny.collider.hitboxSize.sizeX,
    footprintHeight: CanvasObjectTypeConfig.components.spawnedByAny.collider.hitboxSize.sizeY,
});
