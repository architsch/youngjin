/**
 * Attached objects: the frame each of the six facings lays an object out on, where a type may be attached
 * and what holds it there (walls, floors, ceilings, the storey slab), where a drag or a click puts it
 * (findPlacement) and at what size a new one goes up, where a corner-handle resize puts it — its size,
 * which corner holds still, and when it refuses — and a resize where it stands (a lamp's sizes).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { EMPTY_HUB, userAtCenter } from "../helpers/scenarioPresets";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import ObjectAttachmentUtil from "../../../src/shared/object/util/objectAttachmentUtil";
import ObjectScaleUtil from "../../../src/shared/object/util/objectScaleUtil";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import RemoveObjectSignal from "../../../src/shared/object/types/removeObjectSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import CanvasObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/canvasObjectTypeConfig";
import LampObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/lampObjectTypeConfig";
import SetObjectTransformSignal from "../../../src/shared/object/types/setObjectTransformSignal";
import PhysicsColliderStateUtil from "../../../src/shared/physics/util/physicsColliderStateUtil";
import Geometry3DUtil from "../../../src/shared/math/util/geometry3DUtil";
import Vector3DUtil from "../../../src/shared/math/util/vector3DUtil";
import Room from "../../../src/shared/room/types/room";
import User from "../../../src/shared/user/types/user";
import Vec3 from "../../../src/shared/math/types/vec3";
import { ALL_FACE_DIRECTIONS, ATTACHMENT_HITBOX_INSET, COLLISION_LAYER_HEIGHT, MAX_ROOM_Y,
    STOREY_FLOOR_COLLISION_LAYER, UNIT_VEC3, WALL_DIRECTIONS } from "../../../src/shared/system/sharedConstants";

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
const doorTypeIndex = ObjectTypeConfigMap.getIndexByType("Door");
const lampTypeIndex = ObjectTypeConfigMap.getIndexByType("Lamp");
const scaling = CanvasObjectTypeConfig.scaling;

// A wall facing -z, wide and tall enough for the largest canvas grown from any corner of one hung in
// its middle. It is exactly that tall: the canvas can grow by the difference in size both up and down.
const CANVAS_HEIGHT = ObjectScaleUtil.getObjectSize(canvasTypeIndex, UNIT_VEC3).y;
const WALL_HEIGHT = 2 * ObjectScaleUtil.getMaxObjectSize(canvasTypeIndex).y - CANVAS_HEIGHT;
const WALL_ROW = 8;
const WALL_COL_MIN = 6;
const WALL_COLS = 12;
const WALL_LAYERS = Math.ceil(WALL_HEIGHT / COLLISION_LAYER_HEIGHT);
const FACING: Vec3 = {x: 0, y: 0, z: -1};
const MIDDLE: Vec3 = {x: 12, y: 0.5 * WALL_HEIGHT, z: WALL_ROW};

// The storey slab the fixture room has everywhere (see buildBareMultiplayerRoomContent): its top is the
// upper storey's floor, its underside the lower storey's ceiling.
const SLAB_TOP_Y = (STOREY_FLOOR_COLLISION_LAYER + 1) * COLLISION_LAYER_HEIGHT;
const SLAB_BOTTOM_Y = STOREY_FLOOR_COLLISION_LAYER * COLLISION_LAYER_HEIGHT;

// A single block floating in the lower storey: a floor and a ceiling one cell across.
const BLOCK = {row: 20, col: 20, layer: 4};
const BLOCK_TOP_Y = (BLOCK.layer + 1) * COLLISION_LAYER_HEIGHT;
const BLOCK_BOTTOM_Y = BLOCK.layer * COLLISION_LAYER_HEIGHT;

const CORNERS = [{x: -1, y: -1}, {x: 1, y: -1}, {x: 1, y: 1}, {x: -1, y: 1}];

const WALL = [...Array(WALL_COLS).keys()].flatMap(col => [...Array(WALL_LAYERS).keys()].map(
    layer => ({row: WALL_ROW, col: WALL_COL_MIN + col, layer})));

const UP: Vec3 = {x: 0, y: 1, z: 0};
const DOWN: Vec3 = {x: 0, y: -1, z: 0};

function attachment(user: User, room: Room, objectTypeIndex: number, objectId: string,
    pos: Vec3, dir: Vec3 = FACING, scale: Vec3 = UNIT_VEC3): AddObjectSignal
{
    return new AddObjectSignal(room.id, user.id, user.userName, objectTypeIndex, objectId,
        new ObjectTransform({...pos}, {...dir}, {...scale}), {});
}

function fits(room: Room, objectTypeIndex: number, pos: Vec3, dir: Vec3, scale: Vec3 = UNIT_VEC3): boolean
{
    return ObjectAttachmentUtil.canPlaceObject(room, "candidate", objectTypeIndex,
        new ObjectTransform({...pos}, {...dir}, {...scale}));
}

// Where the corner opposite the dragged one is, for an object as it stands.
function fixedCornerOf(tr: ObjectTransform, objectTypeIndex: number, corner: {x: number, y: number}): Vec3
{
    const size = ObjectScaleUtil.getObjectSize(objectTypeIndex, tr.scale);
    const {right, up} = Geometry3DUtil.getAxisFacingBasis(tr.dir);
    return Vector3DUtil.subtract(tr.pos, Vector3DUtil.add(
        Vector3DUtil.scale(right, corner.x * 0.5 * size.x), Vector3DUtil.scale(up, corner.y * 0.5 * size.y)));
}

// The dragged corner of an object `width` by `height`, grown out of `fixed` toward `corner`.
function draggedTo(fixed: Vec3, dir: Vec3, corner: {x: number, y: number}, width: number, height: number): Vec3
{
    const {right, up} = Geometry3DUtil.getAxisFacingBasis(dir);
    return Vector3DUtil.add(fixed, Vector3DUtil.add(
        Vector3DUtil.scale(right, corner.x * width), Vector3DUtil.scale(up, corner.y * height)));
}

async function inTheRoom(assertions: (user: User, room: Room) => void)
{
    await runScenario({
        name: "a wall and a floating block to attach things to",
        rooms: [{...EMPTY_HUB, voxels: [...WALL, BLOCK]}],
        users: [userAtCenter("hub")],
        assertions: ({users}) => assertions(users[0].user, ServerRoomManager.roomRuntimeMemories["hub"].room),
    });
}

describe("the frame an attached object is laid out on", () => {
    it("is exact and right-handed for every facing, with walls upright", () => {
        for (const dir of ALL_FACE_DIRECTIONS)
        {
            const {normal, right, up} = Geometry3DUtil.getAxisFacingBasis(dir);
            expect(normal).toEqual(dir);
            const cross = Vector3DUtil.cross(right, up);
            expect({x: cross.x + 0, y: cross.y + 0, z: cross.z + 0}).toEqual(normal); // + 0 folds -0 into 0
            for (const axis of [right, up])
                expect([axis.x, axis.y, axis.z].filter(v => v != 0)).toHaveLength(1);
        }
        for (const dir of WALL_DIRECTIONS)
            expect(Geometry3DUtil.getAxisFacingBasis(dir).up).toEqual(UP);
    });

    it("reads a stored facing by its axis, though it decodes a little off it", () => {
        // A zero component decodes just below zero (see ObjectTransform). Along the up axis, lookAt would
        // leave the roll to that error; the frame must not.
        const decodedWall = {x: 0.99998, y: -0.0000153, z: -0.0000153};
        const decodedFloor = {x: -0.0000153, y: 0.99998, z: -0.0000153};
        expect(Geometry3DUtil.getAxisFacingBasis(decodedWall))
            .toEqual(Geometry3DUtil.getAxisFacingBasis({x: 1, y: 0, z: 0}));
        expect(Geometry3DUtil.getAxisFacingBasis(decodedFloor))
            .toEqual(Geometry3DUtil.getAxisFacingBasis(UP));
    });

    it("gives a floor object a box flat on the floor, and a wall object one flat on the wall", () => {
        const scale = {x: 1, y: 0.5, z: 1};
        const size = ObjectScaleUtil.getObjectSize(lampTypeIndex, scale);
        for (const dir of [UP, DOWN, FACING])
        {
            const {normal, right, up} = Geometry3DUtil.getAxisFacingBasis(dir);
            const {halfSize} = PhysicsColliderStateUtil.getObjectColliderState(lampTypeIndex,
                new ObjectTransform({x: 5, y: 2, z: 5}, dir, scale))!.hitbox;
            expect(2 * Vector3DUtil.dot(halfSize, Vector3DUtil.mult(normal, normal))).toBeCloseTo(size.z, 6);
            expect(2 * Vector3DUtil.dot(halfSize, Vector3DUtil.mult(right, right)))
                .toBeCloseTo(size.x - ATTACHMENT_HITBOX_INSET, 6);
            expect(2 * Vector3DUtil.dot(halfSize, Vector3DUtil.mult(up, up)))
                .toBeCloseTo(size.y - ATTACHMENT_HITBOX_INSET, 6);
        }
    });
});

describe("where an attached object may go", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("takes a lamp on any face that holds it: the room's floor and ceiling, a wall, the slab and a block", async () => {
        await inTheRoom((user, room) => {
            const onBlock = {x: BLOCK.col + 0.5, z: BLOCK.row + 0.5};
            expect(fits(room, lampTypeIndex, {x: 3.5, y: 0, z: 3.5}, UP)).toBe(true);
            expect(fits(room, lampTypeIndex, {x: 3.5, y: MAX_ROOM_Y, z: 3.5}, DOWN)).toBe(true);
            expect(fits(room, lampTypeIndex, MIDDLE, FACING)).toBe(true);
            expect(fits(room, lampTypeIndex, {x: 3.5, y: SLAB_TOP_Y, z: 3.5}, UP)).toBe(true);
            expect(fits(room, lampTypeIndex, {x: 3.5, y: SLAB_BOTTOM_Y, z: 3.5}, DOWN)).toBe(true);
            expect(fits(room, lampTypeIndex, {...onBlock, y: BLOCK_TOP_Y}, UP)).toBe(true);
            expect(fits(room, lampTypeIndex, {...onBlock, y: BLOCK_BOTTOM_Y}, DOWN)).toBe(true);

            // Facing into the block, or off it into the air past its edge, holds nothing.
            expect(fits(room, lampTypeIndex, {...onBlock, y: BLOCK_TOP_Y}, DOWN)).toBe(false);
            expect(fits(room, lampTypeIndex, {...onBlock, y: BLOCK_BOTTOM_Y}, UP)).toBe(false);
            expect(fits(room, lampTypeIndex, {x: BLOCK.col + 1, y: BLOCK_TOP_Y, z: BLOCK.row + 0.5}, UP)).toBe(false);
            // Nor does a floor looking down out of the room, or a ceiling looking up out of it.
            expect(fits(room, lampTypeIndex, {x: 3.5, y: 0, z: 3.5}, DOWN)).toBe(false);
            expect(fits(room, lampTypeIndex, {x: 3.5, y: MAX_ROOM_Y, z: 3.5}, UP)).toBe(false);
        });
    });

    it("keeps pictures and doors on walls, even where a floor would hold them", async () => {
        await inTheRoom((user, room) => {
            for (const objectTypeIndex of [canvasTypeIndex, doorTypeIndex])
            {
                expect(fits(room, objectTypeIndex, {x: 3.5, y: 0, z: 3.5}, UP)).toBe(false);
                expect(fits(room, objectTypeIndex, {x: 3.5, y: MAX_ROOM_Y, z: 3.5}, DOWN)).toBe(false);
            }
            expect(fits(room, canvasTypeIndex, MIDDLE, FACING)).toBe(true);

            // The same rule the server applies to what a client sends.
            const onTheFloor = attachment(user, room, canvasTypeIndex, "on-the-floor", {x: 3.5, y: 0, z: 3.5}, UP);
            expect(ObjectUpdateUtil.canAddObject(user, room, onTheFloor)).toBe(false);
        });
    });

    it("refuses a wall object reaching below the floor, however its centre sits", async () => {
        // Only the footprint's own bounds catch this: the wall runs on down to the floor, and the block
        // scans stop at the room's edge.
        await inTheRoom((user, room) => {
            const height = ObjectScaleUtil.getObjectSize(canvasTypeIndex, UNIT_VEC3).y;
            const canvasAt = (bottomY: number) => ({x: MIDDLE.x, y: bottomY + 0.5 * height, z: WALL_ROW});
            expect(fits(room, canvasTypeIndex, canvasAt(0), FACING)).toBe(true);
            expect(fits(room, canvasTypeIndex, canvasAt(-COLLISION_LAYER_HEIGHT), FACING)).toBe(false);
        });
    });
});

describe("where a drag or a click puts an attached object", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("takes the spot asked for, on the placement grid", async () => {
        await inTheRoom((user, room) => {
            const accepts = (tr: ObjectTransform) => ObjectAttachmentUtil.canPlaceObject(room, "lamp", lampTypeIndex, tr);
            const placed = ObjectAttachmentUtil.findPlacement(room, lampTypeIndex, {x: 3.7, y: 0, z: 3.9}, UP,
                UNIT_VEC3, accepts)!;
            expect(placed.pos).toEqual({x: 3.5, y: 0, z: 4});
            expect(placed.dir).toEqual(UP);
        });
    });

    it("prefers a spot wholly in the open to one snapped half into the foot of a wall", async () => {
        await inTheRoom((user, room) => {
            const accepts = (tr: ObjectTransform) => ObjectAttachmentUtil.canPlaceObject(room, "lamp", lampTypeIndex, tr);
            // Asked for just short of the wall, the grid would centre it on the wall's own face.
            const askedFor = {x: MIDDLE.x + 0.5, y: 0, z: WALL_ROW - 0.1};
            const snapped = new ObjectTransform({...askedFor, z: WALL_ROW}, UP, {...UNIT_VEC3});
            expect(ObjectAttachmentUtil.canPlaceObject(room, "lamp", lampTypeIndex, snapped)).toBe(true);

            const placed = ObjectAttachmentUtil.findPlacement(room, lampTypeIndex, askedFor, UP, UNIT_VEC3, accepts)!;
            expect(placed.pos.z + 0.5).toBeLessThanOrEqual(WALL_ROW + 1e-6);
        });
    });

    it("slides back along the face toward where the object stood when the spot runs off it", async () => {
        await inTheRoom((user, room) => {
            const accepts = (tr: ObjectTransform) => ObjectAttachmentUtil.canPlaceObject(room, "canvas", canvasTypeIndex, tr);
            // Dragged right past the wall's end: it stops at the last spot the wall still holds.
            const wallEnd = WALL_COL_MIN + WALL_COLS;
            const placed = ObjectAttachmentUtil.findPlacement(room, canvasTypeIndex,
                {x: wallEnd + 3, y: MIDDLE.y, z: WALL_ROW}, FACING, UNIT_VEC3, accepts, MIDDLE)!;
            expect(placed).toBeDefined();
            expect(placed.pos.x).toBeCloseTo(wallEnd - 0.5, 6);
        });
    });

    it("finds room nearby on a face it arrives at, and nothing where the face holds it nowhere", async () => {
        await inTheRoom((user, room) => {
            const accepts = (tr: ObjectTransform) => ObjectAttachmentUtil.canPlaceObject(room, "lamp", lampTypeIndex, tr);
            // Asked for right at the wall's top edge, a unit lamp fits just below it.
            const top = WALL_LAYERS * COLLISION_LAYER_HEIGHT;
            const placed = ObjectAttachmentUtil.findPlacement(room, lampTypeIndex, {x: MIDDLE.x, y: top, z: WALL_ROW},
                FACING, UNIT_VEC3, accepts)!;
            expect(placed.pos.y + 0.5).toBeLessThanOrEqual(top + 1e-6);

            // A single block's underside holds a lamp one cell across, and its side, one layer tall, no
            // lamp a whole cell tall.
            const underBlock = {x: BLOCK.col + 0.5, y: BLOCK_BOTTOM_Y, z: BLOCK.row + 0.5};
            expect(ObjectAttachmentUtil.findPlacement(room, lampTypeIndex, underBlock, DOWN, UNIT_VEC3, accepts))
                .toBeDefined();
            const blockSide = {x: BLOCK.col, y: BLOCK_BOTTOM_Y + 0.5 * COLLISION_LAYER_HEIGHT, z: BLOCK.row + 0.5};
            expect(ObjectAttachmentUtil.findPlacement(room, lampTypeIndex, blockSide, {x: -1, y: 0, z: 0},
                UNIT_VEC3, accepts)).toBeUndefined();
        });
    });

    it("adds a new lamp at a size the side of a lone block holds, where a unit one finds no room", async () => {
        await inTheRoom((user, room) => {
            const scale = ObjectScaleUtil.getDefaultScale(lampTypeIndex);
            expect(scale).toEqual({x: 1, y: 0.5, z: 1});
            expect(ObjectScaleUtil.sanitize(lampTypeIndex, scale)).toEqual(scale);

            const accepts = (tr: ObjectTransform) => ObjectAttachmentUtil.canPlaceObject(room, "lamp", lampTypeIndex, tr);
            const blockCentre = {x: BLOCK.col + 0.5, y: BLOCK_BOTTOM_Y + 0.5 * COLLISION_LAYER_HEIGHT, z: BLOCK.row + 0.5};
            for (const dir of WALL_DIRECTIONS)
            {
                // One cell wide and one layer tall, with nothing above or below it.
                const side = Vector3DUtil.add(blockCentre, Vector3DUtil.scale(dir, 0.5));
                const placed = ObjectAttachmentUtil.findPlacement(room, lampTypeIndex, side, dir, scale, accepts);
                expect(placed, `facing ${JSON.stringify(dir)}`).toBeDefined();
                expect(placed!.pos.y).toBeCloseTo(blockCentre.y, 6);
                expect(ObjectAttachmentUtil.findPlacement(room, lampTypeIndex, side, dir, UNIT_VEC3, accepts))
                    .toBeUndefined();
            }
        });
    });

    it("adds every other type at unit scale unless it says otherwise", () => {
        expect(ObjectScaleUtil.getDefaultScale(canvasTypeIndex)).toEqual(UNIT_VEC3);
        expect(ObjectScaleUtil.getDefaultScale(doorTypeIndex)).toEqual(UNIT_VEC3);
    });
});

describe("resizing an attached object by a corner", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("takes each size in turn from every corner, holding the opposite corner still", async () => {
        await inTheRoom((user, room) => {
            const canvas = attachment(user, room, canvasTypeIndex, "canvas", MIDDLE);
            const {right} = Geometry3DUtil.getAxisFacingBasis(FACING);

            for (const corner of CORNERS)
            {
                const fixed = fixedCornerOf(canvas.transform, canvasTypeIndex, corner);
                for (let scale = scaling.minScale.x; scale <= scaling.maxScale.x; scale += scaling.scaleStep.x)
                {
                    const label = `corner (${corner.x}, ${corner.y}) at ${scale}x`;
                    const resized = ObjectAttachmentUtil.getResizeResult(room, canvas, canvas.transform,
                        corner.x, corner.y, draggedTo(fixed, FACING, corner, scale, scale));
                    expect(resized, label).toBeDefined();
                    expect(resized!.scale, label).toEqual({x: scale, y: scale, z: 1});

                    const nowFixed = fixedCornerOf(resized!, canvasTypeIndex, corner);
                    // Height and bottom edge are on one grid, so vertically it holds exactly...
                    expect(nowFixed.y, label).toBeCloseTo(fixed.y, 6);
                    // ...and along the wall to within a quarter voxel, giving way toward the drag.
                    const giveway = corner.x * Vector3DUtil.dot(Vector3DUtil.subtract(nowFixed, fixed), right);
                    expect(giveway, label).toBeGreaterThanOrEqual(-1e-6);
                    expect(giveway, label).toBeLessThanOrEqual(0.25 + 1e-6);
                }
            }
        });
    });

    it("lands on the placement grid, where the placement rule accepts it", async () => {
        await inTheRoom((user, room) => {
            const canvas = attachment(user, room, canvasTypeIndex, "canvas", MIDDLE);
            const fixed = fixedCornerOf(canvas.transform, canvasTypeIndex, {x: 1, y: 1});

            const resized = ObjectAttachmentUtil.getResizeResult(room, canvas, canvas.transform, 1, 1,
                draggedTo(fixed, FACING, {x: 1, y: 1}, 1.5, 2))!;
            const size = ObjectScaleUtil.getObjectSize(canvasTypeIndex, resized.scale);

            expect(2 * resized.pos.x % 1).toBeCloseTo(0, 6);
            expect(2 * resized.pos.z % 1).toBeCloseTo(0, 6);
            expect(2 * (resized.pos.y - 0.5 * size.y) % 1).toBeCloseTo(0, 6);
            expect(ObjectAttachmentUtil.canPlaceObject(room, "canvas", canvasTypeIndex, resized)).toBe(true);
        });
    });

    it("stops at the type's limits however far the corner is taken, either way", async () => {
        await inTheRoom((user, room) => {
            const canvas = attachment(user, room, canvasTypeIndex, "canvas", MIDDLE);
            const fixed = fixedCornerOf(canvas.transform, canvasTypeIndex, {x: 1, y: 1});

            const far = ObjectAttachmentUtil.getResizeResult(room, canvas, canvas.transform, 1, 1,
                draggedTo(fixed, FACING, {x: 1, y: 1}, 50, 50));
            expect(far?.scale).toEqual({x: scaling.maxScale.x, y: scaling.maxScale.y, z: 1});

            // Past the corner that holds still: the smallest it may be, not turned inside out.
            const crossed = ObjectAttachmentUtil.getResizeResult(room, canvas, canvas.transform, 1, 1,
                draggedTo(fixed, FACING, {x: 1, y: 1}, -3, -3));
            expect(crossed?.scale).toEqual({x: scaling.minScale.x, y: scaling.minScale.y, z: 1});
        });
    });

    it("gives way behind the held corner when only that way fits, and refuses when neither does", async () => {
        await inTheRoom((user, room) => {
            const canvas = attachment(user, room, canvasTypeIndex, "canvas", MIDDLE);
            const {right} = Geometry3DUtil.getAxisFacingBasis(FACING);
            const fixed = fixedCornerOf(canvas.transform, canvasTypeIndex, {x: 1, y: -1});
            const along = (v: Vec3) => Vector3DUtil.dot(v, right);

            // A neighbour whose near edge sits exactly where a 2.5-wide canvas would reach from the held
            // corner, so only the rounding that gives way behind keeps them clear of each other.
            const touching = attachment(user, room, canvasTypeIndex, "touching",
                {...Vector3DUtil.add(fixed, Vector3DUtil.scale(right, 3)), y: MIDDLE.y});
            expect(ObjectUpdateUtil.addObject(user, room, touching)).toBe(true);

            const widest = ObjectAttachmentUtil.getResizeResult(room, canvas, canvas.transform, 1, -1,
                draggedTo(fixed, FACING, {x: 1, y: -1}, 2.5, 1))!;
            expect(widest?.scale.x).toBe(2.5);
            const giveway = along(fixedCornerOf(widest, canvasTypeIndex, {x: 1, y: -1})) - along(fixed);
            expect(giveway).toBeCloseTo(-0.25, 6);

            // A neighbour half a voxel nearer leaves 2.5 no room either way.
            expect(ObjectUpdateUtil.removeObject(user, room, new RemoveObjectSignal(room.id, "touching"))).toBe(true);
            const blocking = attachment(user, room, canvasTypeIndex, "blocking",
                {...Vector3DUtil.add(fixed, Vector3DUtil.scale(right, 2.5)), y: MIDDLE.y});
            expect(ObjectUpdateUtil.addObject(user, room, blocking)).toBe(true);
            expect(ObjectAttachmentUtil.getResizeResult(room, canvas, canvas.transform, 1, -1,
                draggedTo(fixed, FACING, {x: 1, y: -1}, 2.5, 1))).toBeUndefined();
        });
    });

    it("refuses a size that runs off the wall", async () => {
        await inTheRoom((user, room) => {
            // Half a voxel below the wall's top: growing upward runs out of wall behind it.
            const high = attachment(user, room, canvasTypeIndex, "high",
                {x: MIDDLE.x, y: WALL_HEIGHT - 0.5 - 0.5 * CANVAS_HEIGHT, z: WALL_ROW});
            const fixed = fixedCornerOf(high.transform, canvasTypeIndex, {x: 1, y: 1});

            expect(ObjectAttachmentUtil.getResizeResult(room, high, high.transform, 1, 1,
                draggedTo(fixed, FACING, {x: 1, y: 1}, 2.5, 2.5))).toBeUndefined();
        });
    });

    it("resizes an object on the floor, giving way by at most a quarter voxel along both of its axes", async () => {
        // Lamps are the only floor objects that scale; their edit options resize them, but the rule is the
        // same for any type.
        await inTheRoom((user, room) => {
            const lamp = attachment(user, room, lampTypeIndex, "floor-lamp", {x: 3.5, y: 0, z: 3.5}, UP);
            const {right, up} = Geometry3DUtil.getAxisFacingBasis(UP);
            for (const corner of CORNERS)
            {
                const fixed = fixedCornerOf(lamp.transform, lampTypeIndex, corner);
                const resized = ObjectAttachmentUtil.getResizeResult(room, lamp, lamp.transform, corner.x, corner.y,
                    draggedTo(fixed, UP, corner, 0.5, 1))!;
                expect(resized.scale).toEqual({x: 0.5, y: 1, z: 1});
                expect(resized.dir).toEqual(UP);
                expect(resized.pos.y).toBe(0);

                const moved = Vector3DUtil.subtract(fixedCornerOf(resized, lampTypeIndex, corner), fixed);
                for (const [axis, sign] of [[right, corner.x], [up, corner.y]] as const)
                {
                    const giveway = sign * Vector3DUtil.dot(moved, axis);
                    expect(Math.abs(giveway)).toBeLessThanOrEqual(0.25 + 1e-6);
                }
            }
        });
    });

    it("keeps a type that declares no scaling at its size", async () => {
        await inTheRoom((user, room) => {
            // A door, already on the placement grid: foot on a layer boundary, centred on a half-voxel.
            const doorHeight = ObjectScaleUtil.getObjectSize(doorTypeIndex, UNIT_VEC3).y;
            const door = attachment(user, room, doorTypeIndex, "door",
                {x: MIDDLE.x + 0.5, y: 1.5 + 0.5 * doorHeight, z: WALL_ROW});
            const fixed = fixedCornerOf(door.transform, doorTypeIndex, {x: 1, y: 1});

            const resized = ObjectAttachmentUtil.getResizeResult(room, door, door.transform, 1, 1,
                draggedTo(fixed, FACING, {x: 1, y: 1}, 3, 3));
            expect(resized?.scale).toEqual(UNIT_VEC3);
            expect(resized?.pos.x).toBeCloseTo(door.transform.pos.x, 6);
            expect(resized?.pos.y).toBeCloseTo(door.transform.pos.y, 6);
        });
    });
});

describe("resizing an attached object where it stands", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    const lampSizes = LampObjectTypeConfig.util.getSizes();

    it("keeps its centre across a floor, and its bottom edge on a wall, so going back puts it back exactly", async () => {
        await inTheRoom((user, room) => {
            const onFloor = new ObjectTransform({x: 3.5, y: 0, z: 3.5}, UP, {x: 1, y: 0.5, z: 1});
            const onWall = new ObjectTransform({x: MIDDLE.x, y: 1.25, z: WALL_ROW}, FACING, {x: 1, y: 0.5, z: 1});
            for (const start of [onFloor, onWall])
            {
                const startSize = ObjectScaleUtil.getObjectSize(lampTypeIndex, start.scale);
                for (const scale of lampSizes)
                {
                    const label = `facing ${JSON.stringify(start.dir)}, at ${scale.x} x ${scale.y}`;
                    const resized = ObjectAttachmentUtil.getResizedInPlace(lampTypeIndex, start, scale);
                    expect(resized.scale, label).toEqual(scale);
                    expect(resized.pos.x, label).toBeCloseTo(start.pos.x, 6);
                    expect(resized.pos.z, label).toBeCloseTo(start.pos.z, 6);
                    const size = ObjectScaleUtil.getObjectSize(lampTypeIndex, scale);
                    if (start === onFloor)
                        expect(resized.pos.y, label).toBeCloseTo(start.pos.y, 6);
                    else
                        expect(resized.pos.y - 0.5 * size.y, label).toBeCloseTo(start.pos.y - 0.5 * startSize.y, 6);
                    expect(ObjectAttachmentUtil.canPlaceObject(room, "lamp", lampTypeIndex, resized), label).toBe(true);

                    const back = ObjectAttachmentUtil.getResizedInPlace(lampTypeIndex, resized, start.scale);
                    for (const axis of ["x", "y", "z"] as const)
                        expect(back.pos[axis], label).toBeCloseTo(start.pos[axis], 6);
                }
            }
        });
    });

    it("is refused, by the rule the server applies, at a size that doesn't fit where it stands", async () => {
        await inTheRoom((user, room) => {
            // On the side of the lone block, which is one layer tall: the short sizes fit, the tall ones don't.
            const side = {x: BLOCK.col, y: BLOCK_BOTTOM_Y + 0.5 * COLLISION_LAYER_HEIGHT, z: BLOCK.row + 0.5};
            const lamp = attachment(user, room, lampTypeIndex, "lamp", side, {x: -1, y: 0, z: 0},
                {x: 1, y: 0.5, z: 1});
            expect(ObjectUpdateUtil.addObject(user, room, lamp)).toBe(true);

            for (const scale of lampSizes)
            {
                const resized = ObjectAttachmentUtil.getResizedInPlace(lampTypeIndex, lamp.transform, scale);
                expect(ObjectUpdateUtil.canSetObjectTransform(user, room,
                    new SetObjectTransformSignal(room.id, lamp.objectId, resized, true)), `${scale.x} x ${scale.y}`)
                    .toBe(scale.y <= COLLISION_LAYER_HEIGHT);
            }
        });
    });
});
