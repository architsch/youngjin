/**
 * Scenario tests: procedural multiplayer room generation
 *
 * Every Hub/Regular room the server creates is laid out procedurally from a seed. That makes the
 * room's shape unknowable in advance, so what is asserted here is the set of properties every
 * generated room has to have no matter which seed produced it:
 *
 * - the whole room is walkable from where a player arrives (no region is ever sealed off)
 * - the wall the room's door hangs on is left standing, and the floor in front of it left clear
 * - the boundary wall is intact the whole way round
 * - the upper storey is real, and can be climbed to on foot from the entrance
 * - the stairs up to it are wide enough to walk rather than balance along
 * - nothing it is built out of hangs in mid-air
 * - it is generated with its own way in and nothing else, for the people who use it to furnish
 * - it is built in one of the texture packs its textures were picked against
 * - it is finished with as much decoration as its room type is offered, and no more
 * - a seed reproduces its room exactly, and different seeds give different rooms
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
    MULTI_PLAYER_ENTRANCE_VOXEL_COL, MULTI_PLAYER_ENTRANCE_VOXEL_ROW,
    NUM_VOXEL_COLS, NUM_VOXEL_ROWS, PLAYER_HEIGHT, STOREY_FLOOR_COLLISION_LAYER,
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
const ARRIVAL_ROW = MULTI_PLAYER_ENTRANCE_VOXEL_ROW - 1;
const ARRIVAL_COL = MULTI_PLAYER_ENTRANCE_VOXEL_COL;

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

// The lowest layer that is above the storey floor, i.e. the first one a player who has climbed the
// stairs is standing among.
const UPPER_STOREY_LAYER_MIN = STOREY_FLOOR_COLLISION_LAYER + 1;

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

/** A room generated from one specific seed, so that a property can be asserted over many of them. */
function generateFromSeed(seed: number): Room
{
    const room = RoomGenerationUtil.generateRoom("", RoomTypeEnumMap.Hub, "", "", seed);
    room.id = `generated-${seed}`; // the physics engine keys its worlds by room id
    return room;
}

describe("procedural multiplayer room generation", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("leaves every part of the room reachable on foot from the entrance", () => {
        for (const seed of SEEDS)
        {
            const {voxelGrid} = generateFromSeed(seed);
            const reachable = floodFillFromEntrance(voxelGrid);
            const walkable = countWalkableCells(voxelGrid);

            expect(walkable, `seed ${seed}`).toBeGreaterThan(0);
            expect(reachable.size, `seed ${seed} :: some of the room is walled off`).toBe(walkable);
        }
    });

    it("leaves the wall the door hangs on standing, and the floor in front of it clear", () => {
        for (const seed of SEEDS)
        {
            const {voxelGrid} = generateFromSeed(seed);

            // The entrance cell is wall, not a hole: the room's door is hung on it, and a wall
            // attachment with nothing behind it is refused (see WallAttachedObjectUtil).
            expect(isWalkable(voxelGrid, MULTI_PLAYER_ENTRANCE_VOXEL_ROW, MULTI_PLAYER_ENTRANCE_VOXEL_COL),
                `seed ${seed} :: the wall the door hangs on was carved away`).toBe(false);

            // The approach a player walks in along, which nothing generated may stand in.
            for (let row = MULTI_PLAYER_ENTRANCE_VOXEL_ROW - 2; row < MULTI_PLAYER_ENTRANCE_VOXEL_ROW; ++row)
            {
                for (let col = MULTI_PLAYER_ENTRANCE_VOXEL_COL - 1; col <= MULTI_PLAYER_ENTRANCE_VOXEL_COL + 1; ++col)
                {
                    expect(isWalkable(voxelGrid, row, col), `seed ${seed} :: (${row},${col}) is blocked`).toBe(true);
                }
            }
        }
    });

    it("keeps the boundary wall solid the whole way round", () => {
        for (const seed of SEEDS)
        {
            const {voxelGrid} = generateFromSeed(seed);

            for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
            {
                for (let col = 0; col < NUM_VOXEL_COLS; ++col)
                {
                    // Including the entrance: the way in is a door hung on that wall rather than a
                    // hole cut through it, so nothing breaks the boundary any more.
                    const onBoundary = row == 0 || col == 0 ||
                        row == NUM_VOXEL_ROWS - 1 || col == NUM_VOXEL_COLS - 1;
                    if (!onBoundary)
                        continue;
                    expect(isWalkable(voxelGrid, row, col), `seed ${seed} :: (${row},${col}) is not solid`).toBe(false);
                }
            }
        }
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

    it("leaves nothing standing in mid-air", () => {
        // Every block a generated room is built out of is held up by something: props stand on the
        // storey they furnish, and a storey a room was left without is one that nothing may be
        // stood on at all.
        for (const seed of SEEDS)
        {
            const {voxelGrid} = generateFromSeed(seed);
            const floating = findFloatingBlocks(voxelGrid);
            expect(floating,
                `seed ${seed} :: ${floating.length} block(s) hang in mid-air`).toEqual([]);
        }
    });

    it("keeps the upper storey inside the room", () => {
        // The boundary wall has to stand through the room's whole height, not just the part of it
        // the ground floor occupies — otherwise climbing the stairs is a way out of the room.
        for (const seed of SEEDS)
        {
            const {voxelGrid} = generateFromSeed(seed);
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
                            `seed ${seed} :: the boundary at (${row},${col}) is open at layer ${layer}`)
                            .toBe(true);
                    }
                }
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

    it("furnishes a multiplayer room with its own way in and nothing else", () => {
        // A Hub or Regular room is meant to be furnished by the people who use it, so what it owes
        // them is somewhere to build rather than a full house — an object generation placed is one
        // somebody has to clear away before he can put his own there.
        //
        // Its door is the one exception, and is not really furniture: a room with no door is a room
        // nobody can leave, and it is what an arriving player is put down behind besides. It stands
        // on the boundary wall at the room's entrance cell, facing into the room, and offers itself
        // as the way in.
        for (const seed of SEEDS)
        {
            const objects = Object.values(generateFromSeed(seed).objectById);
            expect(objects.length, `seed ${seed}`).toBe(1);

            const [door] = objects;
            expect(door.objectTypeIndex, `seed ${seed}`).toBe(DOOR_OBJECT_TYPE_INDEX);
            expect(DoorObjectUtil.getDoorType(door), `seed ${seed}`)
                .toBe(DoorTypeEnumMap.DefaultEntrance);
            expect(door.transform.pos.x, `seed ${seed}`)
                .toBeCloseTo(MULTI_PLAYER_ENTRANCE_VOXEL_COL + 0.5, 3);
            expect(door.transform.pos.z, `seed ${seed}`)
                .toBeCloseTo(MULTI_PLAYER_ENTRANCE_VOXEL_ROW, 3);
            expect(door.transform.dir.z, `seed ${seed}`).toBeCloseTo(-1, 3);
        }
    });

    it("builds the room in a texture pack whose palettes it drew from", () => {
        // A room's textures are cell positions within one specific pack's atlas, so a room that
        // came out in a pack nothing was picked against would be finished at random.
        const packsUsed = new Set<string>();
        for (const seed of SEEDS)
        {
            const room = generateFromSeed(seed);
            expect(RoomPaletteMap.getPalettes(room.texturePackPath).length,
                `seed ${seed} :: generated in "${room.texturePackPath}", which has no palettes`)
                .toBeGreaterThan(0);
            packsUsed.add(room.texturePackPath);
        }
        // ...and the pack is genuinely drawn, rather than every room landing on the same one.
        expect(packsUsed.size).toBeGreaterThan(1);
    });

    it("decorates a hub, and hands a regular room over plain", () => {
        // How much decoration a room comes out wearing is settled entirely by how many texture
        // packs and palettes its room type is offered to draw from — so this is a test that
        // generation reads those parameters at all, rather than finishing every room alike.
        // A hub is the room the game hands to everybody and is worth decorating; a regular room
        // belongs to one person, and is a blank room for its owner to decorate himself.
        for (const seed of SEEDS)
        {
            expect(texturesUsedIn(generateFromSeed(seed).voxelGrid).size,
                `seed ${seed} :: hub`).toBeGreaterThan(1);

            const regular = RoomGenerationUtil.generateRoom("", RoomTypeEnumMap.Regular, "", "", seed);
            expect(texturesUsedIn(regular.voxelGrid).size, `seed ${seed} :: regular`).toBe(1);
        }
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

    it("rebuilds the same room from the same seed, and a different one from a different seed", () => {
        const first = generateFromSeed(SEEDS[0]);
        const again = generateFromSeed(SEEDS[0]);
        const other = generateFromSeed(SEEDS[1]);

        expect(encodeVoxelGrid(again.voxelGrid)).toBe(encodeVoxelGrid(first.voxelGrid));
        expect(again.texturePackPath).toBe(first.texturePackPath);
        expect(encodeVoxelGrid(other.voxelGrid)).not.toBe(encodeVoxelGrid(first.voxelGrid));
    });

    it("is what the room generator builds Hub and Regular rooms with", () => {
        for (const roomType of [RoomTypeEnumMap.Hub, RoomTypeEnumMap.Regular])
        {
            const room = RoomGenerationUtil.generateRoom("", roomType);

            // A room that came out of nothing but the base grid would be solid throughout; one
            // that was merely hollowed out would have no interior walls standing in it at all.
            expect(countWalkableCells(room.voxelGrid)).toBeGreaterThan(0);
            expect(countWalkableCells(room.voxelGrid)).toBeLessThan((NUM_VOXEL_ROWS - 2) * (NUM_VOXEL_COLS - 2));
            expect(floodFillFromEntrance(room.voxelGrid).size).toBe(countWalkableCells(room.voxelGrid));

            // The room carries the texture pack its contents were picked against, so that the
            // room it is saved as looks like the room that was generated.
            expect(RoomPaletteMap.getPalettes(room.texturePackPath).length).toBeGreaterThan(0);
        }
    });
});
