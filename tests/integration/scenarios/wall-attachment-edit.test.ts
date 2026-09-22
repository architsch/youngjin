/**
 * Wall attachment editing rules the selection outline's drags are built on: which way along the wall
 * "right" is (the axis moves and resizes share with getMoveResult), and where a corner-handle resize puts
 * an object — its size, which corner holds still, and when it refuses.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { EMPTY_HUB, userAtCenter } from "../helpers/scenarioPresets";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import WallAttachedObjectUtil from "../../../src/shared/object/util/wallAttachedObjectUtil";
import ObjectScaleUtil from "../../../src/shared/object/util/objectScaleUtil";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import RemoveObjectSignal from "../../../src/shared/object/types/removeObjectSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import CanvasObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/canvasObjectTypeConfig";
import Room from "../../../src/shared/room/types/room";
import User from "../../../src/shared/user/types/user";
import Vec3 from "../../../src/shared/math/types/vec3";
import { COLLISION_LAYER_HEIGHT, UNIT_VEC3 } from "../../../src/shared/system/sharedConstants";

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
const lampTypeIndex = ObjectTypeConfigMap.getIndexByType("WallLamp");
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

const CORNERS = [{x: -1, y: -1}, {x: 1, y: -1}, {x: 1, y: 1}, {x: -1, y: 1}];

const WALL = [...Array(WALL_COLS).keys()].flatMap(col => [...Array(WALL_LAYERS).keys()].map(
    layer => ({row: WALL_ROW, col: WALL_COL_MIN + col, layer})));

function attachment(user: User, room: Room, objectTypeIndex: number, objectId: string,
    pos: Vec3, dir: Vec3 = FACING): AddObjectSignal
{
    return new AddObjectSignal(room.id, user.id, user.userName, objectTypeIndex, objectId,
        new ObjectTransform({...pos}, {...dir}, {...UNIT_VEC3}), {});
}

// Where the corner opposite the dragged one is, for an object as it stands.
function fixedCornerOf(tr: ObjectTransform, objectTypeIndex: number, corner: {x: number, y: number}): Vec3
{
    const size = ObjectScaleUtil.getObjectSize(objectTypeIndex, tr.scale);
    const right = WallAttachedObjectUtil.getRightDir(tr.dir);
    return {
        x: tr.pos.x - corner.x * right.x * 0.5 * size.x,
        y: tr.pos.y - corner.y * 0.5 * size.y,
        z: tr.pos.z - corner.x * right.z * 0.5 * size.x,
    };
}

// The dragged corner of an object `size` across, grown out of `fixed` toward `corner`.
function draggedTo(fixed: Vec3, right: Vec3, corner: {x: number, y: number}, width: number, height: number): Vec3
{
    return {
        x: fixed.x + corner.x * right.x * width,
        y: fixed.y + corner.y * height,
        z: fixed.z + corner.x * right.z * width,
    };
}

function along(v: Vec3, right: Vec3): number
{
    return v.x * right.x + v.z * right.z;
}

async function onTheWall(assertions: (user: User, room: Room) => void)
{
    await runScenario({
        name: "a wall to hang things on",
        rooms: [{...EMPTY_HUB, voxels: WALL}],
        users: [userAtCenter("hub")],
        assertions: ({users}) => assertions(users[0].user, ServerRoomManager.roomRuntimeMemories["hub"].room),
    });
}

describe("which way is right along a wall", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("is the way a positive step moves an attachment, on a wall facing either axis", async () => {
        await runScenario({
            name: "walls facing both axes",
            rooms: [{...EMPTY_HUB, voxels: [
                ...WALL,
                // A wall along z, facing -x.
                ...[...Array(10).keys()].flatMap(row => [0, 1, 2, 3].map(layer => ({row: 4 + row, col: 20, layer}))),
            ]}],
            users: [userAtCenter("hub")],
            assertions: ({users}) => {
                const user = users[0].user;
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const onRowWall = attachment(user, room, canvasTypeIndex, "row-wall", MIDDLE);
                const onColWall = attachment(user, room, canvasTypeIndex, "col-wall",
                    {x: 20, y: 1, z: 9}, {x: -1, y: 0, z: 0});

                for (const obj of [onRowWall, onColWall])
                {
                    const right = WallAttachedObjectUtil.getRightDir(obj.transform.dir);
                    const moved = WallAttachedObjectUtil.getMoveResult(room, obj, 0.5, 0, 0)!;
                    expect(moved, `${obj.objectId} could not step`).toBeDefined();
                    expect(moved.newPos.x - obj.transform.pos.x).toBeCloseTo(0.5 * right.x);
                    expect(moved.newPos.z - obj.transform.pos.z).toBeCloseTo(0.5 * right.z);
                }
            },
        });
    });

    it("reads a stored facing by its axis, though it decodes a little off it", () => {
        // A zero component decodes just below zero (see ObjectTransform), which read raw is a z-facing.
        const decoded = {x: 0.99998, y: -0.0000153, z: -0.0000153};
        expect(WallAttachedObjectUtil.getRightDir(decoded))
            .toEqual(WallAttachedObjectUtil.getRightDir({x: 1, y: 0, z: 0}));
    });
});

describe("resizing a wall attachment by a corner", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("takes each size in turn from every corner, holding the opposite corner still", async () => {
        await onTheWall((user, room) => {
            const canvas = attachment(user, room, canvasTypeIndex, "canvas", MIDDLE);
            const right = WallAttachedObjectUtil.getRightDir(FACING);

            for (const corner of CORNERS)
            {
                const fixed = fixedCornerOf(canvas.transform, canvasTypeIndex, corner);
                for (let scale = scaling.minScale.x; scale <= scaling.maxScale.x; scale += scaling.scaleStep.x)
                {
                    const label = `corner (${corner.x}, ${corner.y}) at ${scale}x`;
                    const resized = WallAttachedObjectUtil.getResizeResult(room, canvas, canvas.transform,
                        corner.x, corner.y, draggedTo(fixed, right, corner, scale, scale));
                    expect(resized, label).toBeDefined();
                    expect(resized!.scale, label).toEqual({x: scale, y: scale, z: 1});

                    const nowFixed = fixedCornerOf(resized!, canvasTypeIndex, corner);
                    // Height and bottom edge are on one grid, so vertically it holds exactly...
                    expect(nowFixed.y, label).toBeCloseTo(fixed.y, 6);
                    // ...and along the wall to within a quarter voxel, giving way toward the drag.
                    const giveway = corner.x * (along(nowFixed, right) - along(fixed, right));
                    expect(giveway, label).toBeGreaterThanOrEqual(-1e-6);
                    expect(giveway, label).toBeLessThanOrEqual(0.25 + 1e-6);
                }
            }
        });
    });

    it("lands on the placement grid, where the placement rule accepts it", async () => {
        await onTheWall((user, room) => {
            const canvas = attachment(user, room, canvasTypeIndex, "canvas", MIDDLE);
            const right = WallAttachedObjectUtil.getRightDir(FACING);
            const fixed = fixedCornerOf(canvas.transform, canvasTypeIndex, {x: 1, y: 1});

            const resized = WallAttachedObjectUtil.getResizeResult(room, canvas, canvas.transform, 1, 1,
                draggedTo(fixed, right, {x: 1, y: 1}, 1.5, 2))!;
            const size = ObjectScaleUtil.getObjectSize(canvasTypeIndex, resized.scale);

            expect(2 * resized.pos.x % 1).toBeCloseTo(0, 6);
            expect(2 * resized.pos.z % 1).toBeCloseTo(0, 6);
            expect(2 * (resized.pos.y - 0.5 * size.y) % 1).toBeCloseTo(0, 6);
            expect(WallAttachedObjectUtil.canPlaceObject(room, "canvas", canvasTypeIndex, resized)).toBe(true);
        });
    });

    it("stops at the type's limits however far the corner is taken, either way", async () => {
        await onTheWall((user, room) => {
            const canvas = attachment(user, room, canvasTypeIndex, "canvas", MIDDLE);
            const right = WallAttachedObjectUtil.getRightDir(FACING);
            const fixed = fixedCornerOf(canvas.transform, canvasTypeIndex, {x: 1, y: 1});

            const far = WallAttachedObjectUtil.getResizeResult(room, canvas, canvas.transform, 1, 1,
                draggedTo(fixed, right, {x: 1, y: 1}, 50, 50));
            expect(far?.scale).toEqual({x: scaling.maxScale.x, y: scaling.maxScale.y, z: 1});

            // Past the corner that holds still: the smallest it may be, not turned inside out.
            const crossed = WallAttachedObjectUtil.getResizeResult(room, canvas, canvas.transform, 1, 1,
                draggedTo(fixed, right, {x: 1, y: 1}, -3, -3));
            expect(crossed?.scale).toEqual({x: scaling.minScale.x, y: scaling.minScale.y, z: 1});
        });
    });

    it("gives way behind the held corner when only that way fits, and refuses when neither does", async () => {
        await onTheWall((user, room) => {
            const canvas = attachment(user, room, canvasTypeIndex, "canvas", MIDDLE);
            const right = WallAttachedObjectUtil.getRightDir(FACING);
            const fixed = fixedCornerOf(canvas.transform, canvasTypeIndex, {x: 1, y: -1});

            // A neighbour whose near edge sits exactly where a 2.5-wide canvas would reach from the held
            // corner, so only the rounding that gives way behind keeps them clear of each other.
            const touching = attachment(user, room, canvasTypeIndex, "touching", {
                x: fixed.x + right.x * 3, y: MIDDLE.y, z: fixed.z + right.z * 3});
            expect(ObjectUpdateUtil.addObject(user, room, touching)).toBe(true);

            const widest = WallAttachedObjectUtil.getResizeResult(room, canvas, canvas.transform, 1, -1,
                draggedTo(fixed, right, {x: 1, y: -1}, 2.5, 1))!;
            expect(widest?.scale.x).toBe(2.5);
            const giveway = along(fixedCornerOf(widest, canvasTypeIndex, {x: 1, y: -1}), right) - along(fixed, right);
            expect(giveway).toBeCloseTo(-0.25, 6);

            // A neighbour half a voxel nearer leaves 2.5 no room either way.
            expect(ObjectUpdateUtil.removeObject(user, room, new RemoveObjectSignal(room.id, "touching"))).toBe(true);
            const blocking = attachment(user, room, canvasTypeIndex, "blocking", {
                x: fixed.x + right.x * 2.5, y: MIDDLE.y, z: fixed.z + right.z * 2.5});
            expect(ObjectUpdateUtil.addObject(user, room, blocking)).toBe(true);
            expect(WallAttachedObjectUtil.getResizeResult(room, canvas, canvas.transform, 1, -1,
                draggedTo(fixed, right, {x: 1, y: -1}, 2.5, 1))).toBeUndefined();
        });
    });

    it("refuses a size that runs off the wall", async () => {
        await onTheWall((user, room) => {
            // Half a voxel below the wall's top: growing upward runs out of wall behind it.
            const high = attachment(user, room, canvasTypeIndex, "high",
                {x: MIDDLE.x, y: WALL_HEIGHT - 0.5 - 0.5 * CANVAS_HEIGHT, z: WALL_ROW});
            const right = WallAttachedObjectUtil.getRightDir(FACING);
            const fixed = fixedCornerOf(high.transform, canvasTypeIndex, {x: 1, y: 1});

            expect(WallAttachedObjectUtil.getResizeResult(room, high, high.transform, 1, 1,
                draggedTo(fixed, right, {x: 1, y: 1}, 2.5, 2.5))).toBeUndefined();
        });
    });

    it("keeps a type that declares no scaling at its size", async () => {
        await onTheWall((user, room) => {
            const lamp = attachment(user, room, lampTypeIndex, "lamp", {x: MIDDLE.x + 0.5, y: 2.25, z: WALL_ROW});
            const right = WallAttachedObjectUtil.getRightDir(FACING);
            const fixed = fixedCornerOf(lamp.transform, lampTypeIndex, {x: 1, y: 1});

            const resized = WallAttachedObjectUtil.getResizeResult(room, lamp, lamp.transform, 1, 1,
                draggedTo(fixed, right, {x: 1, y: 1}, 3, 3));
            expect(resized?.scale).toEqual(UNIT_VEC3);
            expect(resized?.pos.x).toBeCloseTo(lamp.transform.pos.x, 6);
            expect(resized?.pos.y).toBeCloseTo(lamp.transform.pos.y, 6);
        });
    });
});
