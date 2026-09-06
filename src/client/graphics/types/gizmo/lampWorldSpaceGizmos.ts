import ObjectTypeConfigMap from "../../../../shared/object/maps/objectTypeConfigMap";
import RoomValidationUtil from "../../../../shared/room/util/roomValidationUtil";
import { LAMP_FOOTPRINT_HEIGHT, LAMP_FOOTPRINT_WIDTH } from "../../../../shared/system/sharedConstants";
import installWallAttachmentMoveGizmos from "./wallAttachmentMoveGizmos";

// Moving a lamp is an admin's alone while the lamp is a placeholder, on the same terms installing
// one is: what it moves is not a decoration on a wall but where the room's light comes from.
installWallAttachmentMoveGizmos({
    listenerName: "lampWorldSpaceGizmos",
    objectTypeIndex: ObjectTypeConfigMap.getIndexByType("Lamp"),
    footprintWidth: LAMP_FOOTPRINT_WIDTH,
    footprintHeight: LAMP_FOOTPRINT_HEIGHT,
    canUserMove: (user) => RoomValidationUtil.userIsAdmin(user),
});
