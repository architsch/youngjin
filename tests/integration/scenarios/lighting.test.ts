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
 * - Monotonicity: installing a light never leaves any surface in the room darker than it found it
 * - Nearness: the light near a point, which the head lamp stands down for, reaches past a lamp's
 *   own light but never through a wall
 */
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import fc from "fast-check";
import LightBlockPropagationUtil, { getDistanceAttenuation, getLightLuminance,
    LightPropagationScratch }
    from "../../../src/client/graphics/light/util/lightBlockPropagationUtil";
import LightSource from "../../../src/client/graphics/light/types/lightSource";
import LightBlockSmoothingUtil from "../../../src/client/graphics/light/util/lightBlockSmoothingUtil";
import LightBlockDilationUtil, { NEARBY_LIGHT_SPREAD }
    from "../../../src/client/graphics/light/util/lightBlockDilationUtil";
import LightBlockMap from "../../../src/client/graphics/light/maps/lightBlockMap";
import Voxel from "../../../src/shared/voxel/types/voxel";
import VoxelQuadsRuntimeMemory from "../../../src/shared/voxel/types/voxelQuadsRuntimeMemory";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import { COLLISION_LAYER_HEIGHT, FULL_COLLISION_LAYER_MASK, NUM_VOXEL_BLOCKS, NUM_VOXEL_COLS,
    NUM_VOXEL_ROWS } from "../../../src/shared/system/sharedConstants";
import { LIGHT_BLOCK_MAP_AMBIENT_SHARE, LIGHT_SOURCE_MIN_DISTANCE }
    from "../../../src/client/system/clientConstants";


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

        it("reaches a ball rather than a diamond, in an open room", () =>
        {
            // Stepping from block to block only ever goes along the axes, so a route through the
            // grid is as long as the sides of the box between its ends rather than as the line
            // across it. A fill bounded by the length of that route therefore carries a lamp its
            // full reach along each axis but gives out a factor of root two short on a flat diagonal
            // and root three short on a corner one — and it gives out there while the falloff is
            // still plainly bright, so the light does not fade out, it stops dead on an octahedron.
            // That edge is what draws a lamp as a diamond. Bounding it by the straight line instead
            // is what this asserts, from both sides: everything inside the ball is lit and nothing
            // outside it is.
            //
            // Everything inside really is reachable, walls aside: a route that only ever steps
            // toward its target stays inside the box between the two ends, and so never runs further
            // from the lamp than the target itself is.
            const range = 7;
            const result = propagate(openRoom(), [makeLight({range})]);
            const lamp = makeLight().worldPos;

            // A hair either side of the boundary is left out rather than asserted, since a block
            // sitting exactly at the range is decided by the last bit of two different ways of
            // arriving at the same distance.
            const boundaryTolerance = 1e-6;
            for (let blockIndex = 0; blockIndex < NUM_VOXEL_BLOCKS; ++blockIndex)
            {
                const center = blockCenter(
                    VoxelQueryUtil.getVoxelBlockRow(blockIndex),
                    VoxelQueryUtil.getVoxelBlockCol(blockIndex),
                    VoxelQueryUtil.getVoxelBlockCollisionLayer(blockIndex));
                const straightLineDistance = Math.hypot(
                    center.x - lamp.x, center.y - lamp.y, center.z - lamp.z);
                if (Math.abs(straightLineDistance - range) <= boundaryTolerance)
                    continue;
                expect(result.light[blockIndex * 3] > 0).toBe(straightLineDistance < range);
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

    describe("nearness", () =>
    {
        // What the lamp the camera carries stands down for is not the light standing where the
        // player is but the brightest light near there, discounted by how far off it is (see
        // LightBlockDilationUtil) — since a lamp's pool is looked at from well outside the light it
        // casts, and a head lamp back at full strength there washes the pool out.

        const nearbyLight = new Float32Array(NUM_VOXEL_BLOCKS * 3);

        /** The room's light as the map holds it: propagated, then smoothed. */
        function smoothedLight(voxels: Voxel[], lights: LightSource[]): PropagationResult
        {
            LightBlockSmoothingUtil.markOpenBlocks(voxels, openBlocks);
            const result = propagate(voxels, lights);
            LightBlockSmoothingUtil.smooth(result.light, smoothingScratch, openBlocks);
            return result;
        }

        it("agrees with a search of the whole room, in an open room", () =>
        {
            // The pass sweeps one axis at a time, which is the same thing as asking every lit block
            // in the room only because its discount is a bell curve over straight-line distance.
            // Asserted against that search itself, which rules out both a sweep that loses light on
            // the way and a pass that reaches a diamond rather than a ball.
            const isOpen = new Uint8Array(NUM_VOXEL_BLOCKS).fill(1);
            const centers = Array.from({length: NUM_VOXEL_BLOCKS}, (_, blockIndex) => blockCenter(
                VoxelQueryUtil.getVoxelBlockRow(blockIndex),
                VoxelQueryUtil.getVoxelBlockCol(blockIndex),
                VoxelQueryUtil.getVoxelBlockCollisionLayer(blockIndex)));
            const discountPerSquaredDistance = 1 / (2 * NEARBY_LIGHT_SPREAD * NEARBY_LIGHT_SPREAD);
            const channel = fc.integer({min: 0, max: 400}).map(hundredths => hundredths / 100);

            fc.assert(fc.property(fc.array(fc.record({
                blockIndex: fc.integer({min: 0, max: NUM_VOXEL_BLOCKS - 1}),
                colorR: channel, colorG: channel, colorB: channel,
            }), {minLength: 1, maxLength: 6}), (litBlocks) =>
            {
                const field = new Float32Array(NUM_VOXEL_BLOCKS * 3);
                for (const lit of litBlocks)
                {
                    field[lit.blockIndex * 3] = lit.colorR;
                    field[lit.blockIndex * 3 + 1] = lit.colorG;
                    field[lit.blockIndex * 3 + 2] = lit.colorB;
                }
                LightBlockDilationUtil.dilate(field, nearbyLight, isOpen);

                const sources = [...new Set(litBlocks.map(lit => lit.blockIndex))];
                const luminanceOf = (buffer: Float32Array, blockIndex: number) => getLightLuminance(
                    buffer[blockIndex * 3], buffer[blockIndex * 3 + 1], buffer[blockIndex * 3 + 2]);

                // Scanned into single worst cases and asserted once, as elsewhere in this file.
                let worstError = 0;
                for (let blockIndex = 0; blockIndex < NUM_VOXEL_BLOCKS; ++blockIndex)
                {
                    let best = -1, bestLight = 0, runnerUpLight = 0;
                    for (const source of sources)
                    {
                        const dx = centers[blockIndex].x - centers[source].x;
                        const dy = centers[blockIndex].y - centers[source].y;
                        const dz = centers[blockIndex].z - centers[source].z;
                        const arrived = luminanceOf(field, source) *
                            Math.exp(-discountPerSquaredDistance * (dx*dx + dy*dy + dz*dz));
                        if (arrived > bestLight)
                        {
                            runnerUpLight = bestLight;
                            bestLight = arrived;
                            best = source;
                        }
                        else
                            runnerUpLight = Math.max(runnerUpLight, arrived);
                    }

                    // Relative to what should have arrived — except down among what a float holds
                    // to no useful precision, where only the difference itself is worth asking
                    // about.
                    worstError = Math.max(worstError,
                        Math.abs(luminanceOf(nearbyLight, blockIndex) - bestLight) /
                        Math.max(bestLight, 1e-12));

                    // The color is the winning block's own, which is only a question with one
                    // answer where two blocks do not arrive with the same amount of light.
                    if (bestLight < 1e-12 || bestLight - runnerUpLight < bestLight * 1e-6)
                        continue;
                    const discount = bestLight / luminanceOf(field, best);
                    for (let offset = 0; offset < 3; ++offset)
                    {
                        const expected = field[best * 3 + offset] * discount;
                        worstError = Math.max(worstError,
                            Math.abs(nearbyLight[blockIndex * 3 + offset] - expected) /
                            Math.max(expected, 1e-6));
                    }
                }
                expect(worstError).toBeLessThan(1e-4);
            }), {numRuns: 10});
        });

        it("never reports less light near a point than stands at it", () =>
        {
            // Nearness only ever adds reach: under a lamp, the head lamp stands down at least as
            // far as it would for the light standing there alone.
            fc.assert(fc.property(fc.array(fc.record({
                col: fc.integer({min: 1, max: NUM_VOXEL_COLS - 2}),
                row: fc.integer({min: 1, max: NUM_VOXEL_ROWS - 2}),
                collisionLayer: fc.integer({min: 0, max: 15}),
                colorR: fc.float({min: Math.fround(0.1), max: 4, noNaN: true}),
                range: fc.float({min: Math.fround(1.5), max: 12, noNaN: true}),
            }), {minLength: 1, maxLength: 3}), (specs) =>
            {
                const result = smoothedLight(openRoom(), specs.map(spec => makeLight({
                    worldPos: blockCenter(spec.row, spec.col, spec.collisionLayer),
                    colorR: spec.colorR,
                    range: spec.range,
                })));
                LightBlockDilationUtil.dilate(result.light, nearbyLight, openBlocks);

                let worstShortfall = 0;
                for (let blockIndex = 0; blockIndex < NUM_VOXEL_BLOCKS; ++blockIndex)
                {
                    const at = blockIndex * 3;
                    const standing = getLightLuminance(result.light[at], result.light[at + 1],
                        result.light[at + 2]);
                    const near = getLightLuminance(nearbyLight[at], nearbyLight[at + 1],
                        nearbyLight[at + 2]);
                    worstShortfall = Math.max(worstShortfall,
                        (standing - near) / Math.max(standing, 1e-6));
                }
                expect(worstShortfall).toBeLessThan(1e-5);
            }), {numRuns: 15});
        });

        it("never carries light through a solid block", () =>
        {
            // A lamp on the far side of a wall is not near anybody on this side of it, however few
            // paces off it stands — which is what keeps a player walled in beside a lit room from
            // losing the lamp they see by.
            const wallRow = 20;
            const voxels = makeVoxels((row) => row === wallRow ? FULL_COLLISION_LAYER_MASK : 0);
            const result = smoothedLight(voxels, [makeLight({range: 30})]);
            LightBlockDilationUtil.dilate(result.light, nearbyLight, openBlocks);

            expect(nearbyLight[VoxelQueryUtil.getVoxelBlockIndex(wallRow - 1, 16, 3) * 3])
                .toBeGreaterThan(0);
            let brightestPastTheWall = 0;
            for (let blockIndex = 0; blockIndex < NUM_VOXEL_BLOCKS; ++blockIndex)
            {
                if (VoxelQueryUtil.getVoxelBlockRow(blockIndex) < wallRow)
                    continue;
                for (let offset = 0; offset < 3; ++offset)
                {
                    brightestPastTheWall = Math.max(brightestPastTheWall,
                        nearbyLight[blockIndex * 3 + offset]);
                }
            }
            expect(brightestPastTheWall).toBe(0);
        });
    });

    describe("never darkening what it reaches", () =>
    {
        // A light can only ever *add* light to a room. The amount is monotone by construction, since
        // the fill adds; what is not free is the **direction**, which is one vector per block
        // however many lamps met there. A direction that swung on anything other than the light
        // behind it is the one way installing a lamp could take shading away from the room it was
        // put in — and the reason the block map records how much of a block's light has a direction
        // at all, rather than the direction alone.

        /** How much of a block's light is travelling one way rather than standing in it from every
         *  side (see LightBlockMap). */
        function directionalShareAt(result: PropagationResult, blockIndex: number): number
        {
            const at = blockIndex * 3;
            const luminance = getLightLuminance(result.light[at], result.light[at + 1],
                result.light[at + 2]);
            if (luminance <= 0)
                return 0;
            return Math.min(1, Math.hypot(result.flux[at], result.flux[at + 1],
                result.flux[at + 2]) / luminance);
        }

        /** What a surface with the given normal receives from a block: the arithmetic of
         *  LIGHT_BLOCK_MAP_FRAGMENT_GLSL, which cannot be run here without a GPU. */
        function shadeAt(result: PropagationResult, blockIndex: number,
            normal: {x: number, y: number, z: number}): number
        {
            const at = blockIndex * 3;
            const lit = getLightLuminance(result.light[at], result.light[at + 1],
                result.light[at + 2]);
            const fluxX = result.flux[at], fluxY = result.flux[at + 1], fluxZ = result.flux[at + 2];
            const fluxLength = Math.hypot(fluxX, fluxY, fluxZ);
            // Light travels *along* the flux, so a surface faces it when its normal opposes it.
            const facing = (fluxLength > 0)
                ? Math.max(0, -(normal.x * fluxX + normal.y * fluxY + normal.z * fluxZ) / fluxLength)
                : 0;
            const reach = 1 - directionalShareAt(result, blockIndex) * (1 - facing);
            return lit * (LIGHT_BLOCK_MAP_AMBIENT_SHARE +
                (1 - LIGHT_BLOCK_MAP_AMBIENT_SHARE) * reach);
        }

        function smoothed(result: PropagationResult): PropagationResult
        {
            LightBlockSmoothingUtil.smooth(result.light, smoothingScratch, openBlocks);
            LightBlockSmoothingUtil.smooth(result.flux, smoothingScratch, openBlocks);
            return result;
        }

        // A channel of a light a lamp could actually be: a palette entry brought into linear space
        // and multiplied by a strength, which is either exactly nothing or a hundredth of something.
        // Quantized rather than drawn from the whole of the float range on purpose — the two fields
        // below are compared against each other as a ratio, and a channel down among the denormals
        // is a number float32 holds to no useful precision at all, so what such a draw measures is
        // the storage rather than the propagation.
        const lightChannels = fc.integer({min: 0, max: 400}).map(hundredths => hundredths / 100);
        const lampSpecs = fc.record({
            col: fc.integer({min: 1, max: NUM_VOXEL_COLS - 2}),
            row: fc.integer({min: 1, max: NUM_VOXEL_ROWS - 2}),
            collisionLayer: fc.integer({min: 0, max: 15}),
            // Zero included on every channel, so that a light with nothing in it is among the ones
            // being installed rather than a case of its own.
            colorR: lightChannels,
            colorG: lightChannels,
            colorB: lightChannels,
            range: fc.float({min: Math.fround(1.5), max: 12, noNaN: true}),
        });
        const toLight = (spec: {col: number, row: number, collisionLayer: number, colorR: number,
            colorG: number, colorB: number, range: number}) => makeLight({
            worldPos: blockCenter(spec.row, spec.col, spec.collisionLayer),
            colorR: spec.colorR, colorG: spec.colorG, colorB: spec.colorB,
            range: spec.range,
        });

        it("takes nothing at all from the room for a light with no light in it", () =>
        {
            // A fitting painted black is the plainest case of the whole section: it lights nothing,
            // so it must also point nowhere. Weighed by the geometry alone it would swing the
            // direction as hard as the lamp actually lighting the place, and everything around it
            // would be shaded as though lit from a side nothing was lighting it from.
            const lamp = makeLight({worldPos: {x: 12.5, y: 1.75, z: 16.5}, range: 20});
            const dark = makeLight({worldPos: {x: 20.5, y: 1.75, z: 16.5},
                colorR: 0, colorG: 0, colorB: 0, range: 20});

            const alone = propagate(openRoom(), [lamp]);
            const beside = propagate(openRoom(), [lamp, dark]);

            expect(maxAbsoluteDifference(beside.light, alone.light)).toBe(0);
            expect(maxAbsoluteDifference(beside.flux, alone.flux)).toBe(0);
        });

        it("hands the direction to the lamp that is doing the lighting", () =>
        {
            // Two lamps the same distance from the block between them, one of them all but unlit.
            // They travel the same way through the grid and are charged the same detour, so a
            // direction weighed by the route alone would have them cancel each other out almost
            // exactly — leaving the block lit by the bright one and shaded as though lit by neither.
            const bright = makeLight({worldPos: {x: 12.5, y: 1.75, z: 16.5}, range: 20});
            const nearlyDark = makeLight({worldPos: {x: 20.5, y: 1.75, z: 16.5},
                colorR: 0.01, colorG: 0.01, colorB: 0.01, range: 20});

            const result = propagate(openRoom(), [bright, nearlyDark]);
            // Light from the bright lamp travels toward increasing x to arrive here.
            expect(result.fluxAt(16, 16, 3).x).toBeGreaterThan(0);
            // And nearly all of what stands here is travelling that way: the other lamp is entitled
            // to take a hundredth of the direction away, not the whole of it.
            expect(directionalShareAt(result,
                VoxelQueryUtil.getVoxelBlockIndex(16, 16, 3))).toBeGreaterThan(0.9);
        });

        it("lights a surface between two facing lamps more than one lamp does, not less", () =>
        {
            // The sharpest case of the whole section, and the one a direction on its own cannot
            // survive: light arrives here from both sides at once and all but cancels, while both
            // lamps go on lighting the place. Which way the little that is left over points is then
            // settled by the tenth of a lamp between them — so a surface turned toward the first
            // lamp goes from being charged for none of the light to being charged for all of it,
            // and ends up darker under two lamps than it was under one.
            const towardFirstLamp = {x: -1, y: 0, z: 0};
            const target = VoxelQueryUtil.getVoxelBlockIndex(16, 16, 3);
            const first = makeLight({worldPos: {x: 12.5, y: 1.75, z: 16.5}, range: 20});
            const second = makeLight({worldPos: {x: 20.5, y: 1.75, z: 16.5}, range: 20,
                colorR: 1.1, colorG: 1.1, colorB: 1.1});

            const alone = propagate(openRoom(), [first]);
            const facing = propagate(openRoom(), [first, second]);

            // The surface is turned squarely toward the first lamp, so it had everything that lamp
            // could give it — the whole of what the second one adds is what is at stake.
            expect(shadeAt(alone, target, towardFirstLamp))
                .toBeCloseTo(getLightLuminance(alone.light[target * 3], alone.light[target * 3 + 1],
                    alone.light[target * 3 + 2]), 5);
            expect(shadeAt(facing, target, towardFirstLamp))
                .toBeGreaterThan(shadeAt(alone, target, towardFirstLamp));
        });

        it("never records more direction than there is light to carry it", () =>
        {
            // What the shader divides one by the other to get, and what makes that share a share:
            // the two fields are accumulated in step, and the smoothing sweeps them with the same
            // weights, so neither pass can put them out of it.
            fc.assert(fc.property(fc.array(lampSpecs, {minLength: 1, maxLength: 4}), (specs) =>
            {
                const voxels = openRoom();
                LightBlockSmoothingUtil.markOpenBlocks(voxels, openBlocks);
                const result = propagate(voxels, specs.map(toLight));

                const worstShare = (of: PropagationResult) =>
                {
                    let worst = 0;
                    for (let blockIndex = 0; blockIndex < NUM_VOXEL_BLOCKS; ++blockIndex)
                        worst = Math.max(worst, directionalShareAt(of, blockIndex));
                    return worst;
                };
                // Measured before the clamp the share is read through, so that a field genuinely out
                // of step shows up here rather than being quietly rounded back into range.
                const unclamped = (of: PropagationResult) =>
                {
                    let worst = 0;
                    for (let blockIndex = 0; blockIndex < NUM_VOXEL_BLOCKS; ++blockIndex)
                    {
                        const at = blockIndex * 3;
                        const luminance = getLightLuminance(of.light[at], of.light[at + 1],
                            of.light[at + 2]);
                        if (luminance <= 0)
                            continue;
                        worst = Math.max(worst, Math.hypot(of.flux[at], of.flux[at + 1],
                            of.flux[at + 2]) / luminance);
                    }
                    return worst;
                };

                expect(unclamped(result)).toBeLessThan(1 + 1e-4);
                expect(unclamped(smoothed(result))).toBeLessThan(1 + 1e-4);
                expect(worstShare(result)).toBeLessThanOrEqual(1);
            }), {numRuns: 15});
        });

        it("never leaves a surface darker for another lamp having been installed", () =>
        {
            // The whole of the section, asserted the way the room actually meets it: every block,
            // every way a surface in it could be turned, and the field smoothed exactly as it is
            // before the GPU ever sees it.
            const normals = [
                {x: 1, y: 0, z: 0}, {x: -1, y: 0, z: 0},
                {x: 0, y: 1, z: 0}, {x: 0, y: -1, z: 0},
                {x: 0, y: 0, z: 1}, {x: 0, y: 0, z: -1},
            ];
            fc.assert(fc.property(fc.array(lampSpecs, {minLength: 1, maxLength: 3}), lampSpecs,
                (installed, added) =>
                {
                    const voxels = openRoom();
                    LightBlockSmoothingUtil.markOpenBlocks(voxels, openBlocks);
                    const before = smoothed(propagate(voxels, installed.map(toLight)));
                    const after = smoothed(propagate(voxels,
                        [...installed, added].map(toLight)));

                    // Scanned into a single worst case and asserted once — a per-block assertion
                    // over a property test's runs costs minutes. Relative, since what accumulates
                    // near a lamp is orders of magnitude above what reaches the far wall, and the
                    // fields are held as floats.
                    let worstLoss = 0;
                    for (let blockIndex = 0; blockIndex < NUM_VOXEL_BLOCKS; ++blockIndex)
                    {
                        for (const normal of normals)
                        {
                            const wasLit = shadeAt(before, blockIndex, normal);
                            const nowLit = shadeAt(after, blockIndex, normal);
                            worstLoss = Math.max(worstLoss,
                                (wasLit - nowLit) / Math.max(wasLit, 1e-6));
                        }
                    }
                    expect(worstLoss).toBeLessThan(1e-4);
                }), {numRuns: 30});
        });
    });

    describe("reading the map back", () =>
    {
        // What the lamp the camera carries stands down for: it asks the map how well lit the
        // player's surroundings already are, and a room somebody has lit is then seen by its own
        // light rather than washed flat by a white one held at arm's length (see GraphicsManager).
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
            map.getNearbyLightAt(worldPos, probe);
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

        it("goes on reporting a lamp past its own light, and lets go of it gradually", () =>
        {
            // A lamp's pool is looked at from well outside the light it casts, so the head lamp has
            // to go on standing down there. And it has to come back as the player walks away
            // rather than all at once at the edge of the lamp's light, which would read as the
            // player's own lamp surging back on.
            const range = 6;
            const lamp = makeLight({range, colorR: 3, colorG: 3, colorB: 3});
            const map = new LightBlockMap();
            map.resetForRoom(openRoom());
            map.addLightSource("lamp", lamp);
            map.update();

            // Past everything the lamp's own light reaches, smoothing included.
            const pastItsLight = {row: 16 + range + 2, col: 16, collisionLayer: 3};
            LightBlockSmoothingUtil.markOpenBlocks(openRoom(), openBlocks);
            const standing = propagate(openRoom(), [lamp]);
            LightBlockSmoothingUtil.smooth(standing.light, smoothingScratch, openBlocks);
            expect(standing.at(pastItsLight.row, pastItsLight.col, pastItsLight.collisionLayer))
                .toBe(0);
            const pastItsLightNearby = luminanceAt(map,
                blockCenter(pastItsLight.row, pastItsLight.col, pastItsLight.collisionLayer));
            expect(pastItsLightNearby).toBeGreaterThan(0);

            // Walking away from the lamp, it only ever fades.
            let previous = luminanceAt(map, {x: 16.5, y: 1.75, z: 17.5});
            for (let z = 17.5; z <= 30.5; z += 0.25)
            {
                const here = luminanceAt(map, {x: 16.5, y: 1.75, z});
                expect(here).toBeLessThanOrEqual(previous + 1e-6);
                previous = here;
            }
            // And by the far side of the room it has let go of the lamp all but entirely.
            expect(luminanceAt(map, {x: 16.5, y: 1.75, z: 30.5}))
                .toBeLessThan(pastItsLightNearby * 0.05);
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
            map.getNearbyLightAt({x: 16.5, y: 1.75, z: 18.5}, probe);
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
