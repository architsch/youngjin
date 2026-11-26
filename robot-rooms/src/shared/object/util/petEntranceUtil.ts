import { PET_CLIMB_LAYERS } from "../../graphics/mesh/composition/types/compositionConstants/petCompositionConstants";
import AABB3 from "../../math/types/aabb3";
import Vec3 from "../../math/types/vec3";
import Geometry3DUtil from "../../math/util/geometry3DUtil";
import PhysicsColliderStateUtil from "../../physics/util/physicsColliderStateUtil";
import Room from "../../room/types/room";
import { COLLISION_LAYER_HEIGHT } from "../../system/sharedConstants";
import VoxelPathUtil from "../../voxel/util/voxelPathUtil";
import ObjectTypeConfigMap from "../maps/objectTypeConfigMap";
import ObjectTransform from "../types/objectTransform";
import { PLAYER_HEIGHT } from "../types/objectTypeConfig/playerObjectTypeConfig";
import PetEntrance from "../types/petEntrance";
import AdminPrefsUtil from "./adminPrefsUtil";
import DoorEntranceUtil from "./doorEntranceUtil";
import ObjectObstacleUtil from "./objectObstacleUtil";
import PetBodyUtil, { PET_WALKER } from "./petBodyUtil";
import PetOwnerUtil from "./petOwnerUtil";

// How long a pet waits for the spot it comes in at to clear before it comes in beside it instead; how far off, in grid
// vertices, it looks for room there; and how far at the most, having waited as long again and again with a crowd about
// the spot.
export const PET_ENTRANCE_PATIENCE_MS = 6000;
const NEARBY_RADIUS = 3;
const MAX_NEARBY_RADIUS = 12;
// A body this close to the spot is on it.
const BODY_GAP = 0.1;

// How a user's pets come into a room after them (see PetDriverUtil, PetPlayUtil): one at a time, each once the spot
// they come in at is clear of every body, the last one in having moved off it; out of the door their owner came in by,
// as their owner did, where they came in by one.
const PetEntranceUtil =
{
    // The pets given, about to come into a room after their owner. Their spot is in front of the door their owner came
    // in by, looking into the room, and they set out from behind it; or, where their owner was put down anywhere else,
    // it is right there, and they set out from nowhere. arrival: the owner's transform as they arrived, or wherever
    // along their walk out of the door they are by now.
    create: (room: Room, arrival: ObjectTransform, petIds: string[], now: number): PetEntrance =>
    {
        const walk = DoorEntranceUtil.getWalk(room, arrival.pos);
        const standAt = (playerPos: Vec3) =>
            PetBodyUtil.getStandingPos({x: playerPos.x, y: arrival.pos.y - 0.5 * PLAYER_HEIGHT, z: playerPos.z});
        return {
            spot: {pos: standAt(walk?.to ?? arrival.pos), facing: PetBodyUtil.getFacing(arrival.dir)},
            from: (walk == undefined) ? undefined : standAt(walk.from),
            waiting: [...petIds],
            since: now,
        };
    },
    // The pet to bring in now, if the next of those waiting can come in: bound for the spot once that is free, with
    // nobody still behind the door it sets out from; or, having waited long enough, for the spot whoever is behind the
    // door, or for somewhere beside it, the farther off the longer it has waited. pos: where its middle is put. way:
    // the points of the floor it then walks, out of the door and on to where it is bound; none for one put down where
    // it is bound, there being no door to come by. It is off the list from then on, for whoever plays it to add; so is
    // one the room holds already.
    takeNext: (room: Room, entrance: PetEntrance, now: number): {petId: string, pos: Vec3, way: Vec3[]} | undefined =>
    {
        while (entrance.waiting.length > 0 && room.objectById[entrance.waiting[0]] != undefined)
            entrance.waiting.shift();
        if (entrance.waiting.length == 0)
            return undefined;
        const spot = entrance.spot.pos;
        const waited = Math.floor((now - entrance.since) / PET_ENTRANCE_PATIENCE_MS);
        const doorwayClear = entrance.from == undefined || !PetEntranceUtil.isTaken(room, entrance.from);
        const place = !PetEntranceUtil.isFree(room, spot)
            ? ((waited >= 1) ? PetEntranceUtil.findFreeNearby(room, spot, Math.min(MAX_NEARBY_RADIUS, waited * NEARBY_RADIUS))
                : undefined)
            : (doorwayClear || waited >= 1) ? spot : undefined;
        if (place == undefined)
            return undefined;
        entrance.since = now;
        const petId = entrance.waiting.shift()!;
        if (entrance.from == undefined)
            return {petId, pos: place, way: []};
        // Straight out of the door first, whatever stands there: the wall beside it lets nothing through.
        const way = (place == spot) ? [spot] : [spot, place];
        return {petId, pos: entrance.from, way: way.map(PetBodyUtil.getFeet)};
    },
    // Whether a pet can appear there: in no block, and touching nobody.
    isFree: (room: Room, pos: Vec3): boolean =>
    {
        return PetBodyUtil.isClear(room, pos) && !PetEntranceUtil.isTaken(room, pos);
    },
    // Whether a pet there would touch anybody, player or pet (a ghost is nobody).
    isTaken: (room: Room, pos: Vec3): boolean =>
    {
        const box = PetBodyUtil.getBox(pos);
        const reach: AABB3 = {center: box.center, halfSize: {x: box.halfSize.x + BODY_GAP, y: box.halfSize.y,
            z: box.halfSize.z + BODY_GAP}};
        const playerTypeIndex = ObjectTypeConfigMap.getIndexByType("Player");
        for (const objectId in room.objectById)
        {
            const obj = room.objectById[objectId];
            const isBody = (obj.objectTypeIndex == playerTypeIndex) ? !AdminPrefsUtil.isGhost(obj) : PetOwnerUtil.isPet(obj);
            if (isBody && Geometry3DUtil.AABBsOverlap(reach,
                PhysicsColliderStateUtil.getObjectColliderState(obj.objectTypeIndex, obj.transform)!.hitbox))
            {
                return true;
            }
        }
        return false;
    },
    // Somewhere free beside a spot, the nearest there is within so many grid vertices, for a pet that has waited on it
    // long enough: on its floor, or a step it could climb off it, never another storey's. Undefined if there is none.
    findFreeNearby: (room: Room, pos: Vec3, radius: number = NEARBY_RADIUS): Vec3 | undefined =>
    {
        const isOpen = ObjectObstacleUtil.getClearance(room.objectById);
        const feet = PetBodyUtil.getFeet(pos);
        const layer = Math.round(feet.y / COLLISION_LAYER_HEIGHT);
        const vertex = VoxelPathUtil.findStandingVertexNear(room.voxelGrid.voxels, feet, radius,
            candidate => Math.abs(candidate.layer - layer) <= PET_CLIMB_LAYERS && isOpen(candidate)
                && PetEntranceUtil.isFree(room, PetBodyUtil.getStandingPos(VoxelPathUtil.toWorld(candidate))), PET_WALKER);
        return (vertex == undefined) ? undefined : PetBodyUtil.getStandingPos(VoxelPathUtil.toWorld(vertex));
    },
}

export default PetEntranceUtil;
