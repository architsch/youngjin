/**
 * Scenario tests: line of sight via voxel grid traversal (door "Click to Enter" prompts, speech bubbles),
 * and the open-space drop the first-person camera pitches by, which is measured along the same lines.
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
        setViewReferenceOffset: () => {}, setPointLightSurroundings: () => {},
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
import DoorObjectTypeConfig, { ENTRANCE_DIST_IN_FRONT_OF_DOOR,
    SPAWN_DIST_BEHIND_DOOR } from "../../../src/shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import { PLAYER_HEIGHT } from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import Room from "../../../src/shared/room/types/room";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../src/shared/voxel/util/voxelUpdateUtil";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MIN, GENERATED_WALL_THICKNESS, MAX_ROOM_X, MAX_ROOM_Y,
    MAX_ROOM_Z, NUM_VOXEL_COLS, NUM_VOXEL_ROWS,
    STOREY_FLOOR_COLLISION_LAYER, VOXEL_CELL_SIZE } from "../../../src/shared/system/sharedConstants";
import { createTestRoom } from "../helpers/roomContent";

const ROOM_ID = "line-of-sight-room";

// How far in from the room's edge a boundary wall's room-facing side lies.
const WALL_DEPTH = GENERATED_WALL_THICKNESS * VOXEL_CELL_SIZE;

// A place along each boundary wall, taken well away from the corners so the wall opposite plays no part.
const ALONG_X_WALLS = 0.5 * MAX_ROOM_Z + 0.5;
const ALONG_Z_WALLS = 0.5 * MAX_ROOM_X + 0.5;

// Boundary walls by door facing, with where the foot of each one's door stands (see DoorObjectTypeConfig).
const WALLS = [
    {facing: "+x", foot: {x: WALL_DEPTH, y: 0, z: ALONG_X_WALLS}},
    {facing: "-x", foot: {x: MAX_ROOM_X - WALL_DEPTH, y: 0, z: ALONG_X_WALLS}},
    {facing: "+z", foot: {x: ALONG_Z_WALLS, y: 0, z: WALL_DEPTH}},
    {facing: "-z", foot: {x: ALONG_Z_WALLS, y: 0, z: MAX_ROOM_Z - WALL_DEPTH}},
];

// A voxel in the middle of the open floor, and where its middle lies in the world.
const MIDDLE_ROW = Math.floor(0.5 * NUM_VOXEL_ROWS);
const MIDDLE_COL = Math.floor(0.5 * NUM_VOXEL_COLS);
const MIDDLE_X = VoxelQueryUtil.getWorldXAtVoxelColCenter(MIDDLE_COL);
const MIDDLE_Z = VoxelQueryUtil.getWorldZAtVoxelRowCenter(MIDDLE_ROW);

// Viewpoint distance from the door, far enough to cross several blocks.
const VIEWING_DIST = 6;

let room: Room;

/** The door itself, as room generation hangs one on the boundary wall: its foot at the given place and layer. */
function makeDoor(foot: {x: number, z: number}, collisionLayer: number = COLLISION_LAYER_MIN): AddObjectSignal
{
    return DoorObjectTypeConfig.util.makeEntranceDoor(ROOM_ID,
        {x: foot.x, y: (collisionLayer - COLLISION_LAYER_MIN) * COLLISION_LAYER_HEIGHT, z: foot.z});
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
            const placed = makeDoor(wall.foot).transform;
            const stored = asStored(placed);
            expect(stored.pos.x, `${wall.facing} door's x`).toBeLessThanOrEqual(placed.pos.x);
            expect(stored.pos.z, `${wall.facing} door's z`).toBeLessThanOrEqual(placed.pos.z);
            expect(placed.pos.x - stored.pos.x, `${wall.facing} door's x`).toBeLessThan(0.001);
            expect(placed.pos.z - stored.pos.z, `${wall.facing} door's z`).toBeLessThan(0.001);
        }
    });

    it("leaves a door standing inside its wall's own blocks on half of the room's walls", () => {
        // The premise: half of stored doors fall inside their wall, half in the room.
        const blocksOfStoredDoors = WALLS.map(wall => {
            const stored = asStored(makeDoor(wall.foot).transform);
            return {
                facing: wall.facing,
                inWallBlock: VoxelQueryUtil.isPointInVoxelBlock(room.voxelGrid.voxels, stored.pos),
            };
        });
        expect(blocksOfStoredDoors).toEqual([
            {facing: "+x", inWallBlock: true},
            {facing: "-x", inWallBlock: false},
            {facing: "+z", inWallBlock: true},
            {facing: "-z", inWallBlock: false},
        ]);
    });
});

describe("Seeing a door from inside the room", () => {
    it("finds every wall's door in sight, whichever way it faces", () => {
        for (const wall of WALLS)
        {
            const door = makeDoor(wall.foot);
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
            const door = makeDoor(wall.foot);
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
        const belowSlab = new THREE.Vector3(MIDDLE_X, 1.75, MIDDLE_Z);
        const aboveSlab = new THREE.Vector3(MIDDLE_X, (STOREY_FLOOR_COLLISION_LAYER + 2.5) * 0.5, MIDDLE_Z);
        expect(isBlocked(belowSlab, aboveSlab)).toBe(true);
    });

    it("reports the boundary wall as standing in the way of what lies beyond it", () => {
        const inside = new THREE.Vector3(MIDDLE_X, 1.75, 4.5);
        const outside = new THREE.Vector3(MIDDLE_X, 1.75, -4.5);
        expect(isBlocked(inside, outside)).toBe(true);
    });

    it("reports the room's own floor and ceiling as closing it off from inside", () => {
        const x = MIDDLE_X, z = MIDDLE_Z;
        expect(isBlocked(new THREE.Vector3(x, 0.25, z), new THREE.Vector3(x, -2, z)),
            "down through the floor").toBe(true);
        expect(isBlocked(new THREE.Vector3(x, MAX_ROOM_Y - 0.25, z), new THREE.Vector3(x, MAX_ROOM_Y + 2, z)),
            "up through the ceiling").toBe(true);
    });

    it("sees in through the floor and ceiling from outside, which they are not drawn on", () => {
        // As with the walls, and for the same reason: an orbit camera lifted over the room or dropped
        // below it keeps sight of what it is pointed at. Each tile lies at the boundary, so only the
        // step that leaves the room crosses it — not every block of the empty space beyond.
        const x = MIDDLE_X, z = MIDDLE_Z;
        expect(isBlocked(new THREE.Vector3(x, -2, z), new THREE.Vector3(x, 0.25, z)),
            "up from below the floor").toBe(false);
        expect(isBlocked(new THREE.Vector3(x, MAX_ROOM_Y + 2, z), new THREE.Vector3(x, MAX_ROOM_Y - 0.25, z)),
            "down from above the ceiling").toBe(false);
    });

    it("sees into the room from outside it, where the same wall draws nothing", () => {
        // The other way along the same line. A wall is drawn on the side that faces the room and bare
        // on the side that faces away, so from out there the eye passes through it — and so must this,
        // or an orbit camera swung out of the room loses sight of what it is pointed at.
        const outside = new THREE.Vector3(MIDDLE_X, 1.75, -4.5);
        const inside = new THREE.Vector3(MIDDLE_X, 1.75, 4.5);
        expect(isBlocked(outside, inside)).toBe(false);
    });

    it("does not blind a viewpoint pushed into a wall", () => {
        // The block the line starts in is no more in the way than the one it ends in, and the rest of the
        // wall's thickness shows it nothing on the way out.
        const inRoom = new THREE.Vector3(1 + VIEWING_DIST, 1.75, MIDDLE_Z);
        for (let col = 0; col < GENERATED_WALL_THICKNESS; ++col)
        {
            const insideWall = new THREE.Vector3(VoxelQueryUtil.getWorldXAtVoxelColCenter(col), 1.75, MIDDLE_Z);
            expect(isBlocked(insideWall, inRoom), `from the wall's voxel col ${col}`).toBe(false);
        }
    });

    it("sees straight across an open floor", () => {
        const from = new THREE.Vector3(2.5, 1.75, MIDDLE_Z);
        const to = new THREE.Vector3(MAX_ROOM_X - 2.5, 1.75, MIDDLE_Z);
        expect(isBlocked(from, to)).toBe(false);
    });
});

describe("Blocks standing in the open along a line", () => {
    // Blocks stood on the open floor from this voxel on, towards higher rows and cols: a thin wall (one
    // block thick along x, two long along z), a post (one block) or a pillar (two blocks each way).
    const ROW = 24, COL = 24, NUM_LAYERS = 4;
    const EYE_HEIGHT = 0.75; // inside the blocks' second layer

    function standBlocks(numRows: number, numCols: number): void
    {
        for (let row = ROW; row < ROW + numRows; ++row)
        {
            for (let col = COL; col < COL + numCols; ++col)
            {
                for (let layer = COLLISION_LAYER_MIN; layer < COLLISION_LAYER_MIN + NUM_LAYERS; ++layer)
                {
                    VoxelUpdateUtil.addVoxelBlock(undefined, room.voxelGrid.voxels,
                        VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, layer));
                }
            }
        }
    }
    const standThinWall = () => standBlocks(2, 1);
    const standPost = () => standBlocks(1, 1);
    const standPillar = () => standBlocks(2, 2);

    /** A point given in world units from the corner the blocks start at, where a block is 0.5 wide. */
    function at(x: number, z: number, y: number = EYE_HEIGHT): THREE.Vector3
    {
        return new THREE.Vector3(COL * VOXEL_CELL_SIZE + x, y, ROW * VOXEL_CELL_SIZE + z);
    }

    function firstFace(from: THREE.Vector3, to: THREE.Vector3)
    {
        return ClientVoxelQueryUtil.getFirstDrawnFaceAlongRay(
            new THREE.Ray(from, to.clone().sub(from).normalize()));
    }

    it("is stopped by a thin wall standing in the way", () => {
        standThinWall();
        expect(isBlocked(at(-2, 0.5), at(2.5, 0.5))).toBe(true);
        expect(isBlocked(at(2.5, 0.5), at(-2, 0.5))).toBe(true);
    });

    it("passes a thin wall by through the blocks beside it", () => {
        standThinWall();
        expect(isBlocked(at(0.75, -3), at(0.75, 4))).toBe(false);
        // The same line a block over, through the wall, is stopped.
        expect(isBlocked(at(0.25, -3), at(0.25, 4))).toBe(true);
    });

    it("is stopped by a thin wall right beside the viewer, but not when looking away from it", () => {
        standThinWall();
        const besideWall = at(0.75, 0.5);
        expect(isBlocked(besideWall, at(-2, 0.5))).toBe(true);
        expect(isBlocked(besideWall, at(3, 0.5))).toBe(false);
    });

    it("is stopped by a thin wall right in front of the target, when the target is on its far side", () => {
        standThinWall();
        const besideWall = at(0.75, 0.5);
        expect(isBlocked(at(-2, 0.5), besideWall)).toBe(true);
        expect(isBlocked(at(3, 0.5), besideWall)).toBe(false);
    });

    it("does not hide what hangs on the wall's face behind the wall itself", () => {
        standThinWall();
        // On the face, and a hair inside it, as a stored coordinate can come back.
        for (const x of [0.5, 0.4995])
            expect(isBlocked(at(3, 0.5), at(x, 0.5)), `at ${x}`).toBe(false);
    });

    it("is stopped by a post between two points in the blocks either side of its corner", () => {
        standPost();
        expect(isBlocked(at(0.75, 0.1), at(0.1, 0.75))).toBe(true); // across the post's corner
        expect(isBlocked(at(0.75, 0.1), at(0.75, 0.9))).toBe(false); // past it
    });

    it("is stopped by a post whose corner it passes through a little way before its end", () => {
        standPost();
        // In through the post's lower-x face and out through its higher-z one, to end in the open beside it: only
        // a block entered right at the line's end is let off as the end's own.
        expect(isBlocked(at(-2, 0.1), at(0.3, 0.53))).toBe(true);
        // The same way in from further along z, which misses the post.
        expect(isBlocked(at(-2, 0.7), at(0.3, 0.53))).toBe(false);
    });

    it("does not hide a point inside a block behind the block's own face, only behind another's", () => {
        standThinWall();
        // The middle of the wall's first block, from before its end: no other block is entered on the way.
        expect(isBlocked(at(0.25, -2), at(0.25, 0.25))).toBe(false);
        // The middle of its second block, the same way: through the first.
        expect(isBlocked(at(0.25, -2), at(0.25, 0.75))).toBe(true);
    });

    it("meets the wall's faces where they stand, each from the side it is turned to", () => {
        standThinWall();

        const higherX = firstFace(at(3, 0.5), at(-2, 0.5))!;
        expect(higherX.point.x).toBeCloseTo(at(0.5, 0).x, 6);
        expect(higherX.normal).toEqual({x: 1, y: 0, z: 0});

        const lowerX = firstFace(at(-2, 0.5), at(3, 0.5))!;
        expect(lowerX.point.x).toBeCloseTo(at(0, 0).x, 6);
        expect(lowerX.normal).toEqual({x: -1, y: 0, z: 0});

        // Its end, which is one block wide: met in line with the wall, missed a block over.
        const end = firstFace(at(0.25, 4), at(0.25, -3))!;
        expect(end.point.z).toBeCloseTo(at(0, 1).z, 6);
        expect(end.normal).toEqual({x: 0, y: 0, z: 1});
        const beside = firstFace(at(0.75, 4), at(0.75, -3))!;
        expect(beside.point.z).toBeLessThan(at(0, -1).z); // on past the wall
    });

    it("meets the wall's top over the wall, and the room's floor beside it", () => {
        standThinWall();
        const top = firstFace(at(0.25, 0.5, 3), at(0.25, 0.5, -1))!;
        expect(top.point.y).toBeCloseTo(NUM_LAYERS * COLLISION_LAYER_HEIGHT, 6);
        expect(top.normal).toEqual({x: 0, y: 1, z: 0});

        const floor = firstFace(at(0.75, 0.5, 3), at(0.75, 0.5, -1))!;
        expect(floor.point.y).toBeCloseTo(0, 6);
        expect(floor.normal).toEqual({x: 0, y: 1, z: 0});
    });

    it("meets a pillar two blocks thick on its outer side, the faces between its blocks playing no part", () => {
        standPillar();
        expect(isBlocked(at(-2, 0.5), at(2.5, 0.5))).toBe(true);
        const face = firstFace(at(3, 0.5), at(-2, 0.5))!;
        expect(face.point.x).toBeCloseTo(at(1, 0).x, 6);
        expect(face.normal).toEqual({x: 1, y: 0, z: 0});
    });
});

describe("The drop the first-person camera pitches by", () => {
    // The upper storey's lowest layer, and the floor a player stands on there.
    const UPPER_STOREY_LAYER = STOREY_FLOOR_COLLISION_LAYER + 1;
    const UPPER_STOREY_FLOOR_Y = UPPER_STOREY_LAYER * COLLISION_LAYER_HEIGHT;

    /** The measure as FirstPersonCameraPose takes it, from where the player's feet are. */
    function dropAheadOf(footX: number, footZ: number, footY: number, forward: THREE.Vector3): number
    {
        const eye = new THREE.Vector3(footX, footY + 0.8 * PLAYER_HEIGHT, footZ);
        return ClientVoxelQueryUtil.getOpenSpaceDropAhead(eye, forward, footY);
    }

    it("finds nothing below an upper storey, either side of an arrival's walk out of the doorway", () => {
        // Arrivals spawn inside the wall behind their door and walk out (see SpawnHotspotUtil). From in
        // there, sight lines down to the storey below leave through buried faces, which draw nothing —
        // so the sealed storey would read as a drop and tip the camera down for the length of the walk.
        const door = makeDoor(WALLS[0].foot, UPPER_STOREY_LAYER);
        const {pos, dir} = door.transform;
        const forward = new THREE.Vector3(dir.x, 0, dir.z);

        const spawn = dropAheadOf(pos.x - dir.x * SPAWN_DIST_BEHIND_DOOR,
            pos.z - dir.z * SPAWN_DIST_BEHIND_DOOR, UPPER_STOREY_FLOOR_Y, forward);
        const walkedOut = dropAheadOf(pos.x + dir.x * ENTRANCE_DIST_IN_FRONT_OF_DOOR,
            pos.z + dir.z * ENTRANCE_DIST_IN_FRONT_OF_DOOR, UPPER_STOREY_FLOOR_Y, forward);

        expect(spawn, "still in the wall").toBe(0);
        expect(walkedOut, "clear of the wall").toBe(0);
    });

    it("still finds the floor below a block standing on it", () => {
        VoxelUpdateUtil.addVoxelBlock(undefined, room.voxelGrid.voxels,
            VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(MIDDLE_ROW, MIDDLE_COL, COLLISION_LAYER_MIN));

        const onTop = dropAheadOf(MIDDLE_X, MIDDLE_Z, COLLISION_LAYER_HEIGHT, new THREE.Vector3(1, 0, 0));
        expect(onTop).toBeGreaterThan(0);
    });

    it("reads a gap in the floor ahead alike from one step to the next, whichever voxels the gap falls on", () => {
        // A floor a block higher all round, further than the measure looks, with a gap one voxel wide across
        // the way ahead. The voxels the measure reads are fixed in the room, so a step doesn't bring the gap
        // in and out of the reading.
        const REACH = 14; // in voxels
        const blockAt = (row: number, col: number) =>
            VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, COLLISION_LAYER_MIN);
        for (let row = MIDDLE_ROW - REACH; row <= MIDDLE_ROW + REACH; ++row)
        {
            for (let col = MIDDLE_COL - REACH; col <= MIDDLE_COL + REACH; ++col)
                VoxelUpdateUtil.addVoxelBlock(undefined, room.voxelGrid.voxels, blockAt(row, col));
        }
        const GAP_ROWS = [MIDDLE_ROW, MIDDLE_ROW + 1];
        const footZ = (MIDDLE_ROW + 1) * VOXEL_CELL_SIZE; // where the gap's two rows meet
        const forward = new THREE.Vector3(1, 0, 0);

        let numGapsRead = 0;
        for (const gapCol of [MIDDLE_COL + 4, MIDDLE_COL + 5])
        {
            for (const row of GAP_ROWS)
                VoxelUpdateUtil.removeVoxelBlock(undefined, room.voxelGrid.voxels, blockAt(row, gapCol));

            // From one voxel and from two before the gap, near enough to see down into it.
            const gapX = VoxelQueryUtil.getWorldXAtVoxelColCenter(gapCol);
            const readings = [1, 2].map(numVoxels =>
                dropAheadOf(gapX - numVoxels * VOXEL_CELL_SIZE, footZ, COLLISION_LAYER_HEIGHT, forward) > 0);
            expect(readings[1], `a gap at col ${gapCol}`).toBe(readings[0]);
            if (readings[0])
                ++numGapsRead;

            for (const row of GAP_ROWS)
                VoxelUpdateUtil.addVoxelBlock(undefined, room.voxelGrid.voxels, blockAt(row, gapCol));
        }
        // (A gap is there to be read at all.)
        expect(numGapsRead).toBeGreaterThan(0);
    });
});
