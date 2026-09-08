import ObjectTypeConfigMap from "../../../../shared/object/maps/objectTypeConfigMap";
import RoomValidationUtil from "../../../../shared/room/util/roomValidationUtil";
import LampObjectTypeConfig from "../../../../shared/object/types/objectTypeConfig/lampObjectTypeConfig";
import installWallAttachmentMoveGizmos from "./wallAttachmentMoveGizmos";

// Moving a lamp is an admin's alone while the lamp is a placeholder, on the same terms installing
// one is: what it moves is not a decoration on a wall but where the room's light comes from.
installWallAttachmentMoveGizmos({
    listenerName: "lampWorldSpaceGizmos",
    objectTypeIndex: ObjectTypeConfigMap.getIndexByType("Lamp"),
    footprintWidth: LampObjectTypeConfig.components.spawnedByAny.collider.hitboxSize.sizeX,
    footprintHeight: LampObjectTypeConfig.components.spawnedByAny.collider.hitboxSize.sizeY,
    canUserMove: (user) => RoomValidationUtil.userIsAdmin(user),
});
