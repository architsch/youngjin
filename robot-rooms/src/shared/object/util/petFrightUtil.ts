import Vec3 from "../../math/types/vec3";
import Vector3DUtil from "../../math/util/vector3DUtil";
import PhysicsManager from "../../physics/physicsManager";
import PhysicsColliderStateUtil from "../../physics/util/physicsColliderStateUtil";
import Room from "../../room/types/room";
import ObjectTypeConfigMap from "../maps/objectTypeConfigMap";
import AdminPrefsUtil from "./adminPrefsUtil";
import PetOwnerUtil from "./petOwnerUtil";

// A fan's wind has caught a body once it speeds it up by this much, in world units a second each second; and the same
// body's being caught frightens again only after this long.
const GUST_MIN_PUSH = 8;
const GUST_FRIGHT_INTERVAL_MS = 4000;

// The frights a room gives its pets that nobody tells whoever plays them (see PetBehaviorUtil.expose).
const PetFrightUtil =
{
    // Where a fan's wind has hold of a body (a player who can be seen, or a pet) and frightens anew, as their middles.
    // frightenedAt: when each body's being caught last did, which the caller keeps for the room.
    findGusts: (room: Room, now: number, frightenedAt: Map<string, number>): Vec3[] =>
    {
        const gusts: Vec3[] = [];
        if (!PhysicsManager.hasRoom(room.id) || PhysicsManager.physicsRooms[room.id].forceEmitterIds.size == 0)
            return gusts;
        const playerTypeIndex = ObjectTypeConfigMap.getIndexByType("Player");
        for (const objectId in room.objectById)
        {
            const obj = room.objectById[objectId];
            const isBody = (obj.objectTypeIndex == playerTypeIndex) ? !AdminPrefsUtil.isGhost(obj) : PetOwnerUtil.isPet(obj);
            if (!isBody || now - (frightenedAt.get(objectId) ?? -Infinity) < GUST_FRIGHT_INTERVAL_MS)
                continue;
            const box = PhysicsColliderStateUtil.getObjectColliderState(obj.objectTypeIndex, obj.transform)!.hitbox;
            if (Vector3DUtil.length(PhysicsManager.getPush(room.id, box)) >= GUST_MIN_PUSH)
            {
                frightenedAt.set(objectId, now);
                gusts.push({...obj.transform.pos});
            }
        }
        for (const objectId of [...frightenedAt.keys()])
        {
            if (room.objectById[objectId] == undefined)
                frightenedAt.delete(objectId);
        }
        return gusts;
    },
}

export default PetFrightUtil;
