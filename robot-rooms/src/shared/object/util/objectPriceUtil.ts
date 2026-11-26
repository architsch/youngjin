import Room from "../../room/types/room";
import ObjectTypeConfigMap from "../maps/objectTypeConfigMap";
import AddObjectSignal from "../types/addObjectSignal";

const ObjectPriceUtil =
{
    // What adding an object to a room costs its user, in dollars (see ObjectTypeConfig.price).
    getPrice: (room: Room, obj: AddObjectSignal): number =>
    {
        const config = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex);
        return config.getPrice?.(room, obj) ?? config.price ?? 0;
    },
}

export default ObjectPriceUtil;
