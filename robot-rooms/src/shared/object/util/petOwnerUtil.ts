import Room from "../../room/types/room";
import ObjectTypeConfigMap from "../maps/objectTypeConfigMap";
import AddObjectSignal from "../types/addObjectSignal";
import PetRecord from "../types/petRecord";
import PetRecordUtil from "./petRecordUtil";

// The pets a user owns, as the room they are in holds them: on their player there (see PetRecordUtil).
const PetOwnerUtil =
{
    // A user's player in a room; undefined while they aren't in it.
    findPlayer: (room: Room, userID: string): AddObjectSignal | undefined =>
    {
        const playerTypeIndex = ObjectTypeConfigMap.getIndexByType("Player");
        for (const objectId in room.objectById)
        {
            const obj = room.objectById[objectId];
            if (obj.objectTypeIndex == playerTypeIndex && obj.sourceUserID == userID)
                return obj;
        }
        return undefined;
    },
    // None while the user isn't in the room.
    getRecords: (room: Room, userID: string): PetRecord[] =>
    {
        return PetRecordUtil.getPlayerRecords(PetOwnerUtil.findPlayer(room, userID));
    },
    // The user's record of a pet by its id, which is its object's.
    findRecord: (room: Room, userID: string, petId: string): PetRecord | undefined =>
    {
        return PetOwnerUtil.getRecords(room, userID).find(record => record.petId == petId);
    },
    // Whether an object is a pet of either living type (see PetObjectTypeConfig, ServerPetObjectTypeConfig).
    isPet: (obj: AddObjectSignal | undefined): boolean =>
    {
        return obj != undefined && (obj.objectTypeIndex == ObjectTypeConfigMap.getIndexByType("Pet")
            || obj.objectTypeIndex == ObjectTypeConfigMap.getIndexByType("ServerPet"));
    },
}

export default PetOwnerUtil;
