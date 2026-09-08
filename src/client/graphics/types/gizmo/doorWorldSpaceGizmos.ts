import ObjectTypeConfigMap from "../../../../shared/object/maps/objectTypeConfigMap";
import RoomValidationUtil from "../../../../shared/room/util/roomValidationUtil";
import DoorObjectTypeConfig from "../../../../shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import installWallAttachmentMoveGizmos from "./wallAttachmentMoveGizmos";

// Moving a door is world-building rather than room-editing, so the arrows belong to an admin and to
// nobody else: for everyone else a door is a way out, and a click on it is a journey rather than a
// grip on it.
installWallAttachmentMoveGizmos({
    listenerName: "doorWorldSpaceGizmos",
    objectTypeIndex: ObjectTypeConfigMap.getIndexByType("Door"),
    footprintWidth: DoorObjectTypeConfig.components.spawnedByAny.collider.hitboxSize.sizeX,
    footprintHeight: DoorObjectTypeConfig.components.spawnedByAny.collider.hitboxSize.sizeY,
    canUserMove: RoomValidationUtil.canUserManageDoors,
});
