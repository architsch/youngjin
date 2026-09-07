/**
 * Scenario tests: light propagation through the voxel-block grid
 *
 * A room's lamps are not THREE.PointLights — they are data flooded through the room's own voxel
 * blocks and handed to the shaders as a 3D texture (see LightBlockMap). What is tested here is the
 * flood itself, which is deliberately kept free of three.js so that it can be reasoned about without
 * a GPU: given a room's solid blocks and a list of lights, how much light stands in each block and
 * which way it arrived from.
 *
 * Covers:
 * - Occlusion: light stops at solid blocks, and a sealed room keeps its light in
 * - Falloff: the same windowed inverse-power curve three.js applies to a real point light
 * - Range: nothing past a light's own range is lit
 * - Directionality: the recorded arrival direction points the way the light actually travelled
 * - Accumulation: lights sum, and the result does not depend on the order they are supplied in
 */
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import fc from "fast-check";
import LightBlockPropagationUtil, { getDistanceAttenuation, LightPropagationScratch }
    from "../../../src/client/graphics/light/util/lightBlockPropagationUtil";
import LightSource from "../../../src/client/graphics/light/types/lightSource";
import LightBlockSmoothingUtil from "../../../src/client/graphics/light/util/lightBlockSmoothingUtil";
import LightBlockMap from "../../../src/client/graphics/light/maps/lightBlockMap";
import Voxel from "../../../src/shared/voxel/types/voxel";
import VoxelQuadsRuntimeMemory from "../../../src/shared/voxel/types/voxelQuadsRuntimeMemory";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import { COLLISION_LAYER_HEIGHT, FULL_COLLISION_LAYER_MASK, NUM_VOXEL_BLOCKS, NUM_VOXEL_COLS,
    NUM_VOXEL_ROWS } from "../../../src/shared/system/sharedConstants";
import { LIGHT_SOURCE_MIN_DISTANCE } from "../../../src/client/system/clientConstants";


//------------------------------------------------------------------------------
// Fixtures
//------------------------------------------------------------------------------

/** A grid whose every voxel carries the given collision-layer mask. */
function makeVoxels(maskAt: (row: number, col: number) => number): Voxel[]
{
    const quadsMem = new VoxelQuadsRuntimeMemory();
    const voxels: Voxel[] = [];
    for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
    {
        for (let col = 0; col < NUM_VOXEL_COLS; ++col)
            voxels.push(new Voxel(quadsMem, row, col, maskAt(row, col)));
    }
    return voxels;
}

/** Every voxel hollow, so light spreads unobstructed except at the floor, ceiling and grid edge. */
const openRoom = () => makeVoxels(() => 0);

/** Every voxel solid. */
const solidRoom = () => makeVoxels(() => FULL_COLLISION_LAYER_MASK);

function makeLight(overrides: Partial<LightSource> = {}): LightSource
{
    return {
        worldPos: {x: 16.5, y: 1.75, z: 16.5},
        colorR: 1, colorG: 1, colorB: 1,
        range: 8,
        decay: 1,
        ...overrides,
    };
}

/** The world-space centre of a voxel block, which is where a block's light is measured. */
function blockCenter(row: number, col: number, collisionLayer: number)
{
    return {
        x: col + 0.5,
        y: VoxelQueryUtil.getWorldYAtVoxelCollisionLayerCenter(collisionLayer),
        z: row + 0.5,
    };
}

interface PropagationResult
{
    light: Float32Array;
    flux: Float32Array;
    /** Red channel of a block, which every fixture here uses as "how much light is in it". */
    at: (row: number, col: number, collisionLayer: number) => number;
    fluxAt: (row: number, col: number, collisionLayer: number) => {x: number, y: number, z: number};
}

function propagate(voxels: Voxel[], lights: LightSource[]): PropagationResult
{
    const light = new Float32Array(NUM_VOXEL_BLOCKS * 3);
    const flux = new Float32Array(NUM_VOXEL_BLOCKS * 3);
    const scratch = new LightPropagationScratch();
    for (const lightSource of lights)
        LightBlockPropagationUtil.accumulate(voxels, lightSource, light, flux, scratch);

    const indexOf = (row: number, col: number, collisionLayer: number) =>
        VoxelQueryUtil.getVoxelBlockIndex(row, col, collisionLayer) * 3;
    return {
        light,
        flux,
        at: (row, col, collisionLayer) => light[indexOf(row, col, collisionLayer)],
        fluxAt: (row, col, collisionLayer) => ({
            x: flux[indexOf(row, col, collisionLayer)],
            y: flux[indexOf(row, col, collisionLayer) + 1],
            z: flux[indexOf(row, col, collisionLayer) + 2],
        }),
    };
}

// A whole room is 16,384 blocks, so these are scanned into a single number and asserted once rather
// than asserted per entry — a per-entry assertion over a property test's runs costs minutes.
function maxAbsoluteDifference(a: ArrayLike<number>, b: ArrayLike<number>): number
{
    let worst = 0;
    for (let i = 0; i < a.length; ++i)
        worst = Math.max(worst, Math.abs(a[i] - b[i]));
    return worst;
}

// Reused across the smoothing cases, exactly as LightBlockMap holds one of each for the app's life.
const smoothingScratch = new Float32Array(NUM_VOXEL_BLOCKS * 3);
const openBlocks = new Uint8Array(NUM_VOXEL_BLOCKS);

function everyEntry(values: ArrayLike<number>, predicate: (value: number) => boolean): boolean
{
    for (let i = 0; i < values.length; ++i)
    {
        if (!predicate(values[i]))
            return false;
    }
    return true;
}

//------------------------------------------------------------------------------

describe("Light propagation", () =>
{
    describe("occlusion", () =>
    {
        it("keeps a sealed room's light inside it", () =>
        {
            // One hollow voxel, solid everywhere else — so the only open blocks in the whole room
            // are that voxel's own column, walled in on every side.
            const voxels = makeVoxels((row, col) =>
                (row === 16 && col === 16) ? 0 : FULL_COLLISION_LAYER_MASK);
            const result = propagate(voxels, [makeLight({range: 30})]);

            expect(result.at(16, 16, 3)).toBeGreaterThan(0);

            for (let blockIndex = 0; blockIndex < NUM_VOXEL_BLOCKS; ++blockIndex)
            {
                const row = VoxelQueryUtil.getVoxelBlockRow(blockIndex);
                const col = VoxelQueryUtil.getVoxelBlockCol(blockIndex);
                if (row === 16 && col === 16)
                    continue;
                expect(result.light[blockIndex * 3]).toBe(0);
            }
        });

        it("leaves the far side of a wall dark, and lights it once the wall comes down", () =>
        {
            // A wall running the width of the room, one voxel thick, with the lamp on one side of it.
            const wallRow = 20;
            const walled = makeVoxels((row) => row === wallRow ? FULL_COLLISION_LAYER_MASK : 0);
            const unwalled = openRoom();
            const light = makeLight({range: 20});

            const behindWall = {row: wallRow + 1, col: 16, collisionLayer: 3};

            const withWall = propagate(walled, [light]);
            const withoutWall = propagate(unwalled, [light]);

            expect(withWall.at(behindWall.row, behindWall.col, behindWall.collisionLayer)).toBe(0);
            expect(withoutWall.at(behindWall.row, behindWall.col, behindWall.collisionLayer))
                .toBeGreaterThan(0);
        });

        it("bends light around a corner, and charges it for the detour", () =>
        {
            // Light that goes round a wall has travelled further than the straight-line distance, so
            // it must arrive dimmer than it would have with no wall in the way.
            const wallRow = 20;
            // The wall stops short of the room's edge, leaving a gap light can come round through.
            const walled = makeVoxels((row, col) =>
                (row === wallRow && col < 25) ? FULL_COLLISION_LAYER_MASK : 0);
            const light = makeLight({range: 40});

            const target = {row: wallRow + 1, col: 16, collisionLayer: 3};
            const bent = propagate(walled, [light]);
            const direct = propagate(openRoom(), [light]);

            expect(bent.at(target.row, target.col, target.collisionLayer)).toBeGreaterThan(0);
            expect(bent.at(target.row, target.col, target.collisionLayer))
                .toBeLessThan(direct.at(target.row, target.col, target.collisionLayer));
        });

        it("lights nothing at all from inside a solid block", () =>
        {
            const result = propagate(solidRoom(), [makeLight({range: 30})]);
            expect(result.light.some(value => value !== 0)).toBe(false);
        });

        it("lights nothing from outside the room", () =>
        {
            const outside = [
                {x: -5, y: 1.75, z: 16.5},
                {x: 16.5, y: -1, z: 16.5},
                {x: 16.5, y: 999, z: 16.5},
                {x: 16.5, y: 1.75, z: NUM_VOXEL_ROWS + 5},
            ];
            for (const worldPos of outside)
            {
                const result = propagate(openRoom(), [makeLight({worldPos, range: 30})]);
                expect(result.light.some(value => value !== 0)).toBe(false);
            }
        });
    });

    describe("falloff", () =>
    {
        it("delivers exactly three.js's own point-light attenuation at a known distance", () =>
        {
            // The whole point of carrying distance rather than brightness through the fill: a lamp
            // here and a real THREE.PointLight of the same range and decay are the same light.
            const light = makeLight({range: 8, decay: 1, colorR: 2});
            const result = propagate(openRoom(), [light]);

            const lampBlock = {row: 16, col: 16, collisionLayer: 3};
            // The block the lamp stands in is at no distance from it at all, where a point light's
            // falloff has no finite value — so a lamp is treated as a thing half a block across
            // rather than as a point. Without that it takes a hundred times what the block beside it
            // takes, and no exposure can hold both.
            expect(result.at(lampBlock.row, lampBlock.col, lampBlock.collisionLayer))
                .toBeCloseTo(2 * getDistanceAttenuation(LIGHT_SOURCE_MIN_DISTANCE, 8, 1), 5);

            // One block sideways is one world unit; one block up is a collision layer's height.
            expect(result.at(lampBlock.row, lampBlock.col + 1, lampBlock.collisionLayer))
                .toBeCloseTo(2 * getDistanceAttenuation(1, 8, 1), 5);
            expect(result.at(lampBlock.row, lampBlock.col, lampBlock.collisionLayer + 1))
                .toBeCloseTo(2 * getDistanceAttenuation(COLLISION_LAYER_HEIGHT, 8, 1), 5);

            // And diagonally, which is where measuring along the grid route rather than in a
            // straight line would show up: three blocks across and three along is the route's six
            // units but the straight line's four and a quarter.
            expect(result.at(lampBlock.row + 3, lampBlock.col + 3, lampBlock.collisionLayer))
                .toBeCloseTo(2 * getDistanceAttenuation(Math.hypot(3, 3), 8, 1), 5);
        });

        it("never brightens with distance along a straight run", () =>
        {
            const result = propagate(openRoom(), [makeLight({range: 20})]);
            let previous = Number.POSITIVE_INFINITY;
            for (let col = 16; col < NUM_VOXEL_COLS - 1; ++col)
            {
                const brightness = result.at(16, col, 3);
                expect(brightness).toBeLessThanOrEqual(previous);
                previous = brightness;
            }
        });

        it("reaches nothing past its own range", () =>
        {
            const range = 5;
            const result = propagate(openRoom(), [makeLight({range})]);
            const lamp = makeLight().worldPos;

            for (let blockIndex = 0; blockIndex < NUM_VOXEL_BLOCKS; ++blockIndex)
            {
                if (result.light[blockIndex * 3] === 0)
                    continue;
                const center = blockCenter(
                    VoxelQueryUtil.getVoxelBlockRow(blockIndex),
                    VoxelQueryUtil.getVoxelBlockCol(blockIndex),
                    VoxelQueryUtil.getVoxelBlockCollisionLayer(blockIndex));
                // Straight-line distance is a lower bound on the distance light actually travelled,
                // so nothing lit can be further off than the range in a straight line either.
                const straightLineDistance = Math.hypot(
                    center.x - lamp.x, center.y - lamp.y, center.z - lamp.z);
                expect(straightLineDistance).toBeLessThan(range);
            }
        });

        it("a wider range reaches at least as far as a narrower one", () =>
        {
            const near = propagate(openRoom(), [makeLight({range: 6})]);
            const far = propagate(openRoom(), [makeLight({range: 12})]);
            for (let blockIndex = 0; blockIndex < NUM_VOXEL_BLOCKS; ++blockIndex)
            {
                if (near.light[blockIndex * 3] > 0)
                    expect(far.light[blockIndex * 3]).toBeGreaterThan(0);
            }
        });
    });

    describe("directionality", () =>
    {
        it("records the direction light travelled, not the direction back to the lamp", () =>
        {
            const result = propagate(openRoom(), [makeLight({range: 20})]);

            // Two blocks on opposite sides of the lamp: light reaching them travelled in opposite
            // directions, so the two recorded directions must oppose each other.
            const rightward = result.fluxAt(16, 20, 3);
            const leftward = result.fluxAt(16, 12, 3);
            expect(rightward.x).toBeGreaterThan(0);
            expect(leftward.x).toBeLessThan(0);
            expect(Math.abs(rightward.y)).toBeCloseTo(0, 6);
            expect(Math.abs(rightward.z)).toBeCloseTo(0, 6);

            const forward = result.fluxAt(20, 16, 3);
            expect(forward.z).toBeGreaterThan(0);
        });

        it("records no direction for the block the lamp itself stands in", () =>
        {
            const result = propagate(openRoom(), [makeLight()]);
            const flux = result.fluxAt(16, 16, 3);
            expect(flux.x).toBe(0);
            expect(flux.y).toBe(0);
            expect(flux.z).toBe(0);
        });

        it("points straight back at the lamp", () =>
        {
            // Taken in a straight line rather than from the grid route, which only ever runs along
            // the axes — a direction read off that quantizes, and a wall shaded by it comes out in
            // bands.
            const lamp = makeLight({range: 12});
            const result = propagate(openRoom(), [lamp]);

            for (let blockIndex = 0; blockIndex < NUM_VOXEL_BLOCKS; ++blockIndex)
            {
                const x = result.flux[blockIndex * 3];
                const y = result.flux[blockIndex * 3 + 1];
                const z = result.flux[blockIndex * 3 + 2];
                const length = Math.hypot(x, y, z);
                if (length === 0)
                    continue;

                const center = blockCenter(
                    VoxelQueryUtil.getVoxelBlockRow(blockIndex),
                    VoxelQueryUtil.getVoxelBlockCol(blockIndex),
                    VoxelQueryUtil.getVoxelBlockCollisionLayer(blockIndex));
                const awayFromLamp = {
                    x: center.x - lamp.worldPos.x,
                    y: center.y - lamp.worldPos.y,
                    z: center.z - lamp.worldPos.z,
                };
                const awayLength = Math.hypot(awayFromLamp.x, awayFromLamp.y, awayFromLamp.z);

                const alignment = (x * awayFromLamp.x + y * awayFromLamp.y + z * awayFromLamp.z)
                    / (length * awayLength);
                expect(alignment).toBeGreaterThan(0.99);
            }
        });

        it("charges a block for the detour rather than redirecting the light", () =>
        {
            // The direction is a straight line even where light had to come round a wall to arrive,
            // which would point it through that wall. That is the trade for a direction smooth
            // enough not to band: what is misdirected is what the detour has already made dim, so
            // the two shots are of a wall lit round a corner being much darker than the same wall
            // lit head-on, rather than of it being lit from a different side.
            const wallRow = 20;
            const walled = makeVoxels((row, col) =>
                (row === wallRow && col < 25) ? FULL_COLLISION_LAYER_MASK : 0);
            const lamp = makeLight({range: 40});

            const target = {row: wallRow + 1, col: 16, collisionLayer: 3};
            const roundTheCorner = propagate(walled, [lamp])
                .at(target.row, target.col, target.collisionLayer);
            const headOn = propagate(openRoom(), [lamp])
                .at(target.row, target.col, target.collisionLayer);

            expect(roundTheCorner).toBeGreaterThan(0);
            // The way round is several times the straight-line distance here, and the penalty is
            // squared, so what arrives is a small fraction of what a clear line would have brought.
            expect(roundTheCorner).toBeLessThan(headOn * 0.2);
        });
    });

    describe("accumulation", () =>
    {
        it("adds one light's contribution to another's", () =>
        {
            const a = makeLight({worldPos: {x: 10.5, y: 1.75, z: 16.5}, range: 20});
            const b = makeLight({worldPos: {x: 22.5, y: 1.75, z: 16.5}, range: 20});

            const onlyA = propagate(openRoom(), [a]);
            const onlyB = propagate(openRoom(), [b]);
            const both = propagate(openRoom(), [a, b]);

            expect(maxAbsoluteDifference(both.light,
                onlyA.light.map((value, i) => value + onlyB.light[i]))).toBeLessThan(1e-5);
        });

        it("keeps each color channel to itself", () =>
        {
            const red = makeLight({colorR: 1, colorG: 0, colorB: 0, range: 20});
            const result = propagate(openRoom(), [red]);
            for (let blockIndex = 0; blockIndex < NUM_VOXEL_BLOCKS; ++blockIndex)
            {
                expect(result.light[blockIndex * 3 + 1]).toBe(0);
                expect(result.light[blockIndex * 3 + 2]).toBe(0);
            }
        });

        it("leaves every block dark when there are no lights at all", () =>
        {
            const result = propagate(openRoom(), []);
            expect(result.light.some(value => value !== 0)).toBe(false);
            expect(result.flux.some(value => value !== 0)).toBe(false);
        });

        it("does not depend on the order the lights are supplied in", () =>
        {
            fc.assert(fc.property(
                fc.array(fc.record({
                    col: fc.integer({min: 1, max: NUM_VOXEL_COLS - 2}),
                    row: fc.integer({min: 1, max: NUM_VOXEL_ROWS - 2}),
                    collisionLayer: fc.integer({min: 0, max: 15}),
                    colorR: fc.float({min: Math.fround(0.1), max: 4, noNaN: true}),
                    range: fc.float({min: Math.fround(1.5), max: 12, noNaN: true}),
                }), {minLength: 2, maxLength: 5}),
                fc.integer({min: 0, max: 1000}),
                (specs, shuffleSeed) =>
                {
                    const voxels = openRoom();
                    const lights = specs.map(spec => makeLight({
                        worldPos: blockCenter(spec.row, spec.col, spec.collisionLayer),
                        colorR: spec.colorR,
                        range: spec.range,
                    }));

                    // A rotation is enough to make the point: what is being ruled out is a fill that
                    // leaves state behind for the next light to trip over.
                    const rotation = shuffleSeed % lights.length;
                    const reordered = lights.slice(rotation).concat(lights.slice(0, rotation));

                    const forward = propagate(voxels, lights);
                    const rotated = propagate(voxels, reordered);

                    expect(maxAbsoluteDifference(rotated.light, forward.light))
                        .toBeLessThan(1e-4);
                }
            ), {numRuns: 25});
        });

        it("reuses its scratch buffers without leaking light between rooms", () =>
        {
            // The fill resets only what it touched, which is what makes a lamp cost its own range
            // rather than the size of the room. A reset that missed something would show up as light
            // appearing in a room that has no lamps in it.
            const scratch = new LightPropagationScratch();

            const first = new Float32Array(NUM_VOXEL_BLOCKS * 3);
            const firstFlux = new Float32Array(NUM_VOXEL_BLOCKS * 3);
            LightBlockPropagationUtil.accumulate(openRoom(), makeLight({range: 20}),
                first, firstFlux, scratch);
            expect(first.some(value => value !== 0)).toBe(true);

            // The same scratch, now handed a room with nowhere for light to be.
            const second = new Float32Array(NUM_VOXEL_BLOCKS * 3);
            const secondFlux = new Float32Array(NUM_VOXEL_BLOCKS * 3);
            LightBlockPropagationUtil.accumulate(solidRoom(), makeLight({range: 20}),
                second, secondFlux, scratch);
            expect(second.some(value => value !== 0)).toBe(false);

            // And the same scratch a third time, which must give the first result back exactly.
            const third = new Float32Array(NUM_VOXEL_BLOCKS * 3);
            const thirdFlux = new Float32Array(NUM_VOXEL_BLOCKS * 3);
            LightBlockPropagationUtil.accumulate(openRoom(), makeLight({range: 20}),
                third, thirdFlux, scratch);
            expect(Array.from(third)).toEqual(Array.from(first));
            expect(Array.from(thirdFlux)).toEqual(Array.from(firstFlux));
        });
    });

    describe("smoothing", () =>
    {
        it("never carries light across a solid block", () =>
        {
            // Softening the field is what stops the grid showing as facets, but a blur that treated
            // a wall as just another dark neighbour would hand light straight through it — undoing
            // the one thing the flood fill went to the trouble of respecting.
            const wallRow = 20;
            const voxels = makeVoxels((row) => row === wallRow ? FULL_COLLISION_LAYER_MASK : 0);
            const result = propagate(voxels, [makeLight({range: 30})]);

            LightBlockSmoothingUtil.markOpenBlocks(voxels, openBlocks);
            LightBlockSmoothingUtil.smooth(result.light, smoothingScratch, openBlocks);

            // The near face of the wall is as bright as ever; nothing at all reaches past it.
            expect(result.at(wallRow - 1, 16, 3)).toBeGreaterThan(0);
            for (let row = wallRow; row < NUM_VOXEL_ROWS; ++row)
            {
                for (let col = 0; col < NUM_VOXEL_COLS; ++col)
                    expect(result.at(row, col, 3)).toBe(0);
            }
        });

        it("leaves a solid block dark even when it was never lit to begin with", () =>
        {
            const voxels = solidRoom();
            const result = propagate(voxels, [makeLight({range: 20})]);
            LightBlockSmoothingUtil.markOpenBlocks(voxels, openBlocks);
            LightBlockSmoothingUtil.smooth(result.light, smoothingScratch, openBlocks);
            expect(result.light.some(value => value !== 0)).toBe(false);
        });

        it("conserves a flat field rather than darkening it at the edges", () =>
        {
            // The weights are renormalized by however many neighbours a block actually has, so a
            // block against a wall is not averaged with a neighbour that is not there. Without that,
            // every surface in the room would be rimmed with a darker band.
            const voxels = openRoom();
            const field = new Float32Array(NUM_VOXEL_BLOCKS * 3).fill(1);
            LightBlockSmoothingUtil.markOpenBlocks(voxels, openBlocks);
            LightBlockSmoothingUtil.smooth(field, smoothingScratch, openBlocks);
            expect(everyEntry(field, value => Math.abs(value - 1) < 1e-5)).toBe(true);
        });
    });

    describe("reading the map back", () =>
    {
        // What the lamp the camera carries stands down for: it asks the map how well lit the player
        // already is, and a room somebody has lit is then seen by its own light rather than washed
        // flat by a white one held at arm's length (see GraphicsManager).
        function mapWithLampAt(worldPos: {x: number, y: number, z: number}): LightBlockMap
        {
            const map = new LightBlockMap();
            map.resetForRoom(openRoom());
            map.addLightSource("lamp", makeLight({worldPos, range: 20, colorR: 2, colorG: 2, colorB: 2}));
            map.update();
            return map;
        }

        const probe = new THREE.Color();
        const luminanceAt = (map: LightBlockMap, worldPos: {x: number, y: number, z: number}) =>
        {
            map.getLightAt(worldPos, probe);
            return 0.2126 * probe.r + 0.7152 * probe.g + 0.0722 * probe.b;
        };

        it("reports more light near a lamp than far from one", () =>
        {
            const map = mapWithLampAt({x: 16.5, y: 1.75, z: 16.5});
            const near = luminanceAt(map, {x: 16.5, y: 1.75, z: 17.5});
            const far = luminanceAt(map, {x: 16.5, y: 1.75, z: 28.5});
            expect(near).toBeGreaterThan(far);
            expect(far).toBeGreaterThanOrEqual(0);
        });

        it("reports nothing at all in a room with no lamps in it", () =>
        {
            const map = new LightBlockMap();
            map.resetForRoom(openRoom());
            map.update();
            expect(luminanceAt(map, {x: 16.5, y: 1.75, z: 16.5})).toBe(0);
        });

        it("keeps its colour rather than reporting only how much", () =>
        {
            // The lamp the camera carries takes on the room's colour as well as standing down for
            // it, so what comes back has to be the light itself and not a single number.
            const map = new LightBlockMap();
            map.resetForRoom(openRoom());
            map.addLightSource("red", makeLight({colorR: 3, colorG: 0, colorB: 0, range: 20}));
            map.update();
            map.getLightAt({x: 16.5, y: 1.75, z: 18.5}, probe);
            expect(probe.r).toBeGreaterThan(0);
            expect(probe.g).toBe(0);
            expect(probe.b).toBe(0);
        });

        it("does not read a wall as darkness", () =>
        {
            // A solid block holds no light because there is nowhere in it for light to be, which is
            // not the same as its surroundings being dark. Reading it as dark would hand the player
            // his own lamp back at full strength exactly where he walked up to look at something.
            const wallCol = 8;
            const voxels = makeVoxels((_row, col) =>
                col === wallCol ? FULL_COLLISION_LAYER_MASK : 0);
            const map = new LightBlockMap();
            map.resetForRoom(voxels);
            map.addLightSource("lamp", makeLight({
                worldPos: {x: 14.5, y: 1.75, z: 16.5}, colorR: 3, colorG: 3, colorB: 3, range: 20}));
            map.update();

            // Walking the last stretch up to the wall must not drop the reading away.
            let previous = luminanceAt(map, {x: 12.5, y: 1.75, z: 16.5});
            expect(previous).toBeGreaterThan(0);
            for (let x = 12.4; x > wallCol + 1.05; x -= 0.1)
            {
                const here = luminanceAt(map, {x, y: 1.75, z: 16.5});
                // It falls off with distance from the lamp, but never collapses toward nothing.
                expect(here).toBeGreaterThan(previous * 0.75);
                previous = here;
            }
        });

        it("changes smoothly rather than block by block", () =>
        {
            // A value that stepped as the player crossed between blocks would step how bright his
            // own lamp is, which is far more noticeable than the step itself.
            const map = mapWithLampAt({x: 16.5, y: 1.75, z: 16.5});
            let previous = luminanceAt(map, {x: 16.5, y: 1.75, z: 18.5});
            let worstJump = 0;
            for (let z = 18.5; z <= 24.5; z += 0.05)
            {
                const here = luminanceAt(map, {x: 16.5, y: 1.75, z});
                worstJump = Math.max(worstJump, Math.abs(here - previous));
                previous = here;
            }
            // A block is a whole world unit across, so a walk of a twentieth of one can only ever
            // move this by a small fraction of what a whole block's worth of falloff is.
            expect(worstJump).toBeLessThan(0.02);
        });

        it("clamps to the room's edge rather than failing outside it", () =>
        {
            const map = mapWithLampAt({x: 1.5, y: 1.75, z: 1.5});
            for (const worldPos of [
                {x: -40, y: 1.75, z: 16.5},
                {x: 16.5, y: -10, z: 16.5},
                {x: 16.5, y: 900, z: 16.5},
                {x: 16.5, y: 1.75, z: NUM_VOXEL_ROWS + 40},
            ])
            {
                const brightness = luminanceAt(map, worldPos);
                expect(Number.isFinite(brightness)).toBe(true);
                expect(brightness).toBeGreaterThanOrEqual(0);
            }
        });
    });

    describe("robustness", () =>
    {
        it("never throws, and never produces a negative or non-finite amount of light", () =>
        {
            fc.assert(fc.property(
                fc.record({
                    x: fc.float({min: -50, max: 80, noNaN: true}),
                    y: fc.float({min: -20, max: 30, noNaN: true}),
                    z: fc.float({min: -50, max: 80, noNaN: true}),
                }),
                fc.float({min: Math.fround(0.01), max: 60, noNaN: true}),
                fc.float({min: 0, max: 4, noNaN: true}),
                fc.integer({min: 0, max: FULL_COLLISION_LAYER_MASK}),
                (worldPos, range, decay, mask) =>
                {
                    // A room in stripes, so that the fill meets solid blocks, open blocks and the
                    // boundaries between them whatever mask is drawn.
                    const voxels = makeVoxels((row, col) => ((row + col) % 2 === 0) ? mask : 0);
                    const result = propagate(voxels,
                        [makeLight({worldPos, range, decay})]);

                    expect(everyEntry(result.light,
                        value => Number.isFinite(value) && value >= 0)).toBe(true);
                    expect(everyEntry(result.flux, value => Number.isFinite(value))).toBe(true);
                }
            ), {numRuns: 30});
        });
    });
});
