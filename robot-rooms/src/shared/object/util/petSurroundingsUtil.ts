import Room from "../../room/types/room";
import VoxelPathUtil from "../../voxel/util/voxelPathUtil";
import ObjectTypeConfigMap from "../maps/objectTypeConfigMap";
import PetPersonSighting from "../types/petPersonSighting";
import PetSighting from "../types/petSighting";
import PetSurroundings from "../types/petSurroundings";
import AdminPrefsUtil from "./adminPrefsUtil";
import PetBodyUtil from "./petBodyUtil";
import PetIdentityUtil from "./petIdentityUtil";
import PetOwnerUtil from "./petOwnerUtil";
import PetShownStateUtil from "./petShownStateUtil";

// A room as the pets played in it find it (see PetSurroundings), read from the room as whoever plays them holds it.
const PetSurroundingsUtil =
{
    // The room now, with every living pet in it: read once for all the pets played there (see seenBy).
    observe: (room: Room, now: number): PetSurroundings =>
    {
        const playerTypeIndex = ObjectTypeConfigMap.getIndexByType("Player");
        const pets: PetSighting[] = [];
        const people: PetPersonSighting[] = [];
        for (const objectId in room.objectById)
        {
            const obj = room.objectById[objectId];
            if (PetOwnerUtil.isPet(obj))
            {
                pets.push({objectId, ownerUserID: obj.sourceUserID, at: PetBodyUtil.getFeet(obj.transform.pos),
                    identity: PetIdentityUtil.getObjectIdentity(obj), shown: PetShownStateUtil.getObjectState(obj)});
            }
            else if (obj.objectTypeIndex == playerTypeIndex && !AdminPrefsUtil.isGhost(obj))
            {
                people.push({userID: obj.sourceUserID, name: obj.sourceUserName, objectId,
                    at: VoxelPathUtil.feetOf(obj.transform.pos)});
            }
        }
        return {now, roomID: room.id, voxels: room.voxelGrid.voxels, objectById: room.objectById, pets, people};
    },
    // The room as one of its pets finds it: with the others.
    seenBy: (surroundings: PetSurroundings, objectId: string): PetSurroundings =>
    {
        return {...surroundings, pets: surroundings.pets.filter(pet => pet.objectId != objectId)};
    },
}

export default PetSurroundingsUtil;
