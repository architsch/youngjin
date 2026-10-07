/**
 * Attached objects: the frame each of the six facings lays an object out on, where a type may be attached
 * and what holds it there (walls, floors, ceilings, the storey slab), where a drag or a click puts it
 * (findPlacement, on its quarter-voxel grid) and at what size a new one goes up, where a corner-handle resize
 * puts it — its size, the corner held still, and when it refuses — a resize where it stands (a lamp's sizes,
 * a canvas's turn), the turn its content keeps when it moves to another face (QuarterTurnsUtil), and a prop
 * pinned to the size of its image (a change of image or turn carrying the transform it needs, a new image's size
 * taken whichever way there is room).
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
import SetObjectMetadataSignal from "../../../src/shared/object/types/setObjectMetadataSignal";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import { FIXTURE_PICTURES, useFixturePictures } from "../helpers/pictureFixture";
import PropObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/propObjectTypeConfig";
import PhysicsColliderStateUtil from "../../../src/shared/physics/util/physicsColliderStateUtil";
import Geometry3DUtil from "../../../src/shared/math/util/geometry3DUtil";
import QuarterTurnsUtil from "../../../src/shared/object/util/quarterTurnsUtil";
import Vector3DUtil from "../../../src/shared/math/util/vector3DUtil";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import Room from "../../../src/shared/room/types/room";
import User from "../../../src/shared/user/types/user";
import Vec3 from "../../../src/shared/math/types/vec3";
import { ALL_FACE_DIRECTIONS, ATTACHMENT_HITBOX_INSET, COLLISION_LAYER_HEIGHT, MAX_ROOM_Y,
    STOREY_FLOOR_COLLISION_LAYER, UNIT_VEC3, WALL_DIRECTIONS } from "../../../src/shared/system/sharedConstants";

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
const propTypeIndex = ObjectTypeConfigMap.getIndexByType("Prop");
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
const BLOCK_CENTRE: Vec3 = {x: BLOCK.col + 0.5, y: BLOCK_BOTTOM_Y + 0.5 * COLLISION_LAYER_HEIGHT, z: BLOCK.row + 0.5};

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

    it("takes a canvas on any face that holds it, as the face of an everyday object", async () => {
        await inTheRoom((user, room) => {
            const onBlock = {x: BLOCK.col + 0.5, z: BLOCK.row + 0.5};
            expect(fits(room, canvasTypeIndex, {x: 3.5, y: 0, z: 3.5}, UP)).toBe(true);
            expect(fits(room, canvasTypeIndex, {x: 3.5, y: MAX_ROOM_Y, z: 3.5}, DOWN)).toBe(true);
            expect(fits(room, canvasTypeIndex, MIDDLE, FACING)).toBe(true);
            expect(fits(room, canvasTypeIndex, {...onBlock, y: BLOCK_TOP_Y}, UP)).toBe(true);
            expect(fits(room, canvasTypeIndex, {...onBlock, y: BLOCK_BOTTOM_Y}, DOWN)).toBe(true);

            // The same rule the server applies to what a client sends.
            const onTheFloor = attachment(user, room, canvasTypeIndex, "on-the-floor", {x: 3.5, y: 0, z: 3.5}, UP);
            expect(ObjectUpdateUtil.canAddObject(user, room, onTheFloor)).toBe(true);
        });
    });

    it("keeps doors on walls, even where a floor would hold them", async () => {
        await inTheRoom((user, room) => {
            expect(fits(room, doorTypeIndex, {x: 3.5, y: 0, z: 3.5}, UP)).toBe(false);
            expect(fits(room, doorTypeIndex, {x: 3.5, y: MAX_ROOM_Y, z: 3.5}, DOWN)).toBe(false);

            const onTheFloor = attachment(user, room, doorTypeIndex, "on-the-floor", {x: 3.5, y: 0, z: 3.5}, UP);
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

describe("what a shrunk block holds", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    // Sub-blocks by bit: (x half, z half) = (0, 0), (1, 0), (0, 1), (1, 1).
    const LOW_X_HALF = 0b0101, HIGH_X_HALF = 0b1010, LOW_Z_HALF = 0b0011, HIGH_Z_HALF = 0b1100;
    const HALF_CANVAS = {x: 0.5, y: 0.5, z: 1}; // half a cell across, one layer tall
    const BLOCK_MIDDLE_Y = BLOCK_BOTTOM_Y + 0.5 * COLLISION_LAYER_HEIGHT;
    const PLUS_X: Vec3 = {x: 1, y: 0, z: 0}, MINUS_X: Vec3 = {x: -1, y: 0, z: 0}, PLUS_Z: Vec3 = {x: 0, y: 0, z: 1};

    function setShape(room: Room, block: {row: number, col: number, layer: number}, shape: number): void
    {
        room.voxelGrid.quadsMem.blockShapes[
            VoxelQueryUtil.getVoxelBlockIndex(block.row, block.col, block.layer)] = shape;
    }

    it("is what lies on a face of it, the face across the middle of its cell among them", async () => {
        await inTheRoom((user, room) => {
            setShape(room, BLOCK, LOW_X_HALF); // filling x from the cell's side to its middle
            const innerFaceX = BLOCK.col + 0.5;
            const onInnerFace = {x: innerFaceX, y: BLOCK_MIDDLE_Y, z: BLOCK.row + 0.25};

            // Hung on the inner face, looking out over the half that was cut away.
            expect(fits(room, canvasTypeIndex, onInnerFace, PLUS_X, HALF_CANVAS)).toBe(true);
            expect(ObjectUpdateUtil.canAddObject(user, room, attachment(user, room, canvasTypeIndex, "inner",
                onInnerFace, PLUS_X, HALF_CANVAS))).toBe(true);
            // Not on the same plane looking the other way, with open air behind it...
            expect(fits(room, canvasTypeIndex, onInnerFace, MINUS_X, HALF_CANVAS)).toBe(false);
            // ...nor on the cell's side, where the block's face was before it shrank.
            expect(fits(room, canvasTypeIndex, {...onInnerFace, x: BLOCK.col + 1}, PLUS_X, HALF_CANVAS)).toBe(false);
            // Its other side face is where it always was.
            expect(fits(room, canvasTypeIndex, {...onInnerFace, x: BLOCK.col}, MINUS_X, HALF_CANVAS)).toBe(true);
        });
    });

    it("is nothing that reaches past the part of the cell it fills", async () => {
        await inTheRoom((user, room) => {
            setShape(room, BLOCK, LOW_X_HALF);
            const onEnd = (x: number) => ({x: BLOCK.col + x, y: BLOCK_MIDDLE_Y, z: BLOCK.row + 1});
            const onTop = (x: number) => ({x: BLOCK.col + x, y: BLOCK_TOP_Y, z: BLOCK.row + 0.25});

            // Its end, now half a cell wide: over the half it fills, not beside it, nor astride the two.
            expect(fits(room, canvasTypeIndex, onEnd(0.25), PLUS_Z, HALF_CANVAS)).toBe(true);
            expect(fits(room, canvasTypeIndex, onEnd(0.75), PLUS_Z, HALF_CANVAS)).toBe(false);
            expect(fits(room, canvasTypeIndex, onEnd(0.5), PLUS_Z, HALF_CANVAS)).toBe(false);
            expect(fits(room, canvasTypeIndex, onEnd(0.5), PLUS_Z, {x: 1, y: 0.5, z: 1})).toBe(false);

            // Its top, likewise.
            expect(fits(room, canvasTypeIndex, onTop(0.25), UP, HALF_CANVAS)).toBe(true);
            expect(fits(room, canvasTypeIndex, onTop(0.75), UP, HALF_CANVAS)).toBe(false);
            expect(fits(room, canvasTypeIndex, onTop(0.5), UP, HALF_CANVAS)).toBe(false);
        });
    });

    it("is found again by the block, and counted against the face it lies on", async () => {
        await inTheRoom((user, room) => {
            setShape(room, BLOCK, LOW_X_HALF);
            const blockQuad = (axis: "x" | "z", orientation: "-" | "+") =>
                VoxelQueryUtil.getVoxelQuadIndex(BLOCK.row, BLOCK.col, axis, orientation, BLOCK.layer);

            expect(ObjectUpdateUtil.addObject(user, room, attachment(user, room, canvasTypeIndex, "inner",
                {x: BLOCK.col + 0.5, y: BLOCK_MIDDLE_Y, z: BLOCK.row + 0.25}, PLUS_X, HALF_CANVAS))).toBe(true);
            expect(ObjectUpdateUtil.addObject(user, room, attachment(user, room, canvasTypeIndex, "end",
                {x: BLOCK.col + 0.25, y: BLOCK_MIDDLE_Y, z: BLOCK.row + 1}, PLUS_Z, HALF_CANVAS))).toBe(true);

            expect(ObjectAttachmentUtil.getObjectIdsAttachedToVoxelBlock(room, blockQuad("x", "+")).sort())
                .toEqual(["end", "inner"]);
            // The inner face is a cell long, the end half a cell: one canvas covers half of the first, all of the second.
            expect(ObjectAttachmentUtil.getVoxelQuadCoverage(room, blockQuad("x", "+"))).toBe(0.5);
            expect(ObjectAttachmentUtil.getVoxelQuadCoverage(room, blockQuad("z", "+"))).toBe(1);
            expect(ObjectAttachmentUtil.getVoxelQuadCoverage(room, blockQuad("x", "-"))).toBe(0);
        });
    });

    it("can be asked of a block as if it had another shape, without giving it one", async () => {
        await inTheRoom((user, room) => {
            const onSide = new ObjectTransform({x: BLOCK.col + 1, y: BLOCK_MIDDLE_Y, z: BLOCK.row + 0.25},
                PLUS_X, HALF_CANVAS);
            const as = (shape: number) => ({row: BLOCK.row, col: BLOCK.col, collisionLayer: BLOCK.layer, shape});

            expect(ObjectAttachmentUtil.canPlaceObject(room, "canvas", canvasTypeIndex, onSide)).toBe(true);
            // Shrunk away from that side it would be left in the air; shrunk toward it, it would not.
            expect(ObjectAttachmentUtil.canPlaceObject(room, "canvas", canvasTypeIndex, onSide, as(LOW_X_HALF))).toBe(false);
            expect(ObjectAttachmentUtil.canPlaceObject(room, "canvas", canvasTypeIndex, onSide, as(HIGH_X_HALF))).toBe(true);
            expect(ObjectAttachmentUtil.canPlaceObject(room, "canvas", canvasTypeIndex, onSide, as(0))).toBe(false);
            expect(VoxelQueryUtil.isVoxelBlockWholeAt(room.voxelGrid.voxels, BLOCK.row, BLOCK.col, BLOCK.layer)).toBe(true);
        });
    });

    it("is never a door, which needs whole blocks behind it on the side of their cells", async () => {
        await inTheRoom((user, room) => {
            const doorSize = ObjectScaleUtil.getObjectSize(doorTypeIndex, UNIT_VEC3);
            const DOOR_COL = 9;
            const doorAt = (z: number) => ({x: DOOR_COL + 0.5 * doorSize.x, y: 0.5 * doorSize.y, z});
            const numDoorCols = Math.ceil(doorSize.x);
            const shrinkWallBehindDoor = (shape: number) => {
                for (let col = DOOR_COL; col < DOOR_COL + numDoorCols; ++col)
                {
                    for (let layer = 0; layer < WALL_LAYERS; ++layer)
                        setShape(room, {row: WALL_ROW, col, layer}, shape);
                }
            };
            expect(fits(room, doorTypeIndex, doorAt(WALL_ROW), FACING)).toBe(true);

            // The wall thinned from behind still lies against the door's plane, and holds a canvas there; not a door.
            shrinkWallBehindDoor(LOW_Z_HALF);
            expect(fits(room, canvasTypeIndex, {x: DOOR_COL + 0.5, y: 1, z: WALL_ROW}, FACING)).toBe(true);
            expect(fits(room, doorTypeIndex, doorAt(WALL_ROW), FACING)).toBe(false);

            // Thinned from in front, its face is across the middle of its cells: a canvas hangs there, a door nowhere.
            shrinkWallBehindDoor(HIGH_Z_HALF);
            expect(fits(room, canvasTypeIndex, {x: DOOR_COL + 0.5, y: 1, z: WALL_ROW + 0.5}, FACING)).toBe(true);
            expect(fits(room, doorTypeIndex, doorAt(WALL_ROW + 0.5), FACING)).toBe(false);
            expect(fits(room, doorTypeIndex, doorAt(WALL_ROW), FACING)).toBe(false);
        });
    });
});

describe("how much of a face attached objects cover", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    // The wall's own face over one cell and layer.
    const wallFace = (col: number, layer: number) => VoxelQueryUtil.getVoxelQuadIndex(WALL_ROW, col, "z", "-", layer);
    const coverage = (room: Room, quadIndex: number) => ObjectAttachmentUtil.getVoxelQuadCoverage(room, quadIndex);

    it("is the share of the face under what lies on it, and nothing for what only meets its edge", async () => {
        await inTheRoom((user, room) => {
            expect(coverage(room, wallFace(9, 2))).toBe(0);

            // A canvas a cell across and two layers tall.
            expect(ObjectUpdateUtil.addObject(user, room, attachment(user, room, canvasTypeIndex, "whole",
                {x: 9.5, y: 1.5, z: WALL_ROW}))).toBe(true);
            expect(coverage(room, wallFace(9, 2))).toBe(1);
            expect(coverage(room, wallFace(9, 3))).toBe(1);
            for (const [col, layer] of [[8, 2], [10, 3], [9, 1], [9, 4]])
                expect(coverage(room, wallFace(col, layer)), `col ${col}, layer ${layer}`).toBe(0);

            // One half a cell across and a layer tall, in a face's corner.
            expect(ObjectUpdateUtil.addObject(user, room, attachment(user, room, canvasTypeIndex, "half",
                {x: 12.25, y: 1.25, z: WALL_ROW}, FACING, {x: 0.5, y: 0.5, z: 1}))).toBe(true);
            expect(coverage(room, wallFace(12, 2))).toBe(0.5);
        });
    });

    it("counts only what lies on that very face", async () => {
        await inTheRoom((user, room) => {
            const floorTile = (row: number, col: number) => VoxelQueryUtil.getFloorVoxelQuadIndex(row, col);
            const blockFace = (axis: "x" | "y", orientation: "-" | "+") =>
                VoxelQueryUtil.getVoxelQuadIndex(BLOCK.row, BLOCK.col, axis, orientation, BLOCK.layer);

            // At the wall's foot, and on the floor tile in front of it.
            expect(ObjectUpdateUtil.addObject(user, room, attachment(user, room, canvasTypeIndex, "on-the-wall",
                {x: 16.5, y: 0.5, z: WALL_ROW}))).toBe(true);
            expect(coverage(room, wallFace(16, 0))).toBe(1);
            expect(coverage(room, floorTile(WALL_ROW - 1, 16))).toBe(0);
            expect(ObjectUpdateUtil.addObject(user, room, attachment(user, room, canvasTypeIndex, "on-the-floor",
                {x: 15.5, y: 0, z: WALL_ROW - 0.5}, UP))).toBe(true);
            expect(coverage(room, floorTile(WALL_ROW - 1, 15))).toBe(1);
            expect(coverage(room, wallFace(15, 0))).toBe(0);

            // On the floating block's top: not its side, its underside, or the floor below it.
            expect(ObjectUpdateUtil.addObject(user, room, attachment(user, room, canvasTypeIndex, "on-the-block",
                {x: BLOCK.col + 0.5, y: BLOCK_TOP_Y, z: BLOCK.row + 0.5}, UP))).toBe(true);
            expect(coverage(room, blockFace("y", "+"))).toBe(1);
            expect(coverage(room, blockFace("y", "-"))).toBe(0);
            expect(coverage(room, blockFace("x", "+"))).toBe(0);
            expect(coverage(room, floorTile(BLOCK.row, BLOCK.col))).toBe(0);
        });
    });

    it("reads a stored transform as where it stands on the grid, though it decodes a little off it", async () => {
        await inTheRoom((user, room) => {
            // As a canvas at (14.5, 1.5) on the wall comes back off the wire (see ObjectTransform).
            expect(ObjectUpdateUtil.addObject(user, room, attachment(user, room, canvasTypeIndex, "decoded",
                {x: 14.4996, y: 1.4996, z: WALL_ROW - 0.0004}, {x: -0.0000153, y: -0.0000153, z: -0.99998}))).toBe(true);
            expect(coverage(room, wallFace(14, 2))).toBe(1);
            expect(coverage(room, wallFace(14, 3))).toBe(1);
            expect(coverage(room, wallFace(13, 2))).toBe(0);
            expect(coverage(room, wallFace(14, 1))).toBe(0);
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
            const placed = ObjectAttachmentUtil.findPlacement(room, lampTypeIndex, {x: 3.7, y: 0.1, z: 3.9}, UP,
                UNIT_VEC3, accepts)!;
            // Across the face in quarter-voxel steps, and on the face's own plane.
            expect(placed.pos).toEqual({x: 3.75, y: 0, z: 4});
            expect(placed.dir).toEqual(UP);
        });
    });

    it("sets an object half a voxel across flush with a block's edge, on a wall and on a floor", async () => {
        await inTheRoom((user, room) => {
            const half = {x: 0.5, y: 0.5, z: 1};
            const accepts = (tr: ObjectTransform) => ObjectAttachmentUtil.canPlaceObject(room, "canvas", canvasTypeIndex, tr);
            // Against the wall's left end, and in a cell's corner on the floor.
            const wallEnd = WALL_COL_MIN;
            const onWall = ObjectAttachmentUtil.findPlacement(room, canvasTypeIndex,
                {x: wallEnd + 0.27, y: 1.24, z: WALL_ROW}, FACING, half, accepts)!;
            expect(onWall.pos).toEqual({x: wallEnd + 0.25, y: 1.25, z: WALL_ROW});
            const onFloor = ObjectAttachmentUtil.findPlacement(room, canvasTypeIndex, {x: 3.2, y: 0, z: 5.3}, UP,
                half, accepts)!;
            expect(onFloor.pos).toEqual({x: 3.25, y: 0, z: 5.25});
            for (const placed of [onWall, onFloor])
                expect(ObjectUpdateUtil.canAddObject(user, room, attachment(user, room, canvasTypeIndex, "flush",
                    placed.pos, placed.dir, half))).toBe(true);
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
            const scale = ObjectScaleUtil.getDefaultScale(lampTypeIndex, () => true);
            expect(scale).toEqual({x: 1, y: 0.5, z: 1});
            expect(ObjectScaleUtil.sanitize(lampTypeIndex, scale)).toEqual(scale);

            const accepts = (tr: ObjectTransform) => ObjectAttachmentUtil.canPlaceObject(room, "lamp", lampTypeIndex, tr);
            for (const dir of WALL_DIRECTIONS)
            {
                // One cell wide and one layer tall, with nothing above or below it.
                const side = Vector3DUtil.add(BLOCK_CENTRE, Vector3DUtil.scale(dir, 0.5));
                const placed = ObjectAttachmentUtil.findPlacement(room, lampTypeIndex, side, dir, scale, accepts);
                expect(placed, `facing ${JSON.stringify(dir)}`).toBeDefined();
                expect(placed!.pos.y).toBeCloseTo(BLOCK_CENTRE.y, 6);
                expect(ObjectAttachmentUtil.findPlacement(room, lampTypeIndex, side, dir, UNIT_VEC3, accepts))
                    .toBeUndefined();
            }
        });
    });

    it("adds a new canvas a whole block where one fits near the spot, up or down the wall, and one layer tall where not", async () => {
        await inTheRoom((user, room) => {
            // As adding one from a clicked face does: the first size the canvas takes that finds a placement.
            const accepts = (tr: ObjectTransform) => ObjectAttachmentUtil.canPlaceObject(room, "canvas", canvasTypeIndex, tr);
            const addedAt = (spot: Vec3, dir: Vec3) => {
                const place = (scale: Vec3) => ObjectAttachmentUtil.findPlacement(room, canvasTypeIndex, spot, dir, scale,
                    accepts);
                return place(ObjectScaleUtil.getDefaultScale(canvasTypeIndex, scale => place(scale) != undefined))!;
            };

            // The wall's lowest and highest layers: a whole block centred on either would run off the wall.
            const top = WALL_LAYERS * COLLISION_LAYER_HEIGHT;
            const low = addedAt({x: MIDDLE.x, y: 0.5 * COLLISION_LAYER_HEIGHT, z: WALL_ROW}, FACING);
            expect(low.scale).toEqual(UNIT_VEC3);
            expect(low.pos.y).toBeCloseTo(0.5, 6);
            const high = addedAt({x: MIDDLE.x, y: top - 0.5 * COLLISION_LAYER_HEIGHT, z: WALL_ROW}, FACING);
            expect(high.scale).toEqual(UNIT_VEC3);
            expect(high.pos.y).toBeCloseTo(top - 0.5, 6);

            // The side of a lone block holds one layer.
            for (const dir of WALL_DIRECTIONS)
            {
                const onSide = addedAt(Vector3DUtil.add(BLOCK_CENTRE, Vector3DUtil.scale(dir, 0.5)), dir);
                expect(onSide.scale, `facing ${JSON.stringify(dir)}`).toEqual({x: 1, y: 0.5, z: 1});
                expect(onSide.pos.y).toBeCloseTo(BLOCK_CENTRE.y, 6);
            }

            expect(addedAt({x: 3.5, y: 0, z: 3.5}, UP).scale).toEqual(UNIT_VEC3);
        });
    });

    it("adds every other type at unit scale unless it says otherwise", () => {
        for (const objectTypeIndex of [canvasTypeIndex, propTypeIndex, doorTypeIndex])
            expect(ObjectScaleUtil.getDefaultScale(objectTypeIndex, () => true)).toEqual(UNIT_VEC3);
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
                    for (const axis of ["x", "y", "z"] as const)
                        expect(nowFixed[axis], label).toBeCloseTo(fixed[axis], 6);
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

            expect(4 * resized.pos.x % 1).toBeCloseTo(0, 6);
            expect(resized.pos.z).toBe(WALL_ROW);
            expect(4 * (resized.pos.y - 0.5 * size.y) % 1).toBeCloseTo(0, 6);
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

    it("grows up to a neighbour's edge, and refuses a size that runs into it", async () => {
        await inTheRoom((user, room) => {
            const canvas = attachment(user, room, canvasTypeIndex, "canvas", MIDDLE);
            const {right} = Geometry3DUtil.getAxisFacingBasis(FACING);
            const fixed = fixedCornerOf(canvas.transform, canvasTypeIndex, {x: 1, y: -1});

            // A neighbour whose near edge sits exactly where a 2.5-wide canvas reaches from the held corner.
            const touching = attachment(user, room, canvasTypeIndex, "touching",
                {...Vector3DUtil.add(fixed, Vector3DUtil.scale(right, 3)), y: MIDDLE.y});
            expect(ObjectUpdateUtil.addObject(user, room, touching)).toBe(true);

            const widest = ObjectAttachmentUtil.getResizeResult(room, canvas, canvas.transform, 1, -1,
                draggedTo(fixed, FACING, {x: 1, y: -1}, 2.5, 1))!;
            expect(widest?.scale.x).toBe(2.5);
            expect(Vector3DUtil.distSqr(fixedCornerOf(widest, canvasTypeIndex, {x: 1, y: -1}), fixed)).toBeCloseTo(0, 6);

            // A neighbour half a voxel nearer leaves 2.5 no room.
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

    it("resizes an object on the floor, holding the opposite corner along both of its axes", async () => {
        // Lamps are the only floor objects that scale; their edit options resize them, but the rule is the
        // same for any type.
        await inTheRoom((user, room) => {
            const lamp = attachment(user, room, lampTypeIndex, "floor-lamp", {x: 3.5, y: 0, z: 3.5}, UP);
            for (const corner of CORNERS)
            {
                const fixed = fixedCornerOf(lamp.transform, lampTypeIndex, corner);
                const resized = ObjectAttachmentUtil.getResizeResult(room, lamp, lamp.transform, corner.x, corner.y,
                    draggedTo(fixed, UP, corner, 0.5, 1))!;
                expect(resized.scale).toEqual({x: 0.5, y: 1, z: 1});
                expect(resized.dir).toEqual(UP);
                expect(resized.pos.y).toBe(0);
                expect(Vector3DUtil.distSqr(fixedCornerOf(resized, lampTypeIndex, corner), fixed)).toBeCloseTo(0, 6);
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

    // A canvas's rotate tool (see CanvasEditOptions): the footprint swaps where it stands.
    it("turns a canvas where it stands, on a floor and on a wall, and turning it back puts it back exactly", async () => {
        await inTheRoom((user, room) => {
            const onFloor = new ObjectTransform({x: 4, y: 0, z: 3.5}, UP, {x: 2, y: 1, z: 1});
            const onWall = new ObjectTransform({x: MIDDLE.x, y: 1.5, z: WALL_ROW}, FACING, {x: 2, y: 1, z: 1});
            for (const start of [onFloor, onWall])
            {
                const label = `facing ${JSON.stringify(start.dir)}`;
                const turned = ObjectAttachmentUtil.getResizedInPlace(canvasTypeIndex, start,
                    {x: start.scale.y, y: start.scale.x, z: start.scale.z});
                expect(turned.scale, label).toEqual({x: 1, y: 2, z: 1});
                expect(ObjectAttachmentUtil.canPlaceObject(room, "canvas", canvasTypeIndex, turned), label).toBe(true);

                const back = ObjectAttachmentUtil.getResizedInPlace(canvasTypeIndex, turned, start.scale);
                expect(back.scale, label).toEqual(start.scale);
                for (const axis of ["x", "y", "z"] as const)
                    expect(back.pos[axis], label).toBeCloseTo(start.pos[axis], 6);
            }

            // The same rule the server applies to the turned transform the tool sends.
            const canvas = attachment(user, room, canvasTypeIndex, "canvas", onFloor.pos, UP, onFloor.scale);
            expect(ObjectUpdateUtil.addObject(user, room, canvas)).toBe(true);
            const turned = ObjectAttachmentUtil.getResizedInPlace(canvasTypeIndex, canvas.transform, {x: 1, y: 2, z: 1});
            expect(ObjectUpdateUtil.canSetObjectTransform(user, room,
                new SetObjectTransformSignal(room.id, canvas.objectId, turned, true))).toBe(true);
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

// A pinhole camera at eye looking at target, upright: where a world point falls on its image plane (x right,
// y up), or null behind it. Turns are compared by screen direction only, so any such frame will do.
function createProjection(eye: Vec3, target: Vec3): (point: Vec3) => {x: number, y: number} | null
{
    const forward = Vector3DUtil.normalize(Vector3DUtil.subtract(target, eye));
    const right = Vector3DUtil.normalize(Vector3DUtil.cross(forward, {x: 0, y: 1, z: 0}));
    const up = Vector3DUtil.cross(right, forward);
    return (point) => {
        const offset = Vector3DUtil.subtract(point, eye);
        const depth = Vector3DUtil.dot(offset, forward);
        return (depth > 0) ? {x: Vector3DUtil.dot(offset, right) / depth, y: Vector3DUtil.dot(offset, up) / depth} : null;
    };
}

describe("the turn an attached object's content keeps when it moves", () => {
    const DOWN: Vec3 = {x: 0, y: -1, z: 0};
    const PICTURE: Vec3 = {x: 10, y: 1.5, z: 10};
    // For a viewer standing in front of a wall facing dir, looking at it: a spot on the floor or ceiling
    // between them, and a projection from where they stand.
    const inFrontOf = (dir: Vec3, y: number) => ({x: PICTURE.x + 1.5 * dir.x, y, z: PICTURE.z + 1.5 * dir.z});
    const viewer = (dir: Vec3, target: Vec3) => createProjection(
        {x: PICTURE.x + 5 * dir.x, y: 1.5, z: PICTURE.z + 5 * dir.z}, target);
    // An axis direction with its zeros unsigned, so the two ways of writing one compare equal.
    const axis = (v: Vec3): Vec3 => ({x: v.x + 0, y: v.y + 0, z: v.z + 0});
    const away = (dir: Vec3): Vec3 => axis(Vector3DUtil.scale(dir, -1));

    it("lays a wall's picture on the floor with its top away from the viewer, whichever wall it hung on", () => {
        for (const dir of WALL_DIRECTIONS)
        {
            const floor = inFrontOf(dir, 0);
            const quarterTurns = QuarterTurnsUtil.getMovedQuarterTurns({pos: PICTURE, dir}, 0, {pos: floor, dir: UP},
                viewer(dir, floor));
            expect(axis(QuarterTurnsUtil.getContentUp(UP, quarterTurns)), JSON.stringify(dir)).toEqual(away(dir));
        }
    });

    it("puts a wall's picture on the ceiling with its top toward the viewer, as seen looking up", () => {
        for (const dir of WALL_DIRECTIONS)
        {
            const ceiling = inFrontOf(dir, 3);
            const quarterTurns = QuarterTurnsUtil.getMovedQuarterTurns({pos: PICTURE, dir}, 0,
                {pos: ceiling, dir: DOWN}, viewer(dir, ceiling));
            expect(axis(QuarterTurnsUtil.getContentUp(DOWN, quarterTurns)), JSON.stringify(dir)).toEqual(axis(dir));
        }
    });

    it("stands a floor's picture upright on a wall when it looked upright, and turned as it looked turned", () => {
        for (const dir of WALL_DIRECTIONS)
        {
            const floor = inFrontOf(dir, 0);
            const project = viewer(dir, floor);
            // The turn that looks upright on the floor, as a wall's picture laid down gets (see above).
            const upright = QuarterTurnsUtil.getMovedQuarterTurns({pos: PICTURE, dir}, 0, {pos: floor, dir: UP}, project);
            for (let extraTurns = 0; extraTurns < 4; ++extraTurns)
            {
                expect(QuarterTurnsUtil.getMovedQuarterTurns({pos: floor, dir: UP}, (upright + extraTurns) % 4,
                    {pos: PICTURE, dir}, project), `${JSON.stringify(dir)}, ${extraTurns}`).toBe(extraTurns);
            }
        }
    });

    it("keeps its turn on the same face, wherever it goes there and however it is seen", () => {
        const project = createProjection({x: 3, y: 4, z: 2}, {x: 10, y: 0, z: 10});
        for (const dir of [...WALL_DIRECTIONS, UP, DOWN])
        {
            for (let quarterTurns = 0; quarterTurns < 4; ++quarterTurns)
            {
                expect(QuarterTurnsUtil.getMovedQuarterTurns({pos: PICTURE, dir}, quarterTurns,
                    {pos: {x: 14, y: 0.5, z: 7}, dir}, project)).toBe(quarterTurns);
            }
        }
    });

    it("starts upright for the viewer: on a wall unturned, and on a floor with its top away from them", () => {
        for (const dir of WALL_DIRECTIONS)
        {
            const floor = inFrontOf(dir, 0);
            const project = viewer(dir, floor);
            expect(QuarterTurnsUtil.pickQuarterTurnsOnScreen(PICTURE, UP, PICTURE, dir, project)).toBe(0);
            expect(axis(QuarterTurnsUtil.getContentUp(UP, QuarterTurnsUtil.pickQuarterTurnsOnScreen(floor, UP, floor, UP,
                project)))).toEqual(away(dir));
        }
    });
});

describe("a prop", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    // Everyday objects of each size (the wide one isn't square, so a turn changes the size it needs), and a
    // painting, which only a canvas shows, and at any size.
    useFixturePictures();
    const square = {path: FIXTURE_PICTURES.square}, wide = {path: FIXTURE_PICTURES.wide},
        tall = {path: FIXTURE_PICTURES.tall};
    const painting = {path: FIXTURE_PICTURES.painting};
    const scaleOf = (image: {path: string}, quarterTurns: number = 0) =>
        PropObjectTypeConfig.util.getImageScale(image.path, quarterTurns)!;

    function showing(user: User, room: Room, objectTypeIndex: number, objectId: string, imagePath: string, scale: Vec3,
        quarterTurns: number = 0): AddObjectSignal
    {
        const shown = attachment(user, room, objectTypeIndex, objectId, MIDDLE, FACING, scale);
        shown.metadata[ObjectMetadataKeyEnumMap.ImagePath] = new EncodableByteString(imagePath);
        shown.metadata[ObjectMetadataKeyEnumMap.QuarterTurns] = new EncodableByteString(
            QuarterTurnsUtil.encode(quarterTurns));
        return shown;
    }

    it("is added only at its image's size, turned with it, while a painting's canvas takes any", async () => {
        await inTheRoom((user, room) => {
            const canAdd = (shown: AddObjectSignal) => ObjectUpdateUtil.canAddObject(user, room, shown);
            expect(canAdd(showing(user, room, propTypeIndex, "a", wide.path, scaleOf(wide, 0)))).toBe(true);
            expect(canAdd(showing(user, room, propTypeIndex, "b", wide.path, scaleOf(wide, 1), 1))).toBe(true);
            expect(canAdd(showing(user, room, propTypeIndex, "c", wide.path, scaleOf(wide, 1)))).toBe(false);
            expect(canAdd(showing(user, room, propTypeIndex, "d", wide.path, UNIT_VEC3))).toBe(false);

            // Down to half a block across.
            expect(canAdd(showing(user, room, canvasTypeIndex, "e", painting.path, {x: 0.5, y: 0.5, z: 1}))).toBe(true);
            expect(canAdd(showing(user, room, canvasTypeIndex, "f", painting.path, {x: 3.5, y: 2, z: 1}))).toBe(true);
        });
    });

    it("is added showing any image that fits near the spot, up or down the wall, so a lone block's side takes only one a layer tall", async () => {
        await inTheRoom((user, room) => {
            // As adding one from a clicked face does: each image at its own size, with it as the prop's.
            const addedAt = (image: {path: string}, spot: Vec3, dir: Vec3) => {
                const accepts = (tr: ObjectTransform) => {
                    const prop = attachment(user, room, propTypeIndex, "new", tr.pos, tr.dir, tr.scale);
                    prop.metadata[ObjectMetadataKeyEnumMap.ImagePath] = new EncodableByteString(image.path);
                    return ObjectUpdateUtil.canAddObject(user, room, prop);
                };
                return ObjectAttachmentUtil.findPlacement(room, propTypeIndex, spot, dir, scaleOf(image), accepts);
            };

            // The wall's lowest layer: every size, shifted up as far as it needs.
            const lowest = {x: MIDDLE.x, y: 0.5 * COLLISION_LAYER_HEIGHT, z: WALL_ROW};
            for (const image of [square, wide, tall])
                expect(addedAt(image, lowest, FACING), image.path).toBeDefined();

            for (const dir of WALL_DIRECTIONS)
            {
                const side = Vector3DUtil.add(BLOCK_CENTRE, Vector3DUtil.scale(dir, 0.5));
                expect(addedAt(wide, side, dir)).toBeDefined();
                expect(addedAt(square, side, dir)).toBeUndefined();
                expect(addedAt(tall, side, dir)).toBeUndefined();
            }
        });
    });

    it("moves, but is never resized", async () => {
        await inTheRoom((user, room) => {
            const prop = showing(user, room, propTypeIndex, "prop", wide.path, scaleOf(wide, 0));
            expect(ObjectUpdateUtil.addObject(user, room, prop)).toBe(true);
            const canMoveTo = (transform: ObjectTransform) => ObjectUpdateUtil.canSetObjectTransform(user, room,
                new SetObjectTransformSignal(room.id, prop.objectId, transform, true));

            const moved = new ObjectTransform({...MIDDLE, x: MIDDLE.x + 1}, {...FACING}, scaleOf(wide, 0));
            expect(canMoveTo(moved)).toBe(true);
            for (const scale of [scaleOf(wide, 1), UNIT_VEC3, {x: 0.5, y: 0.5, z: 1}])
                expect(canMoveTo(ObjectAttachmentUtil.getResizedInPlace(propTypeIndex, prop.transform, scale)))
                    .toBe(false);
        });
    });

    it("changes image or turn only together with the size that needs, as one edit", async () => {
        await inTheRoom((user, room) => {
            const prop = showing(user, room, propTypeIndex, "prop", square.path, scaleOf(square));
            expect(ObjectUpdateUtil.addObject(user, room, prop)).toBe(true);
            const signal = (key: number, value: string, transform?: ObjectTransform) =>
                new SetObjectMetadataSignal(room.id, prop.objectId, key, value, transform);
            const stored = () => room.objectById[prop.objectId];

            // To the wide object: its size comes with it.
            expect(ObjectUpdateUtil.canSetObjectMetadata(user, room,
                signal(ObjectMetadataKeyEnumMap.ImagePath, wide.path))).toBe(false);
            const resized = ObjectAttachmentUtil.getResizedInPlace(propTypeIndex, stored().transform, scaleOf(wide, 0));
            expect(ObjectUpdateUtil.setObjectMetadata(user, room,
                signal(ObjectMetadataKeyEnumMap.ImagePath, wide.path, resized))).toBe(true);
            expect(stored().transform.scale).toEqual(ObjectScaleUtil.sanitize(propTypeIndex, scaleOf(wide, 0)));

            // A quarter-turn swaps its size, since it isn't square.
            const turn = QuarterTurnsUtil.encode(1);
            expect(ObjectUpdateUtil.canSetObjectMetadata(user, room,
                signal(ObjectMetadataKeyEnumMap.QuarterTurns, turn))).toBe(false);
            const turned = ObjectAttachmentUtil.getResizedInPlace(propTypeIndex, stored().transform, scaleOf(wide, 1));
            expect(ObjectUpdateUtil.setObjectMetadata(user, room,
                signal(ObjectMetadataKeyEnumMap.QuarterTurns, turn, turned))).toBe(true);
            expect(stored().transform.scale).toEqual(ObjectScaleUtil.sanitize(propTypeIndex, scaleOf(wide, 1)));

            // A transform that doesn't fit where it goes is refused with its value (see below for the ways a
            // change of image is tried).
            const offTheWall = new ObjectTransform({x: 60, y: 1, z: 60}, {...FACING}, scaleOf(wide, 0));
            expect(ObjectUpdateUtil.canSetObjectMetadata(user, room,
                signal(ObjectMetadataKeyEnumMap.QuarterTurns, QuarterTurnsUtil.encode(0), offTheWall))).toBe(false);

            // A painting is no prop's, at any size.
            expect(ObjectUpdateUtil.canSetObjectMetadata(user, room,
                signal(ObjectMetadataKeyEnumMap.ImagePath, painting.path))).toBe(false);
        });
    });

    it("takes a new image's size whichever way there is room where it stands, holding one of its edges", async () => {
        await inTheRoom((user, room) => {
            const wallTop = WALL_LAYERS * COLLISION_LAYER_HEIGHT;
            const wallLeft = WALL_COL_MIN, wallRight = WALL_COL_MIN + WALL_COLS;

            const hung = (objectId: string, image: {path: string}, pos: Vec3) => {
                const prop = attachment(user, room, propTypeIndex, objectId, pos, FACING, scaleOf(image));
                prop.metadata[ObjectMetadataKeyEnumMap.ImagePath] = new EncodableByteString(image.path);
                expect(ObjectUpdateUtil.addObject(user, room, prop), objectId).toBe(true);
                return prop;
            };
            const accepts = (prop: AddObjectSignal, image: {path: string}, transform: ObjectTransform) =>
                ObjectUpdateUtil.canSetObjectMetadata(user, room, new SetObjectMetadataSignal(room.id, prop.objectId,
                    ObjectMetadataKeyEnumMap.ImagePath, image.path, transform));
            // The first way the image chooser would send it (see PropEditOptions), as the server checks it.
            const changed = (prop: AddObjectSignal, image: {path: string}) => ObjectAttachmentUtil.getResizeCandidates(
                propTypeIndex, prop.transform, scaleOf(image)).find(transform => accepts(prop, image, transform))!;
            const extent = (tr: ObjectTransform) => {
                const size = ObjectScaleUtil.getObjectSize(propTypeIndex, tr.scale);
                return {left: tr.pos.x - 0.5 * size.x, right: tr.pos.x + 0.5 * size.x,
                    bottom: tr.pos.y - 0.5 * size.y, top: tr.pos.y + 0.5 * size.y};
            };
            const inPlaceFits = (prop: AddObjectSignal, image: {path: string}) => accepts(prop, image,
                ObjectAttachmentUtil.getResizedInPlace(propTypeIndex, prop.transform, scaleOf(image)));

            // Up from its bottom edge where there is room, and down from its top edge at the top of the wall.
            const low = changed(hung("low", wide, {x: 12, y: 0.25, z: WALL_ROW}), square);
            expect(extent(low)).toEqual({left: 11.5, right: 12.5, bottom: 0, top: 1});
            const atTop = hung("atTop", wide, {x: 12, y: wallTop - 0.25, z: WALL_ROW});
            expect(inPlaceFits(atTop, square)).toBe(false);
            expect(extent(changed(atTop, square))).toEqual({left: 11.5, right: 12.5, bottom: wallTop - 1, top: wallTop});

            // Across from whichever end of the wall it stands at.
            for (const [objectId, x] of [["atLeft", wallLeft + 0.25], ["atRight", wallRight - 0.25]] as const)
            {
                const prop = hung(objectId, tall, {x, y: 3, z: WALL_ROW});
                expect(inPlaceFits(prop, square), objectId).toBe(false);
                const grown = extent(changed(prop, square));
                expect(grown, objectId).toEqual({left: (x < 12) ? wallLeft : wallRight - 1,
                    right: (x < 12) ? wallLeft + 1 : wallRight, bottom: 2.5, top: 3.5});
            }

            // Shrinking holds its bottom edge, as growing back does, so the two round-trip.
            const shrunk = changed(hung("shrinking", square, {x: 9.5, y: 3, z: WALL_ROW}), wide);
            expect(extent(shrunk)).toEqual({left: 9, right: 10, bottom: 2.5, top: 3});
        });
    });
});
