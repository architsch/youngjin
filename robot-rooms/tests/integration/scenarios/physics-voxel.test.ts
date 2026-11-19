/**
 * Physics voxels (see PhysicsVoxel): the coarse boxes a room's objects are kept track of by. Whatever is
 * asked of them is answered as a scan of every object would answer it, through any run of additions,
 * moves and removals; each storey's objects are kept apart; and nothing is ever kept nowhere.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fc from "fast-check";
import { createTestRoom } from "../helpers/roomContent";
import PhysicsManager from "../../../src/shared/physics/physicsManager";
import PhysicsObject from "../../../src/shared/physics/types/physicsObject";
import PhysicsRoom from "../../../src/shared/physics/types/physicsRoom";
import { ColliderConfig } from "../../../src/shared/physics/types/colliderConfig";
import PhysicsColliderStateUtil from "../../../src/shared/physics/util/physicsColliderStateUtil";
import PhysicsObjectUtil from "../../../src/shared/physics/util/physicsObjectUtil";
import PhysicsVoxelUtil from "../../../src/shared/physics/util/physicsVoxelUtil";
import AABB3 from "../../../src/shared/math/types/aabb3";
import Geometry3DUtil from "../../../src/shared/math/util/geometry3DUtil";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import ObjectGroup from "../../../src/shared/object/types/objectGroup";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import Room from "../../../src/shared/room/types/room";
import RoomRuntimeMemory from "../../../src/shared/room/types/roomRuntimeMemory";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../src/shared/voxel/util/voxelUpdateUtil";
import { COLLISION_LAYER_MIN, MAX_ROOM_X, MAX_ROOM_Y, MAX_ROOM_Z, MID_ROOM_Y, PHYSICS_VOXEL_SIZE_XZ,
    UNIT_VEC3 } from "../../../src/shared/system/sharedConstants";

const ROOM_ID = "physics-room";
const playerTypeIndex = ObjectTypeConfigMap.getIndexByType("Player");

const passThroughConfig: ColliderConfig = {
    baseHitboxSize: {sizeX: 1, sizeY: 1, sizeZ: 1},
    applyHardCollisionToOthers: false,
    outgoingSoftCollisionForceMultiplier: 0,
    incomingSoftCollisionForceMultiplier: 0,
    maxClimbableHeight: 0,
};

function box(cx: number, cy: number, cz: number, hx: number, hy: number, hz: number): AABB3
{
    return {center: {x: cx, y: cy, z: cz}, halfSize: {x: hx, y: hy, z: hz}};
}

function physicsRoom(): PhysicsRoom
{
    return PhysicsManager.physicsRooms[ROOM_ID];
}

function addBox(objectId: string, hitbox: AABB3): PhysicsObject
{
    return PhysicsManager.addObject(ROOM_ID, objectId, playerTypeIndex, {hitbox, colliderConfig: passThroughConfig});
}

// The objects a box meets, found by scanning every object in the room.
function scan(query: AABB3): string[]
{
    return Object.values(physicsRoom().objectById)
        .filter(object => Geometry3DUtil.AABBsOverlap(query, object.colliderState.hitbox))
        .map(object => object.objectId).sort();
}

// The same, as the physics voxels answer it.
function ask(query: AABB3): string[]
{
    return Object.keys(PhysicsObjectUtil.getObjectsCollidingWith3DVolume(ROOM_ID,
        {hitbox: query, colliderConfig: passThroughConfig})).sort();
}

// The objects among the colliders a box overlaps (the rest being blocks and the room's own bounds).
function askColliders(query: AABB3): string[]
{
    const found = PhysicsColliderStateUtil.findOverlappingColliderStates(physicsRoom(), query);
    return Object.values(physicsRoom().objectById)
        .filter(object => found.has(object.colliderState))
        .map(object => object.objectId).sort();
}

// Every physics voxel holds only objects of the room that reach into it, each once. (Checked as plain
// booleans: a failure that printed these objects would print the whole room with them.)
function expectVoxelsToHoldOnlyWhatReachesThem(): void
{
    const room = physicsRoom();
    for (const voxel of room.voxels)
    {
        const ids = voxel.intersectingObjects.map(object => object.objectId);
        expect(new Set(ids).size).toBe(ids.length);
        for (const object of voxel.intersectingObjects)
        {
            expect(room.objectById[object.objectId] === object, `${object.objectId} is of the room`).toBe(true);
            expect(PhysicsVoxelUtil.getVoxelsInBox(room, object.colliderState.hitbox).includes(voxel),
                `${object.objectId} reaches into the voxel holding it`).toBe(true);
        }
    }
}

// A number spread evenly over a range, in hundredths. (fc.double spreads over the doubles themselves,
// nearly all of which lie next to zero, so boxes drawn with it would crowd into one corner of the room.)
const between = (min: number, max: number) =>
    fc.integer({min: Math.round(100 * min), max: Math.round(100 * max)}).map(hundredths => hundredths / 100);

// Boxes anywhere in the room and a little way out of it, some larger than a physics voxel.
const anyBox = fc.record({
    cx: between(-3, MAX_ROOM_X + 3),
    cy: between(-2, MAX_ROOM_Y + 2),
    cz: between(-3, MAX_ROOM_Z + 3),
    hx: between(0.05, 3),
    hy: between(0.05, 3),
    hz: between(0.05, 3),
}).map(({cx, cy, cz, hx, hy, hz}) => box(cx, cy, cz, hx, hy, hz));

describe("physics voxels", () => {
    let room: Room;

    // The room's physics with nothing in it yet.
    const startOver = () => {
        if (PhysicsManager.hasRoom(ROOM_ID))
            PhysicsManager.unload(ROOM_ID);
        PhysicsManager.load(new RoomRuntimeMemory(room, {}));
    };

    beforeEach(() => {
        room = createTestRoom(ROOM_ID, "", RoomTypeEnumMap.Hub);
        room.objectGroup = new ObjectGroup([]);
        startOver();
    });

    afterEach(() => {
        PhysicsManager.unload(ROOM_ID);
    });

    it("answer what a box meets as a scan of every object would", () => {
        fc.assert(fc.property(fc.array(anyBox, {minLength: 1, maxLength: 40}), fc.array(anyBox, {minLength: 1, maxLength: 20}),
            (hitboxes, queries) => {
                startOver();
                hitboxes.forEach((hitbox, i) => addBox(`box-${i}`, hitbox));

                for (const query of queries)
                {
                    expect(ask(query)).toEqual(scan(query));
                    expect(askColliders(query)).toEqual(scan(query));
                }
                expectVoxelsToHoldOnlyWhatReachesThem();
            }), {numRuns: 150});
    });

    it("keep answering so through moves and removals, holding nothing that has left", () => {
        const step = fc.record({index: fc.nat({max: 11}), remove: fc.boolean(),
            x: between(0.5, MAX_ROOM_X - 0.5),
            y: between(1.3, MAX_ROOM_Y - 1.3),
            z: between(0.5, MAX_ROOM_Z - 0.5)});
        fc.assert(fc.property(fc.array(step, {minLength: 1, maxLength: 60}), fc.array(anyBox, {minLength: 1, maxLength: 10}),
            (steps, queries) => {
                startOver();

                for (const {index, remove, x, y, z} of steps)
                {
                    const objectId = `player-${index}`;
                    const transform = new ObjectTransform({x, y, z}, {x: 0, y: 0, z: 1}, {...UNIT_VEC3});
                    if (!PhysicsManager.hasObject(ROOM_ID, objectId))
                    {
                        PhysicsManager.addObject(ROOM_ID, objectId, playerTypeIndex,
                            PhysicsColliderStateUtil.getObjectColliderState(playerTypeIndex, transform)!);
                    }
                    else if (remove)
                        PhysicsManager.removeObject(ROOM_ID, objectId);
                    else
                        PhysicsManager.setObjectTransform(ROOM_ID, objectId, transform, true);
                }

                for (const query of queries)
                    expect(ask(query)).toEqual(scan(query));
                expectVoxelsToHoldOnlyWhatReachesThem();
            }), {numRuns: 150});
    });

    it("keep each storey's objects apart, and one standing through both in both", () => {
        addBox("downstairs", box(5, 1.25, 5, 0.3, 1.25, 0.3));
        addBox("upstairs", box(5, MID_ROOM_Y + 1.25, 5, 0.3, 1.25, 0.3));
        addBox("through", box(5, MID_ROOM_Y, 5, 0.3, 1, 0.3));

        // What the physics voxels a box reaches into hold, whether or not it overlaps the box.
        const held = (query: AABB3) => [...new Set(PhysicsVoxelUtil.getVoxelsInBox(physicsRoom(), query)
            .flatMap(voxel => voxel.intersectingObjects.map(object => object.objectId)))].sort();

        expect(held(box(5, 1, 5, 0.1, 0.5, 0.1))).toEqual(["downstairs", "through"]);
        expect(held(box(5, MID_ROOM_Y + 1, 5, 0.1, 0.5, 0.1))).toEqual(["through", "upstairs"]);
    });

    it("find an object from either side of the line between two of them", () => {
        // Astride the line between the first two physics voxels along x.
        addBox("astride", box(PHYSICS_VOXEL_SIZE_XZ, 1, 1, 0.3, 0.5, 0.3));

        expect(ask(box(PHYSICS_VOXEL_SIZE_XZ - 0.2, 1, 1, 0.05, 0.05, 0.05))).toEqual(["astride"]);
        expect(ask(box(PHYSICS_VOXEL_SIZE_XZ + 0.2, 1, 1, 0.05, 0.05, 0.05))).toEqual(["astride"]);
        expect(ask(box(PHYSICS_VOXEL_SIZE_XZ + 1, 1, 1, 0.05, 0.05, 0.05))).toEqual([]);
    });

    it("keep what lies beyond the room in the nearest of them, so it is still found", () => {
        addBox("outside", box(-4, MAX_ROOM_Y + 3, MAX_ROOM_Z + 4, 0.5, 0.5, 0.5));

        expect(ask(box(-4, MAX_ROOM_Y + 3, MAX_ROOM_Z + 4, 0.2, 0.2, 0.2))).toEqual(["outside"]);
        expect(ask(box(1, MAX_ROOM_Y - 1, MAX_ROOM_Z - 1, 0.2, 0.2, 0.2))).toEqual([]);
        expectVoxelsToHoldOnlyWhatReachesThem();
    });

    it("find everything within a distance on the floor plan, whatever its height", () => {
        addBox("low", box(10, 0.5, 10, 0.3, 0.5, 0.3));
        addBox("high", box(10.5, MAX_ROOM_Y - 0.5, 10.5, 0.3, 0.5, 0.3));
        addBox("far", box(20, 0.5, 20, 0.3, 0.5, 0.3));

        expect(Object.keys(PhysicsObjectUtil.getObjectsIn2DDist(ROOM_ID, 10, 10, 3)).sort()).toEqual(["high", "low"]);
    });

    it("leave the room's blocks to the grid, as it stands at the moment of asking", () => {
        const blockCenter = VoxelQueryUtil.getVoxelBlockBox(10, 10, COLLISION_LAYER_MIN).center;
        const inside = box(blockCenter.x, blockCenter.y, blockCenter.z, 0.2, 0.1, 0.2);
        const quadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(10, 10, COLLISION_LAYER_MIN);
        expect(PhysicsColliderStateUtil.boxOverlapsHardCollider(physicsRoom(), inside)).toBe(false);

        VoxelUpdateUtil.addVoxelBlock(undefined, room.voxelGrid.voxels, quadIndex);
        expect(PhysicsColliderStateUtil.boxOverlapsHardCollider(physicsRoom(), inside)).toBe(true);

        // A grid put in the room's place is the one asked from then on.
        room.voxelGrid = createTestRoom("another", "", RoomTypeEnumMap.Hub).voxelGrid;
        expect(PhysicsColliderStateUtil.boxOverlapsHardCollider(physicsRoom(), inside)).toBe(false);
    });
});
