/**
 * Scenario tests: line of sight via voxel grid traversal (door "Click to Enter" prompts, speech bubbles).
 * The end block never occludes: wall attachments sit on the wall/room boundary and stored coordinates
 * floor (see ObjectTransform), so half of all doors land inside their wall and would hide themselves.
 * Browser-bound client modules are stubbed; grid, room and door placement are real.
 */
import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import * as THREE from "three";

vi.mock("../../../src/client/graphics/graphicsManager", async () => {
    const THREE = await import("three");
    const camera = new THREE.PerspectiveCamera();
    const scene = new THREE.Scene();
    // Voxel edits invalidate the light map (see LightBlockMap); a stub suffices.
    const lightBlockMap = { requestRecomputation() {}, resetForRoom(_voxels?: unknown) {},
        getNearbyLightAt(_worldPos: unknown, out: any) { return out.setRGB(0, 0, 0); } };
    return { default: { getCamera: () => camera, getScene: () => scene,
        getLightBlockMap: () => lightBlockMap,
        setViewDistance: () => {}, setPointLightSurroundings: () => {},
        setRoomLightingPrefs: () => {} } };
});

vi.mock("../../../src/client/app", () => ({
    default: {
        getCurrentRoom: vi.fn(),
        getVoxelQuads: vi.fn(),
        getUser: vi.fn(),
        getEnv: vi.fn(),
    },
}));

import App from "../../../src/client/app";
import ClientVoxelQueryUtil from "../../../src/client/voxel/util/clientVoxelQueryUtil";
import BufferState from "../../../src/shared/networking/types/bufferState";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import DoorObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import Room from "../../../src/shared/room/types/room";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import { COLLISION_LAYER_MIN, NUM_VOXEL_COLS, NUM_VOXEL_ROWS,
    STOREY_FLOOR_COLLISION_LAYER } from "../../../src/shared/system/sharedConstants";
import { createTestRoom } from "../helpers/roomContent";

const ROOM_ID = "line-of-sight-room";

// A cell of each boundary wall, taken well away from the corners so the wall opposite plays no part.
const MIDDLE_ROW = Math.floor(0.5 * NUM_VOXEL_ROWS);
const MIDDLE_COL = Math.floor(0.5 * NUM_VOXEL_COLS);

// Boundary walls by door facing, with the cell each door hangs in (see DoorObjectTypeConfig).
const WALLS = [
    {facing: "+x", col: 0, row: MIDDLE_ROW},
    {facing: "-x", col: NUM_VOXEL_COLS - 1, row: MIDDLE_ROW},
    {facing: "+z", col: MIDDLE_COL, row: 0},
    {facing: "-z", col: MIDDLE_COL, row: NUM_VOXEL_ROWS - 1},
];

// Viewpoint distance from the door, far enough to cross several cells.
const VIEWING_DIST = 6;

let room: Room;

/** The door itself, as room generation hangs one on the given cell of the boundary wall. */
function makeDoor(col: number, row: number): AddObjectSignal
{
    return DoorObjectTypeConfig.util.makeEntranceDoor(ROOM_ID, col, row, COLLISION_LAYER_MIN);
}

/** Round-trips a transform through storage, yielding the coordinate a client really receives. */
function asStored(transform: ObjectTransform): ObjectTransform
{
    const view = new Uint8Array(64);
    transform.encode(new BufferState(view, 0));
    return ObjectTransform.decode(new BufferState(view, 0)) as ObjectTransform;
}

function vec(v: {x: number, y: number, z: number}): THREE.Vector3
{
    return new THREE.Vector3(v.x, v.y, v.z);
}

/** Where a player stands to look at the given door: a few paces out from its face, at its height. */
function viewpointFacing(door: AddObjectSignal): THREE.Vector3
{
    const {pos, dir} = door.transform;
    return new THREE.Vector3(
        pos.x + dir.x * VIEWING_DIST, pos.y, pos.z + dir.z * VIEWING_DIST);
}

function isBlocked(from: THREE.Vector3, to: THREE.Vector3): boolean
{
    return ClientVoxelQueryUtil.lineSegmentIsBlockedByDrawnVoxelBlock(from, to);
}

beforeEach(() => {
    room = createTestRoom(ROOM_ID, ROOM_ID, RoomTypeEnumMap.Hub, "owner-user", "Owner", "default");
    (App.getCurrentRoom as Mock).mockReturnValue(room);
    (App.getVoxelQuads as Mock).mockReturnValue(room.voxelQuads);
});

describe("Stored coordinates on a block boundary", () => {
    it("brings a wall attachment back a hair below where it was placed", () => {
        for (const wall of WALLS)
        {
            const placed = makeDoor(wall.col, wall.row).transform;
            const stored = asStored(placed);
            expect(stored.pos.x, `${wall.facing} door's x`).toBeLessThanOrEqual(placed.pos.x);
            expect(stored.pos.z, `${wall.facing} door's z`).toBeLessThanOrEqual(placed.pos.z);
            expect(placed.pos.x - stored.pos.x, `${wall.facing} door's x`).toBeLessThan(0.001);
            expect(placed.pos.z - stored.pos.z, `${wall.facing} door's z`).toBeLessThan(0.001);
        }
    });

    it("leaves a door standing in the wall's own cell on half of the room's walls", () => {
        // The premise: half of stored doors fall inside their wall, half in the room.
        const cellsOfStoredDoors = WALLS.map(wall => {
            const stored = asStored(makeDoor(wall.col, wall.row).transform);
            return {
                facing: wall.facing,
                inWallCell:
                    VoxelQueryUtil.getVoxelColFromWorldX(stored.pos.x) === wall.col &&
                    VoxelQueryUtil.getVoxelRowFromWorldZ(stored.pos.z) === wall.row,
            };
        });
        expect(cellsOfStoredDoors).toEqual([
            {facing: "+x", inWallCell: true},
            {facing: "-x", inWallCell: false},
            {facing: "+z", inWallCell: true},
            {facing: "-z", inWallCell: false},
        ]);
    });
});

describe("Seeing a door from inside the room", () => {
    it("finds every wall's door in sight, whichever way it faces", () => {
        for (const wall of WALLS)
        {
            const door = makeDoor(wall.col, wall.row);
            const viewpoint = viewpointFacing(door);
            expect(isBlocked(viewpoint, vec(asStored(door.transform).pos)),
                `${wall.facing} door as stored`).toBe(false);
            expect(isBlocked(viewpoint, vec(door.transform.pos)),
                `${wall.facing} door as placed`).toBe(false);
        }
    });

    it("finds a door in sight from along the wall it is hung on", () => {
        // An angled approach, so the line crosses a corner cell of the same wall.
        for (const wall of WALLS)
        {
            const door = makeDoor(wall.col, wall.row);
            const doorPos = asStored(door.transform).pos;
            const {dir} = door.transform;
            const viewpoint = new THREE.Vector3(
                doorPos.x + (dir.x + dir.z) * VIEWING_DIST,
                doorPos.y,
                doorPos.z + (dir.z + dir.x) * VIEWING_DIST);
            expect(isBlocked(viewpoint, vec(doorPos)), `${wall.facing} door`).toBe(false);
        }
    });
});

describe("Seeing past the room's own geometry", () => {
    it("reports the storey's own floor slab as standing in the way", () => {
        const belowSlab = new THREE.Vector3(MIDDLE_COL + 0.5, 1.75, MIDDLE_ROW + 0.5);
        const aboveSlab = new THREE.Vector3(MIDDLE_COL + 0.5,
            (STOREY_FLOOR_COLLISION_LAYER + 2.5) * 0.5, MIDDLE_ROW + 0.5);
        expect(isBlocked(belowSlab, aboveSlab)).toBe(true);
    });

    it("reports the boundary wall as standing in the way of what lies beyond it", () => {
        const inside = new THREE.Vector3(MIDDLE_COL + 0.5, 1.75, 4.5);
        const outside = new THREE.Vector3(MIDDLE_COL + 0.5, 1.75, -4.5);
        expect(isBlocked(inside, outside)).toBe(true);
    });

    it("does not blind a viewpoint pushed into a wall", () => {
        // The block the line starts in is no more in the way than the one it ends in.
        const insideWall = new THREE.Vector3(0.5, 1.75, MIDDLE_ROW + 0.5);
        const inRoom = new THREE.Vector3(1 + VIEWING_DIST, 1.75, MIDDLE_ROW + 0.5);
        expect(isBlocked(insideWall, inRoom)).toBe(false);
    });

    it("sees straight across an open floor", () => {
        const from = new THREE.Vector3(2.5, 1.75, MIDDLE_ROW + 0.5);
        const to = new THREE.Vector3(NUM_VOXEL_COLS - 2.5, 1.75, MIDDLE_ROW + 0.5);
        expect(isBlocked(from, to)).toBe(false);
    });
});
