/**
 * Scenario tests: multiplayer room generation
 *
 * Every Hub/Regular room the server creates is born from RoomGenerationUtil, so what it builds is
 * the definition of a complete room. A Regular room is laid out procedurally from a seed, which
 * makes its shape unknowable in advance — so what is asserted about it is the set of properties it
 * has to have no matter which seed produced it.
 *
 * What every generated multiplayer room owes, whichever kind it is:
 *
 * - the whole room is walkable from where a player arrives (no region is ever sealed off)
 * - the wall the room's door hangs on is left standing, and the floor in front of it left clear
 * - the boundary wall is intact the whole way round, and through the room's full height
 * - nothing it is built out of hangs in mid-air
 * - it is generated with its own way in and nothing else, for the people who use it to furnish
 * - it is built in one of the texture packs its textures were picked against
 * - a seed reproduces its room exactly
 *
 * On top of that: a Regular room is a procedural layout, in one texture, that differs from seed to
 * seed; and a Hub is currently two empty storeys (see the suspended block at the foot of this file).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import RoomGenerationUtil from "../../../src/shared/room/generation/util/roomGenerationUtil";
import RoomPaletteMap from "../../../src/shared/room/generation/maps/roomPaletteMap";
import Room from "../../../src/shared/room/types/room";
import RoomRuntimeMemory from "../../../src/shared/room/types/roomRuntimeMemory";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import PhysicsManager from "../../../src/shared/physics/physicsManager";
import PhysicsColliderStateUtil from "../../../src/shared/physics/util/physicsColliderStateUtil";
import Vec3 from "../../../src/shared/math/types/vec3";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import EncodingUtil from "../../../src/shared/networking/util/encodingUtil";
import DoorObjectUtil from "../../../src/shared/object/util/doorObjectUtil";
import { DoorTypeEnumMap } from "../../../src/shared/object/types/doorType";
import {
    COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, GRAVITY_SPEED,
    INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW,
    NUM_COLLISION_LAYERS_PER_STOREY, NUM_VOXEL_COLS, NUM_VOXEL_ROWS, PLAYER_HEIGHT,
    STOREY_FLOOR_COLLISION_LAYER,
} from "../../../src/shared/system/sharedConstants";

// A handful of unrelated seeds, so that a property asserted below is not one that happens to
// hold for a single layout.
const SEEDS = [1, 2, 3, 91, 4242, 104729, 999983, 1234567];

// The collision layers a standing player occupies. A cell is walkable when all of them are free.
const PLAYER_LAYER_MASK = 0b00011111;

function isWalkable(voxelGrid: VoxelGrid, row: number, col: number): boolean
{
    const voxel = VoxelQueryUtil.getVoxel(voxelGrid.voxels, row, col);
    return !!voxel && (voxel.collisionLayerMask & PLAYER_LAYER_MASK) == 0;
}

const DOOR_OBJECT_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Door");

// Where an arriving player stands. The entrance cell itself is boundary wall — that is what the
// room's door hangs on — so the room is walked from the cell in front of it, which is the first
// floor a player ever has under him (see SpawnHotspotUtil).
const ARRIVAL_ROW = INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW - 1;
const ARRIVAL_COL = INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL;

/** Every cell reachable on foot from where a player arrives. */
function floodFillFromEntrance(voxelGrid: VoxelGrid): Set<number>
{
    const reached = new Set<number>();
    const pending = [ARRIVAL_ROW * NUM_VOXEL_COLS + ARRIVAL_COL];
    while (pending.length > 0)
    {
        const index = pending.pop()!;
        if (reached.has(index))
            continue;
        reached.add(index);

        const row = Math.floor(index / NUM_VOXEL_COLS);
        const col = index % NUM_VOXEL_COLS;
        for (const [rowStep, colStep] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        {
            const nextRow = row + rowStep;
            const nextCol = col + colStep;
            if (isWalkable(voxelGrid, nextRow, nextCol))
                pending.push(nextRow * NUM_VOXEL_COLS + nextCol);
        }
    }
    return reached;
}

/**
 * Every texture index the room is actually finished in. A quad byte carries its visibility in the
 * top bit and its texture index in the rest, and a hidden quad's index is whatever it last held —
 * so only the visible ones say anything about how the room looks.
 */
function texturesUsedIn(voxelGrid: VoxelGrid): Set<number>
{
    const used = new Set<number>();
    const quads = voxelGrid.quadsMem.quads;
    for (let i = 0; i < quads.length; ++i)
    {
        if ((quads[i] & 0b10000000) != 0)
            used.add(quads[i] & 0b01111111);
    }
    return used;
}

function countWalkableCells(voxelGrid: VoxelGrid): number
{
    let count = 0;
    for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
    {
        for (let col = 0; col < NUM_VOXEL_COLS; ++col)
        {
            if (isWalkable(voxelGrid, row, col))
                ++count;
        }
    }
    return count;
}

//----------------------------------------------------------------------------------------------
// Climbing the room
//
// A room's upper storey only exists in the sense that matters if a player can get up to it and walk
// around on it, which is a question about the whole room at once — the stairs, the storey floor,
// the doorways and the headroom all have to agree — rather than about any one part of it. So it is
// asked the way the player would: by walking, from the entrance, and seeing where he ends up.
//
// A position is where a player stands: a cell, plus the layer whose top surface is under his feet
// (with -1 standing for the room's own floor). Moving to a neighbouring cell, he steps up at most
// one layer — the physics engine lets him climb a little over one block's height and no more — and
// otherwise falls to whatever he lands on. Everywhere he can reach this way is the room he actually
// has.
//----------------------------------------------------------------------------------------------

// How tall the player stands, in layers, which is how much headroom a place to stand needs.
const PLAYER_HEIGHT_IN_LAYERS = Math.ceil(PLAYER_HEIGHT / COLLISION_LAYER_HEIGHT);

function layerIsSolid(voxelGrid: VoxelGrid, row: number, col: number, layer: number): boolean
{
    const voxel = VoxelQueryUtil.getVoxel(voxelGrid.voxels, row, col);
    if (!voxel)
        return true; // outside the room, which is as solid as anything gets
    return VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, layer);
}

/** Whether a player standing on top of the given layer of this cell fits, and has ground under him. */
function canStandOn(voxelGrid: VoxelGrid, row: number, col: number, supportLayer: number): boolean
{
    if (row < 0 || row >= NUM_VOXEL_ROWS || col < 0 || col >= NUM_VOXEL_COLS)
        return false;
    if (supportLayer >= COLLISION_LAYER_MIN && !layerIsSolid(voxelGrid, row, col, supportLayer))
        return false; // nothing under his feet
    for (let layer = supportLayer + 1; layer <= supportLayer + PLAYER_HEIGHT_IN_LAYERS; ++layer)
    {
        if (layerIsSolid(voxelGrid, row, col, layer))
            return false; // no room for him to stand up in
    }
    return true;
}

/**
 * Where a player stepping into this cell from the given height ends up: onto the highest thing he
 * can reach without climbing more than one layer, or down onto whatever is below that. Undefined if
 * there is nowhere in the cell he fits at all.
 */
function getSupportLayerAfterStep(voxelGrid: VoxelGrid, row: number, col: number,
    fromSupportLayer: number): number | undefined
{
    for (let layer = fromSupportLayer + 1; layer >= COLLISION_LAYER_MIN - 1; --layer)
    {
        if (canStandOn(voxelGrid, row, col, layer))
            return layer;
    }
    return undefined;
}

/**
 * Every place in the room a player can walk to from the entrance, storeys and all, together with
 * the step he arrived at each of them from — so that a route to any of them can be read back out.
 */
function walkFromEntrance(voxelGrid: VoxelGrid): Map<string, string | undefined>
{
    const start = getSupportLayerAfterStep(voxelGrid, ARRIVAL_ROW, ARRIVAL_COL,
        COLLISION_LAYER_MIN - 1);
    const cameFrom = new Map<string, string | undefined>();
    if (start == undefined)
        return cameFrom;

    // Breadth first, so that the route read back out of it is the shortest one there is — which is
    // what keeps the physics-driven walk below down to a manageable number of steps.
    const startKey = `${ARRIVAL_ROW},${ARRIVAL_COL},${start}`;
    cameFrom.set(startKey, undefined);
    const pending: string[] = [startKey];
    for (let head = 0; head < pending.length; ++head)
    {
        const key = pending[head];
        const [row, col, supportLayer] = key.split(",").map(Number);

        for (const [rowStep, colStep] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        {
            const nextRow = row + rowStep;
            const nextCol = col + colStep;
            const nextSupportLayer = getSupportLayerAfterStep(voxelGrid, nextRow, nextCol, supportLayer);
            if (nextSupportLayer == undefined)
                continue;
            const nextKey = `${nextRow},${nextCol},${nextSupportLayer}`;
            if (cameFrom.has(nextKey))
                continue;
            cameFrom.set(nextKey, key);
            pending.push(nextKey);
        }
    }
    return cameFrom;
}

/** The route from the entrance to the first place the walk found above the storey floor. */
function getRouteToUpperStorey(voxelGrid: VoxelGrid): {row: number, col: number, supportLayer: number}[]
{
    const cameFrom = walkFromEntrance(voxelGrid);
    let destination: string | undefined;
    for (const key of cameFrom.keys())
    {
        if (Number(key.split(",")[2]) >= STOREY_FLOOR_COLLISION_LAYER)
        {
            destination = key;
            break;
        }
    }

    const route: {row: number, col: number, supportLayer: number}[] = [];
    for (let key = destination; key != undefined; key = cameFrom.get(key))
    {
        const [row, col, supportLayer] = key.split(",").map(Number);
        route.unshift({row, col, supportLayer});
    }
    return route;
}

/**
 * The treads of every flight of steps along the route: the cells belonging to a run that climbs a
 * layer at a time, more than once over. One step up on its own is a piece of block work the walk
 * happened to go over rather than a flight, and is left out.
 */
function getFlightTreads(route: {row: number, col: number, supportLayer: number}[]):
    {row: number, col: number, supportLayer: number}[]
{
    const treads: {row: number, col: number, supportLayer: number}[] = [];
    let runStart = 0;
    for (let i = 1; i <= route.length; ++i)
    {
        const climbs = i < route.length &&
            route[i].supportLayer == route[i - 1].supportLayer + 1;
        if (climbs)
            continue;
        // The run ran from runStart to i-1. Two rises or more make it a flight, and every cell of
        // it above the room's own floor is one of its treads.
        if (i - 1 - runStart >= 2)
        {
            for (let j = runStart; j < i; ++j)
            {
                if (route[j].supportLayer >= COLLISION_LAYER_MIN)
                    treads.push(route[j]);
            }
        }
        runStart = i;
    }
    return treads;
}

function countReachedOnUpperStorey(reached: Map<string, string | undefined>): number
{
    let count = 0;
    for (const key of reached.keys())
    {
        if (Number(key.split(",")[2]) >= STOREY_FLOOR_COLLISION_LAYER)
            ++count;
    }
    return count;
}

/**
 * Walks a real player object along a route through the real physics engine, the way the client's
 * Rigidbody does it every frame, and answers where he ended up.
 *
 * This is what turns the walk above from a claim about the grid into a claim about the game: the
 * grid walk knows only that a step of one layer ought to be climbable, while this finds out whether
 * the engine — with the player's own hitbox, its own step-up rule and its own gravity — actually
 * carries him up the stairs the generator built.
 */
function walkRouteWithPhysics(room: Room, route: {row: number, col: number}[]): Vec3
{
    const objectId = "walker";
    const playerTypeIndex = ObjectTypeConfigMap.getIndexByType("Player");
    const dir: Vec3 = {x: 0, y: 0, z: 1};

    if (PhysicsManager.hasRoom(room.id))
        PhysicsManager.unload(room.id);
    PhysicsManager.load(new RoomRuntimeMemory(room, {}));

    let pos: Vec3 = {x: route[0].col + 0.5, y: 0.5 * PLAYER_HEIGHT, z: route[0].row + 0.5};
    PhysicsManager.addObject(room.id, objectId, playerTypeIndex,
        PhysicsColliderStateUtil.getObjectColliderState(playerTypeIndex, pos, dir)!);

    const deltaTime = 1 / 60;
    const walkSpeed = 3;
    for (let i = 1; i < route.length; ++i)
    {
        const targetX = route[i].col + 0.5;
        const targetZ = route[i].row + 0.5;

        // Long enough for a step that has to be climbed, which costs the walker a few frames of
        // pressing into the riser before the engine lifts him over it.
        for (let frame = 0; frame < 40; ++frame)
        {
            const toTargetX = targetX - pos.x;
            const toTargetZ = targetZ - pos.z;
            const dist = Math.hypot(toTargetX, toTargetZ);
            if (dist < 0.05)
                break;

            const desired: Vec3 = {
                x: walkSpeed * toTargetX / dist,
                y: -GRAVITY_SPEED,
                z: walkSpeed * toTargetZ / dist,
            };
            const adjusted = PhysicsManager.getAdjustedVelocity(room.id, objectId, desired);
            const target: Vec3 = {
                x: pos.x + adjusted.x * deltaTime,
                y: pos.y + adjusted.y * deltaTime,
                z: pos.z + adjusted.z * deltaTime,
            };
            pos = PhysicsManager.setObjectTransform(room.id, objectId, target, dir, false).transform.pos;
        }
    }
    PhysicsManager.unload(room.id);
    return pos;
}

//----------------------------------------------------------------------------------------------
// What holds the room up
//
// Nothing a generator builds may hang in mid-air. A block is held up if it rests on the room's own
// floor, if the block directly under it is held up, or if a block beside it at the same height is —
// that last one being what carries a storey floor, a slab that hangs between the walls it meets at
// its edges rather than standing on anything. Whatever is left over after that has spread as far as
// it can is floating.
//----------------------------------------------------------------------------------------------

function getBlockKey(row: number, col: number, layer: number): string
{
    return `${row},${col},${layer}`;
}

function findFloatingBlocks(voxelGrid: VoxelGrid): string[]
{
    const held = new Set<string>();
    const pending: [number, number, number][] = [];

    const hold = (row: number, col: number, layer: number) => {
        if (layer < COLLISION_LAYER_MIN || layer > COLLISION_LAYER_MAX)
            return;
        if (row < 0 || row >= NUM_VOXEL_ROWS || col < 0 || col >= NUM_VOXEL_COLS)
            return;
        const key = getBlockKey(row, col, layer);
        if (held.has(key) || !layerIsSolid(voxelGrid, row, col, layer))
            return;
        held.add(key);
        pending.push([row, col, layer]);
    };

    // Everything resting on the room's own floor holds itself up.
    for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
    {
        for (let col = 0; col < NUM_VOXEL_COLS; ++col)
            hold(row, col, COLLISION_LAYER_MIN);
    }
    while (pending.length > 0)
    {
        const [row, col, layer] = pending.pop()!;
        hold(row, col, layer + 1); // stacked on top of something held up
        for (const [rowStep, colStep] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
            hold(row + rowStep, col + colStep, layer); // hanging off the side of something held up
    }

    const floating: string[] = [];
    for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
    {
        for (let col = 0; col < NUM_VOXEL_COLS; ++col)
        {
            for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
            {
                if (layerIsSolid(voxelGrid, row, col, layer) && !held.has(getBlockKey(row, col, layer)))
                    floating.push(getBlockKey(row, col, layer));
            }
        }
    }
    return floating;
}

/**
 * Cells standing open from the room's floor right up past the storey above, i.e. the tall spaces in
 * it. The topmost layer is not asked about: a room is capped there whatever else it does, so that
 * both of its storeys come out the same height as each other.
 */
function countCellsOpenThroughBothStoreys(voxelGrid: VoxelGrid): number
{
    let count = 0;
    for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
    {
        for (let col = 0; col < NUM_VOXEL_COLS; ++col)
        {
            let open = true;
            for (let layer = COLLISION_LAYER_MIN; layer < COLLISION_LAYER_MAX && open; ++layer)
                open = !layerIsSolid(voxelGrid, row, col, layer);
            if (open)
                ++count;
        }
    }
    return count;
}

function encodeVoxelGrid(voxelGrid: VoxelGrid): string
{
    const bufferState = EncodingUtil.startEncoding();
    voxelGrid.encode(bufferState);
    return new Uint8Array(EncodingUtil.endEncoding(bufferState)).join(",");
}

// The kinds of room RoomGenerationUtil lays out for itself. A single-player room is not one of
// them: it is built from the SinglePlayerModeConfig it is named after rather than drawn.
const MULTIPLAYER_ROOM_TYPES = [
    {name: "hub", roomType: RoomTypeEnumMap.Hub},
    {name: "regular", roomType: RoomTypeEnumMap.Regular},
];

/** A room generated from one specific seed, so that a property can be asserted over many of them. */
function generateFromSeed(seed: number, roomType: number = RoomTypeEnumMap.Hub): Room
{
    const room = RoomGenerationUtil.generateRoom("", roomType, "", "", seed);
    room.id = `generated-${roomType}-${seed}`; // the physics engine keys its worlds by room id
    return room;
}

/**
 * How much block work stands inside the boundary wall between the two heights, counting a cell once
 * for every layer of it that is solid. A stretch that is entirely hollow counts nothing; one that is
 * solid throughout counts every interior cell at every layer of it.
 */
function countInteriorBlocks(voxelGrid: VoxelGrid, layerMin: number, layerMax: number): number
{
    let count = 0;
    for (let row = 1; row < NUM_VOXEL_ROWS - 1; ++row)
    {
        for (let col = 1; col < NUM_VOXEL_COLS - 1; ++col)
        {
            for (let layer = layerMin; layer <= layerMax; ++layer)
            {
                if (layerIsSolid(voxelGrid, row, col, layer))
                    ++count;
            }
        }
    }
    return count;
}

const NUM_INTERIOR_CELLS = (NUM_VOXEL_ROWS - 2) * (NUM_VOXEL_COLS - 2);

describe("every generated multiplayer room", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("leaves every part of the room reachable on foot from the entrance", () => {
        for (const {name, roomType} of MULTIPLAYER_ROOM_TYPES)
        {
            for (const seed of SEEDS)
            {
                const {voxelGrid} = generateFromSeed(seed, roomType);
                const reachable = floodFillFromEntrance(voxelGrid);
                const walkable = countWalkableCells(voxelGrid);

                expect(walkable, `${name} seed ${seed}`).toBeGreaterThan(0);
                expect(reachable.size,
                    `${name} seed ${seed} :: some of the room is walled off`).toBe(walkable);
            }
        }
    });

    it("leaves the wall the door hangs on standing, and the floor in front of it clear", () => {
        for (const {name, roomType} of MULTIPLAYER_ROOM_TYPES)
        {
            for (const seed of SEEDS)
            {
                const {voxelGrid} = generateFromSeed(seed, roomType);

                // The entrance cell is wall, not a hole: the room's door is hung on it, and a wall
                // attachment with nothing behind it is refused (see WallAttachedObjectUtil).
                expect(isWalkable(voxelGrid, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL),
                    `${name} seed ${seed} :: the wall the door hangs on was carved away`).toBe(false);

                // The approach a player walks in along, which nothing generated may stand in.
                for (let row = INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW - 2; row < INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW; ++row)
                {
                    for (let col = INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL - 1; col <= INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL + 1; ++col)
                    {
                        expect(isWalkable(voxelGrid, row, col),
                            `${name} seed ${seed} :: (${row},${col}) is blocked`).toBe(true);
                    }
                }
            }
        }
    });

    it("keeps the boundary wall solid the whole way round", () => {
        for (const {name, roomType} of MULTIPLAYER_ROOM_TYPES)
        {
            for (const seed of SEEDS)
            {
                const {voxelGrid} = generateFromSeed(seed, roomType);

                for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
                {
                    for (let col = 0; col < NUM_VOXEL_COLS; ++col)
                    {
                        // Including the entrance: the way in is a door hung on that wall rather
                        // than a hole cut through it, so nothing breaks the boundary any more.
                        const onBoundary = row == 0 || col == 0 ||
                            row == NUM_VOXEL_ROWS - 1 || col == NUM_VOXEL_COLS - 1;
                        if (!onBoundary)
                            continue;
                        expect(isWalkable(voxelGrid, row, col),
                            `${name} seed ${seed} :: (${row},${col}) is not solid`).toBe(false);
                    }
                }
            }
        }
    });

    it("leaves nothing standing in mid-air", () => {
        // Every block a generated room is built out of is held up by something: props stand on the
        // storey they furnish, and a storey a room was left without is one that nothing may be
        // stood on at all.
        for (const {name, roomType} of MULTIPLAYER_ROOM_TYPES)
        {
            for (const seed of SEEDS)
            {
                const {voxelGrid} = generateFromSeed(seed, roomType);
                const floating = findFloatingBlocks(voxelGrid);
                expect(floating,
                    `${name} seed ${seed} :: ${floating.length} block(s) hang in mid-air`).toEqual([]);
            }
        }
    });

    it("keeps the upper storey inside the room", () => {
        // The boundary wall has to stand through the room's whole height, not just the part of it
        // the ground floor occupies — otherwise reaching the storey above is a way out of the room.
        for (const {name, roomType} of MULTIPLAYER_ROOM_TYPES)
        {
            for (const seed of SEEDS)
            {
                const {voxelGrid} = generateFromSeed(seed, roomType);
                for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
                {
                    for (let col = 0; col < NUM_VOXEL_COLS; ++col)
                    {
                        const onBoundary = row == 0 || col == 0 ||
                            row == NUM_VOXEL_ROWS - 1 || col == NUM_VOXEL_COLS - 1;
                        if (!onBoundary)
                            continue;
                        for (let layer = STOREY_FLOOR_COLLISION_LAYER; layer <= COLLISION_LAYER_MAX; ++layer)
                        {
                            expect(layerIsSolid(voxelGrid, row, col, layer),
                                `${name} seed ${seed} :: the boundary at (${row},${col}) is open at layer ${layer}`)
                                .toBe(true);
                        }
                    }
                }
            }
        }
    });

    it("furnishes a multiplayer room with its own way in and nothing else", () => {
        // A Hub or Regular room is meant to be furnished by the people who use it, so what it owes
        // them is somewhere to build rather than a full house — an object generation placed is one
        // somebody has to clear away before he can put his own there.
        //
        // Its door is the one exception, and is not really furniture: a room with no door is a room
        // nobody can leave, and it is what an arriving player is put down behind besides. It stands
        // on the boundary wall at the room's entrance cell, facing into the room, and offers itself
        // as the way in.
        for (const {name, roomType} of MULTIPLAYER_ROOM_TYPES)
        {
            for (const seed of SEEDS)
            {
                const objects = Object.values(generateFromSeed(seed, roomType).objectById);
                expect(objects.length, `${name} seed ${seed}`).toBe(1);

                const [door] = objects;
                expect(door.objectTypeIndex, `${name} seed ${seed}`).toBe(DOOR_OBJECT_TYPE_INDEX);
                expect(DoorObjectUtil.getDoorType(door), `${name} seed ${seed}`)
                    .toBe(DoorTypeEnumMap.DefaultEntrance);
                expect(door.transform.pos.x, `${name} seed ${seed}`)
                    .toBeCloseTo(INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL + 0.5, 3);
                expect(door.transform.pos.z, `${name} seed ${seed}`)
                    .toBeCloseTo(INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW, 3);
                expect(door.transform.dir.z, `${name} seed ${seed}`).toBeCloseTo(-1, 3);
            }
        }
    });

    it("builds the room in a texture pack whose palettes it drew from", () => {
        // A room's textures are cell positions within one specific pack's atlas, so a room that
        // came out in a pack nothing was picked against would be finished at random.
        for (const {name, roomType} of MULTIPLAYER_ROOM_TYPES)
        {
            for (const seed of SEEDS)
            {
                const room = generateFromSeed(seed, roomType);
                expect(RoomPaletteMap.getPalettes(room.texturePackPath).length,
                    `${name} seed ${seed} :: generated in "${room.texturePackPath}", which has no palettes`)
                    .toBeGreaterThan(0);
            }
        }

        // A hub may be finished in any pack the game ships, and the one it wears is genuinely drawn
        // rather than every hub landing on the same one. (A regular room is deliberately always the
        // one plain pack — see the regular-room block below.)
        const packsUsed = new Set(SEEDS.map(seed => generateFromSeed(seed).texturePackPath));
        expect(packsUsed.size).toBeGreaterThan(1);
    });

    it("keeps every palette within the reach of a texture pack atlas", () => {
        // The voxel texture pack atlas is a square grid of cells, and a quad's texture is an index
        // into it — so a palette naming a cell past the end of the grid renders as nothing.
        const NUM_TEXTURES_PER_PACK = 64;
        for (const texturePackPath of RoomPaletteMap.getTexturePackPaths())
        {
            const palettes = RoomPaletteMap.getPalettes(texturePackPath);
            expect(palettes.length, texturePackPath).toBeGreaterThan(0);
            for (const palette of palettes)
            {
                for (const textureIndex of Object.values(palette))
                {
                    expect(textureIndex, `${texturePackPath} :: texture ${textureIndex}`)
                        .toBeGreaterThanOrEqual(0);
                    expect(textureIndex, `${texturePackPath} :: texture ${textureIndex}`)
                        .toBeLessThan(NUM_TEXTURES_PER_PACK);
                }
            }
        }
    });

    it("rebuilds the same room from the same seed", () => {
        for (const {name, roomType} of MULTIPLAYER_ROOM_TYPES)
        {
            const first = generateFromSeed(SEEDS[0], roomType);
            const again = generateFromSeed(SEEDS[0], roomType);

            expect(encodeVoxelGrid(again.voxelGrid), name).toBe(encodeVoxelGrid(first.voxelGrid));
            expect(again.texturePackPath, name).toBe(first.texturePackPath);
        }
    });

    it("is what the room generator builds Hub and Regular rooms with", () => {
        for (const {name, roomType} of MULTIPLAYER_ROOM_TYPES)
        {
            const room = RoomGenerationUtil.generateRoom("", roomType);

            // A room that came out of nothing but the base grid would be solid throughout.
            expect(countWalkableCells(room.voxelGrid), name).toBeGreaterThan(0);
            expect(floodFillFromEntrance(room.voxelGrid).size, name)
                .toBe(countWalkableCells(room.voxelGrid));

            // The room carries the texture pack its contents were picked against, so that the
            // room it is saved as looks like the room that was generated.
            expect(RoomPaletteMap.getPalettes(room.texturePackPath).length, name).toBeGreaterThan(0);
        }
    });
});

describe("a regular room's procedural layout", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("carves rooms out of the solid mass rather than hollowing the whole storey", () => {
        // A regular room starts as one solid chunk with a few small areas taken out of it, the rest
        // being left for its owner to mine out block by block. So a room that came out with its
        // whole interior open would be one the carving never ran on.
        for (const seed of SEEDS)
        {
            const {voxelGrid} = generateFromSeed(seed, RoomTypeEnumMap.Regular);
            const walkable = countWalkableCells(voxelGrid);
            expect(walkable, `seed ${seed}`).toBeGreaterThan(0);
            expect(walkable, `seed ${seed} :: the whole storey was hollowed out`)
                .toBeLessThan(NUM_INTERIOR_CELLS);
        }
    });

    it("is one storey, with the mass above it left standing", () => {
        // It is a cosy home rather than a lobby: the storey floor and everything over it stay
        // solid, which is also what a room mined upwards from starts as.
        for (const seed of SEEDS)
        {
            const {voxelGrid} = generateFromSeed(seed, RoomTypeEnumMap.Regular);
            const above = countInteriorBlocks(voxelGrid,
                STOREY_FLOOR_COLLISION_LAYER, COLLISION_LAYER_MAX);
            const layersAbove = COLLISION_LAYER_MAX - STOREY_FLOOR_COLLISION_LAYER + 1;
            expect(above, `seed ${seed}`).toBe(NUM_INTERIOR_CELLS * layersAbove);
        }
    });

    it("is handed over plain, in one texture throughout", () => {
        // A regular room belongs to one person, and is a blank room for its owner to decorate
        // himself. How much decoration it comes out wearing is settled entirely by the texture
        // packs and palettes its room type is offered — so this is a test that generation reads
        // those parameters at all, rather than finishing every room alike.
        for (const seed of SEEDS)
        {
            const regular = generateFromSeed(seed, RoomTypeEnumMap.Regular);
            expect(texturesUsedIn(regular.voxelGrid).size, `seed ${seed}`).toBe(1);
        }
    });

    it("draws a different room from a different seed", () => {
        const first = generateFromSeed(SEEDS[0], RoomTypeEnumMap.Regular);
        const other = generateFromSeed(SEEDS[1], RoomTypeEnumMap.Regular);
        expect(encodeVoxelGrid(other.voxelGrid)).not.toBe(encodeVoxelGrid(first.voxelGrid));
    });
});

describe("a hub room", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    // Procedural generation is currently switched off for hubs — see the note in HubRoomBuilder —
    // and a hub is built as two empty storeys instead. These describe that shape, so that the
    // temporary arrangement is asserted rather than merely not contradicted.

    it("stands open through both storeys, from wall to wall", () => {
        // Nothing at all is left inside either storey: no interior walls, no block work, no props.
        for (const seed of SEEDS)
        {
            const {voxelGrid} = generateFromSeed(seed);

            expect(countInteriorBlocks(voxelGrid, COLLISION_LAYER_MIN,
                COLLISION_LAYER_MIN + NUM_COLLISION_LAYERS_PER_STOREY - 1),
                `seed ${seed} :: something is standing on the ground floor`).toBe(0);
            expect(countInteriorBlocks(voxelGrid, STOREY_FLOOR_COLLISION_LAYER + 1,
                STOREY_FLOOR_COLLISION_LAYER + NUM_COLLISION_LAYERS_PER_STOREY),
                `seed ${seed} :: something is standing on the upper storey`).toBe(0);
        }
    });

    it("is two storeys of the same height, rather than one tall room", () => {
        // The slab between them is what makes the upper storey a floor at all, and the cap over the
        // upper one is what stops it being the taller of the two. Between them they are the only
        // things left standing inside a hub.
        for (const seed of SEEDS)
        {
            const {voxelGrid} = generateFromSeed(seed);

            expect(countInteriorBlocks(voxelGrid,
                STOREY_FLOOR_COLLISION_LAYER, STOREY_FLOOR_COLLISION_LAYER),
                `seed ${seed} :: the storey floor has holes in it`).toBe(NUM_INTERIOR_CELLS);
            expect(countInteriorBlocks(voxelGrid, COLLISION_LAYER_MAX, COLLISION_LAYER_MAX),
                `seed ${seed} :: the upper storey is not capped`).toBe(NUM_INTERIOR_CELLS);
            expect(countCellsOpenThroughBothStoreys(voxelGrid),
                `seed ${seed} :: a cell is open from the floor to the ceiling`).toBe(0);
        }
    });

    it("comes out in one texture, whichever pack it drew", () => {
        // Nothing is picked from the hub's palettes while its rooms are not being drawn, so what
        // its faces carry is the one plain texture of whichever pack it landed on.
        for (const seed of SEEDS)
        {
            expect(texturesUsedIn(generateFromSeed(seed).voxelGrid).size, `seed ${seed}`).toBe(1);
        }
    });
});

//----------------------------------------------------------------------------------------------
// Suspended: what a procedurally generated hub owes
//
// A hub used to be the one room type generation gave two storeys, a flight of steps between them,
// and block work standing about in it. That is switched off for the moment — HubRoomBuilder builds
// two empty storeys and keeps the procedural pipeline commented out beside them — so none of these
// properties hold of anything the generator currently produces.
//
// They are kept here rather than deleted because the switch is meant to be flipped back, and
// because they are the only thing asserting the parts of ProceduralRoomBuilder that nothing else
// calls any more: allocateStaircaseCapableAreas, raiseSecondStoreys, and the staircase planner
// behind them. Un-skip this block in the same change that restores HubRoomBuilder's pipeline.
//----------------------------------------------------------------------------------------------
describe.skip("a procedurally generated hub", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("gives every room an upper storey a player can climb to and walk around on", () => {
        for (const seed of SEEDS)
        {
            const {voxelGrid} = generateFromSeed(seed);
            const reached = walkFromEntrance(voxelGrid);
            const upstairs = countReachedOnUpperStorey(reached);

            // A storey nobody can get to is half a room nobody has. This walks up whatever stairs
            // the seed produced, so it is the stairs themselves being asserted here as much as the
            // floor they lead to: a flight with a step too tall to climb strands the player on it.
            expect(upstairs, `seed ${seed} :: the upper storey cannot be reached on foot`)
                .toBeGreaterThan(0);

            // And it is a storey rather than a ledge: enough of it to walk around on.
            expect(upstairs, `seed ${seed} :: the upper storey is barely there`).toBeGreaterThan(30);
        }
    });

    it("builds stairs the physics engine actually carries a player up", () => {
        for (const seed of SEEDS)
        {
            const room = generateFromSeed(seed);
            const route = getRouteToUpperStorey(room.voxelGrid);
            expect(route.length, `seed ${seed} :: no route upstairs`).toBeGreaterThan(1);

            const end = walkRouteWithPhysics(room, route);

            // Where his feet ended up. The storey floor's top surface is what he had to reach.
            const feetY = end.y - 0.5 * PLAYER_HEIGHT;
            const storeyFloorTopY = (STOREY_FLOOR_COLLISION_LAYER + 1) * COLLISION_LAYER_HEIGHT;
            expect(feetY, `seed ${seed} :: the walk up the stairs stalled at y=${feetY.toFixed(2)}`)
                .toBeGreaterThanOrEqual(storeyFloorTopY - 0.01);
        }
    });

    it("climbs to the upper storey by a flight wide enough to walk up", () => {
        // A flight one cell across is a ledge the player has to line himself up on before every
        // stride, and slips off the side of whenever he does not. So every tread of the flight has
        // to have a second cell beside it at exactly the same height — the other half of the same
        // tread — that he could equally well have been walking on.
        //
        // What counts as a flight is a run of the route that climbs a layer at a time, more than
        // once over. A single step up on its own is not one: a generated room has waist-high block
        // work standing about in it, and stepping onto a piece of furniture and down off it again
        // is not something that has to be walkable two abreast.
        for (const seed of SEEDS)
        {
            const {voxelGrid} = generateFromSeed(seed);
            const route = getRouteToUpperStorey(voxelGrid);
            expect(route.length, `seed ${seed} :: no route upstairs`).toBeGreaterThan(1);

            for (const tread of getFlightTreads(route))
            {
                const abreast = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([rowStep, colStep]) =>
                    canStandOn(voxelGrid, tread.row + rowStep, tread.col + colStep, tread.supportLayer));
                expect(abreast,
                    `seed ${seed} :: (${tread.row},${tread.col}) at layer ${tread.supportLayer} is a single-cell stride`)
                    .toBe(true);
            }
        }
    });

    it("opens some of its rooms through both storeys, and floors over the rest", () => {
        // A room that is uniformly two storeys of the same height reads as a filing cabinet. Some
        // of its spaces are deliberately left open from the floor to the ceiling instead — which is
        // a property of the whole run of seeds rather than of any one of them, since whether a
        // given room gets one is the seed's to decide.
        let numRoomsWithTallSpace = 0;
        for (const seed of SEEDS)
        {
            const {voxelGrid} = generateFromSeed(seed);

            // Whichever it does, the storey floor is never left in a state where a player walking
            // the upper storey finds nothing under him: it either carries him or is not there at all.
            expect(countReachedOnUpperStorey(walkFromEntrance(voxelGrid)),
                `seed ${seed}`).toBeGreaterThan(0);

            if (countCellsOpenThroughBothStoreys(voxelGrid) > 0)
                ++numRoomsWithTallSpace;
        }
        expect(numRoomsWithTallSpace,
            "no generated room came out with a space open through both storeys").toBeGreaterThan(0);
    });

    it("decorates the room it hands to everybody", () => {
        // A hub is the room the game hands to everybody and is worth decorating, so its spaces are
        // finished in the several palettes hand-picked for whichever pack it drew — as much
        // decoration as its RoomPaletteSelectionParams offers it, and no more.
        for (const seed of SEEDS)
        {
            expect(texturesUsedIn(generateFromSeed(seed).voxelGrid).size,
                `seed ${seed}`).toBeGreaterThan(1);
        }
    });

    it("stands interior walls in the room, rather than hollowing the whole storey", () => {
        for (const seed of SEEDS)
        {
            const {voxelGrid} = generateFromSeed(seed);
            expect(countWalkableCells(voxelGrid), `seed ${seed}`).toBeLessThan(NUM_INTERIOR_CELLS);
        }
    });

    it("draws a different room from a different seed", () => {
        const first = generateFromSeed(SEEDS[0]);
        const other = generateFromSeed(SEEDS[1]);
        expect(encodeVoxelGrid(other.voxelGrid)).not.toBe(encodeVoxelGrid(first.voxelGrid));
    });
});
