/**
 * Scenario tests: light propagation through the voxel grid (three.js-free; see LightBlockMap).
 * Covers occlusion (by whole blocks and, a sub-block at a time, by shrunk ones), falloff (matching three.js
 * point lights), range, arrival direction, order-independent accumulation, monotonicity, and nearness for
 * the head lamp (never through walls).
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
import LightSubBlockUtil from "../../../src/client/graphics/light/util/lightSubBlockUtil";
import LightBlockMap from "../../../src/client/graphics/light/maps/lightBlockMap";
import Voxel from "../../../src/shared/voxel/types/voxel";
import VoxelQuadsRuntimeMemory from "../../../src/shared/voxel/types/voxelQuadsRuntimeMemory";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import { NUM_COLLISION_LAYERS, NUM_VOXEL_BLOCKS, NUM_VOXEL_COLS, NUM_VOXEL_ROWS, NUM_VOXEL_SUB_BLOCKS,
    NUM_VOXEL_SUB_COLS, NUM_VOXEL_SUB_ROWS, VOXEL_BLOCK_SHAPE_EMPTY, VOXEL_BLOCK_SHAPE_WHOLE,
    VOXEL_SUB_BLOCK_SIZE } from "../../../src/shared/system/sharedConstants";
import { LIGHT_BLOCK_MAP_AMBIENT_SHARE, LIGHT_SOURCE_MIN_DISTANCE }
    from "../../../src/client/system/clientConstants";


// ─── Fixtures ───

/** The mask of a voxel holding a block in every layer. */
const FULL_COLLISION_LAYER_MASK = (1 << NUM_COLLISION_LAYERS) - 1;

/** A grid whose every voxel holds a whole block in each layer the given mask names. */
function makeVoxels(maskAt: (row: number, col: number) => number): Voxel[]
{
    const quadsMem = new VoxelQuadsRuntimeMemory();
    const voxels: Voxel[] = [];
    for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
    {
        for (let col = 0; col < NUM_VOXEL_COLS; ++col)
        {
            const mask = maskAt(row, col);
            for (let layer = 0; layer < NUM_COLLISION_LAYERS; ++layer)
            {
                if ((mask & (1 << layer)) != 0)
                    quadsMem.blockShapes[VoxelQueryUtil.getVoxelBlockIndex(row, col, layer)] = VOXEL_BLOCK_SHAPE_WHOLE;
            }
            voxels.push(new Voxel(quadsMem, row, col));
        }
    }
    return voxels;
}

/** Every voxel hollow, so light spreads unobstructed except at the floor, ceiling and grid edge. */
const openRoom = () => makeVoxels(() => 0);

/** Every voxel solid. */
const solidRoom = () => makeVoxels(() => FULL_COLLISION_LAYER_MASK);

/** Gives every block of a box of cells one shape (see VoxelBlockShapeUtil), from the floor to the ceiling. */
function setShapes(voxels: Voxel[], shape: number, box: {row: number, col: number, rows?: number, cols?: number}): Voxel[]
{
    for (let row = box.row; row < box.row + (box.rows ?? 1); ++row)
    {
        for (let col = box.col; col < box.col + (box.cols ?? 1); ++col)
        {
            for (let layer = 0; layer < NUM_COLLISION_LAYERS; ++layer)
                voxels[0].quadsMem.blockShapes[VoxelQueryUtil.getVoxelBlockIndex(row, col, layer)] = shape;
        }
    }
    return voxels;
}

// Sub-blocks by bit: (x half, z half) = (0, 0), (1, 0), (0, 1), (1, 1).
const LOW_X_HALF = 0b0101, HIGH_X_HALF = 0b1010, LOW_Z_HALF = 0b0011, HIGH_Z_HALF = 0b1100;
const LOW_X_LOW_Z_QUARTER = 0b0001;

type Point = {x: number, y: number, z: number};

/** Where the lights below stand unless told otherwise: the middle of a sub-block, in the middle of the room. */
const LAMP: Point = {x: 16.25, y: 1.75, z: 16.25};

/** A light standing in the open: its light comes out where it is measured from, unless told otherwise. */
function makeLight(overrides: Partial<LightSource> = {}): LightSource
{
    const worldPos = overrides.worldPos ?? {...LAMP};
    return {
        colorR: 1, colorG: 1, colorB: 1,
        range: 8,
        decay: 1,
        ...overrides,
        worldPos,
        outletPos: overrides.outletPos ?? worldPos,
    };
}

/** The sub-block holding a world point. */
function subBlockIndexAt(point: Point): number
{
    return VoxelQueryUtil.getVoxelSubBlockIndex(Math.floor(point.z / VOXEL_SUB_BLOCK_SIZE),
        Math.floor(point.x / VOXEL_SUB_BLOCK_SIZE), Math.floor(point.y / VOXEL_SUB_BLOCK_SIZE));
}

/** The world-space centre of a sub-block, which is where its light is measured. */
function subBlockCenter(subBlockIndex: number): Point
{
    const layer = subBlockIndex % NUM_COLLISION_LAYERS;
    const subCol = Math.floor(subBlockIndex / NUM_COLLISION_LAYERS) % NUM_VOXEL_SUB_COLS;
    const subRow = Math.floor(subBlockIndex / (NUM_COLLISION_LAYERS * NUM_VOXEL_SUB_COLS));
    return {
        x: (subCol + 0.5) * VOXEL_SUB_BLOCK_SIZE,
        y: (layer + 0.5) * VOXEL_SUB_BLOCK_SIZE,
        z: (subRow + 0.5) * VOXEL_SUB_BLOCK_SIZE,
    };
}

/** The world-space centre of a voxel block, which is where the head lamp's reading of a block stands. */
function blockCenter(row: number, col: number, collisionLayer: number): Point
{
    return {
        x: col + 0.5,
        y: VoxelQueryUtil.getWorldYAtVoxelCollisionLayerCenter(collisionLayer),
        z: row + 0.5,
    };
}

function distanceBetween(a: Point, b: Point): number
{
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

interface PropagationResult
{
    light: Float32Array;
    flux: Float32Array;
    isOpen: Uint8Array;
    /** Red channel of the sub-block holding a point, which every fixture here uses as "how much light is in it". */
    at: (point: Point) => number;
    fluxAt: (point: Point) => Point;
}

function propagate(voxels: Voxel[], lights: LightSource[]): PropagationResult
{
    const light = new Float32Array(NUM_VOXEL_SUB_BLOCKS * 3);
    const flux = new Float32Array(NUM_VOXEL_SUB_BLOCKS * 3);
    const isOpen = new Uint8Array(NUM_VOXEL_SUB_BLOCKS);
    LightSubBlockUtil.markOpen(voxels, isOpen);
    const scratch = new LightPropagationScratch();
    for (const lightSource of lights)
        LightBlockPropagationUtil.accumulate(isOpen, lightSource, light, flux, scratch);

    return {
        light,
        flux,
        isOpen,
        at: (point) => light[subBlockIndexAt(point) * 3],
        fluxAt: (point) => ({
            x: flux[subBlockIndexAt(point) * 3],
            y: flux[subBlockIndexAt(point) * 3 + 1],
            z: flux[subBlockIndexAt(point) * 3 + 2],
        }),
    };
}

/** The field as the map holds it before upload: its light and its direction smoothed in step. */
function smoothed(result: PropagationResult): PropagationResult
{
    LightBlockSmoothingUtil.smooth(result.light, result.flux, result.isOpen);
    return result;
}

// Scanned into one number and asserted once; per-entry assertions in property tests cost minutes.
function maxAbsoluteDifference(a: ArrayLike<number>, b: ArrayLike<number>): number
{
    let worst = 0;
    for (let i = 0; i < a.length; ++i)
        worst = Math.max(worst, Math.abs(a[i] - b[i]));
    return worst;
}

function everyEntry(values: ArrayLike<number>, predicate: (value: number) => boolean): boolean
{
    for (let i = 0; i < values.length; ++i)
    {
        if (!predicate(values[i]))
            return false;
    }
    return true;
}

/** How many sub-blocks hold light, among those the predicate picks. */
function countLit(result: PropagationResult, pick: (center: Point) => boolean): number
{
    let numLit = 0;
    for (let subBlockIndex = 0; subBlockIndex < NUM_VOXEL_SUB_BLOCKS; ++subBlockIndex)
    {
        if (result.light[subBlockIndex * 3] !== 0 && pick(subBlockCenter(subBlockIndex)))
            ++numLit;
    }
    return numLit;
}

// A lamp stands on a grid half a sub-block fine (see ObjectAttachmentUtil), in the middle of a sub-block or between
// two of them along any axis; these draw lamps from all of it, clear of the room's edge.
const HALF_SUB_BLOCK = 0.5 * VOXEL_SUB_BLOCK_SIZE;
const STEPS_PER_UNIT = 1 / HALF_SUB_BLOCK;
const lampPoints = fc.record({
    x: fc.integer({min: STEPS_PER_UNIT, max: STEPS_PER_UNIT * (NUM_VOXEL_COLS - 1)}),
    y: fc.integer({min: 1, max: 2 * NUM_COLLISION_LAYERS - 1}),
    z: fc.integer({min: STEPS_PER_UNIT, max: STEPS_PER_UNIT * (NUM_VOXEL_ROWS - 1)}),
}).map(steps => ({x: steps.x * HALF_SUB_BLOCK, y: steps.y * HALF_SUB_BLOCK, z: steps.z * HALF_SUB_BLOCK}));

//------------------------------------------------------------------------------

describe("Light propagation", () =>
{
    describe("occlusion", () =>
    {
        it("keeps a sealed room's light inside it", () =>
        {
            // One hollow voxel column, walled in on every side.
            const voxels = makeVoxels((row, col) =>
                (row === 16 && col === 16) ? 0 : FULL_COLLISION_LAYER_MASK);
            const result = propagate(voxels, [makeLight({range: 30})]);

            expect(result.at(LAMP)).toBeGreaterThan(0);
            expect(countLit(result, center => Math.floor(center.x) !== 16 || Math.floor(center.z) !== 16)).toBe(0);
        });

        it("leaves the far side of a wall dark, and lights it once the wall comes down", () =>
        {
            // A wall running the width of the room, one voxel thick, with the lamp on one side of it.
            const wallRow = 20;
            const walled = makeVoxels((row) => row === wallRow ? FULL_COLLISION_LAYER_MASK : 0);
            const unwalled = openRoom();
            const light = makeLight({range: 20});

            const behindWall = {x: LAMP.x, y: LAMP.y, z: wallRow + 1.25};

            expect(propagate(walled, [light]).at(behindWall)).toBe(0);
            expect(propagate(unwalled, [light]).at(behindWall)).toBeGreaterThan(0);
        });

        it("bends light around a corner, and charges it for the detour", () =>
        {
            // Light around a wall travels further, so it arrives dimmer.
            const wallRow = 20;
            // The wall stops short of the room's edge, leaving a gap light can come round through.
            const walled = makeVoxels((row, col) =>
                (row === wallRow && col < 25) ? FULL_COLLISION_LAYER_MASK : 0);
            const light = makeLight({range: 40});

            const target = {x: LAMP.x, y: LAMP.y, z: wallRow + 1.25};
            const bent = propagate(walled, [light]);
            const direct = propagate(openRoom(), [light]);

            expect(bent.at(target)).toBeGreaterThan(0);
            expect(bent.at(target)).toBeLessThan(direct.at(target));
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
            // A lamp must match a THREE.PointLight of the same range and decay.
            const light = makeLight({range: 8, decay: 1, colorR: 2});
            const result = propagate(openRoom(), [light]);

            // A lamp is treated as half a block across (point falloff is infinite at zero distance).
            expect(result.at(LAMP)).toBeCloseTo(2 * getDistanceAttenuation(LIGHT_SOURCE_MIN_DISTANCE, 8, 1), 5);

            // A sub-block is as far along any axis as it is tall.
            expect(result.at({...LAMP, x: LAMP.x + 1})).toBeCloseTo(2 * getDistanceAttenuation(1, 8, 1), 5);
            expect(result.at({...LAMP, x: LAMP.x + 1.5})).toBeCloseTo(2 * getDistanceAttenuation(1.5, 8, 1), 5);
            expect(result.at({...LAMP, y: LAMP.y + 1.5})).toBeCloseTo(2 * getDistanceAttenuation(1.5, 8, 1), 5);

            // Diagonally: distance is straight-line, not the grid route (3 + 3 is 6 by route, ~4.24 straight).
            expect(result.at({...LAMP, x: LAMP.x + 3, z: LAMP.z + 3}))
                .toBeCloseTo(2 * getDistanceAttenuation(Math.hypot(3, 3), 8, 1), 5);
        });

        it("measures from where the lamp stands, not from the middle of a sub-block", () =>
        {
            // Between two sub-blocks along x, as the middle of a lamp a cell wide is on its wall.
            const lamp = {x: 16.5, y: 1.75, z: 16.25};
            const result = propagate(openRoom(), [makeLight({worldPos: lamp, range: 8, decay: 1})]);

            for (const reach of [0.75, 1.25, 2.75])
            {
                const expected = getDistanceAttenuation(reach, 8, 1);
                expect(result.at({...lamp, x: lamp.x + reach}), `${reach} toward +x`).toBeCloseTo(expected, 5);
                expect(result.at({...lamp, x: lamp.x - reach}), `${reach} toward -x`).toBeCloseTo(expected, 5);
            }
        });

        it("places a lamp whose stored position came back a hair off as if it had not", () =>
        {
            // A position is stored in two bytes an axis, which no point of a lamp's grid survives exactly.
            const exact = propagate(openRoom(), [makeLight({worldPos: {x: 16.5, y: 1.75, z: 16.25}})]);
            for (const error of [-0.0004, 0.0004])
            {
                const decoded = propagate(openRoom(), [makeLight({
                    worldPos: {x: 16.5 + error, y: 1.75 - error, z: 16.25 + error}})]);
                expect(maxAbsoluteDifference(decoded.light, exact.light)).toBe(0);
                expect(maxAbsoluteDifference(decoded.flux, exact.flux)).toBe(0);
            }
        });

        it("never brightens with distance along a straight run", () =>
        {
            const result = propagate(openRoom(), [makeLight({range: 20})]);
            let previous = Number.POSITIVE_INFINITY;
            for (let x = LAMP.x; x < NUM_VOXEL_COLS - 1; x += VOXEL_SUB_BLOCK_SIZE)
            {
                const brightness = result.at({...LAMP, x});
                expect(brightness).toBeLessThanOrEqual(previous);
                previous = brightness;
            }
        });

        it("reaches nothing past its own range", () =>
        {
            const range = 5;
            const result = propagate(openRoom(), [makeLight({range})]);

            // Straight-line distance bounds the travelled distance, so nothing lit lies beyond range.
            expect(countLit(result, center => distanceBetween(center, LAMP) >= range)).toBe(0);
        });

        it("reaches a ball rather than a diamond, in an open room", () =>
        {
            // Grid routes are axis-aligned, so bounding by route length would cut light off on an octahedron
            // (a diamond). The straight-line ball is asserted instead: all inside is lit, nothing outside.
            const range = 7;
            const result = propagate(openRoom(), [makeLight({range})]);

            // Sub-blocks exactly at the range are float-ambiguous, so a hair either side is skipped.
            const boundaryTolerance = 1e-6;
            let numMisplaced = 0;
            for (let subBlockIndex = 0; subBlockIndex < NUM_VOXEL_SUB_BLOCKS; ++subBlockIndex)
            {
                const straightLineDistance = distanceBetween(subBlockCenter(subBlockIndex), LAMP);
                if (Math.abs(straightLineDistance - range) <= boundaryTolerance)
                    continue;
                if ((result.light[subBlockIndex * 3] > 0) !== (straightLineDistance < range))
                    ++numMisplaced;
            }
            expect(numMisplaced).toBe(0);
        });

        it("a wider range reaches at least as far as a narrower one", () =>
        {
            const near = propagate(openRoom(), [makeLight({range: 6})]);
            const far = propagate(openRoom(), [makeLight({range: 12})]);
            let numLost = 0;
            for (let subBlockIndex = 0; subBlockIndex < NUM_VOXEL_SUB_BLOCKS; ++subBlockIndex)
            {
                if (near.light[subBlockIndex * 3] > 0 && !(far.light[subBlockIndex * 3] > 0))
                    ++numLost;
            }
            expect(numLost).toBe(0);
        });
    });

    describe("directionality", () =>
    {
        it("records the direction light travelled, not the direction back to the lamp", () =>
        {
            const result = propagate(openRoom(), [makeLight({range: 20})]);

            // Sub-blocks on opposite sides of the lamp record opposite directions.
            const rightward = result.fluxAt({...LAMP, x: LAMP.x + 4});
            const leftward = result.fluxAt({...LAMP, x: LAMP.x - 4});
            expect(rightward.x).toBeGreaterThan(0);
            expect(leftward.x).toBeLessThan(0);
            expect(Math.abs(rightward.y)).toBeCloseTo(0, 6);
            expect(Math.abs(rightward.z)).toBeCloseTo(0, 6);

            const forward = result.fluxAt({...LAMP, z: LAMP.z + 4});
            expect(forward.z).toBeGreaterThan(0);
        });

        it("records no direction for the sub-block the lamp itself stands in the middle of", () =>
        {
            const result = propagate(openRoom(), [makeLight()]);
            const flux = result.fluxAt(LAMP);
            expect(flux.x).toBe(0);
            expect(flux.y).toBe(0);
            expect(flux.z).toBe(0);
        });

        it("lets the direction fade out inside the lamp's own size, rather than cut out", () =>
        {
            // Half a sub-block from a lamp standing between two: half way out to where a lamp's size ends.
            const lamp = {x: 16.5, y: 1.75, z: 16.25};
            const result = propagate(openRoom(), [makeLight({worldPos: lamp})]);
            const beside = {...lamp, x: lamp.x + HALF_SUB_BLOCK};

            const flux = result.fluxAt(beside);
            expect(flux.x).toBeCloseTo(result.at(beside) * HALF_SUB_BLOCK / LIGHT_SOURCE_MIN_DISTANCE, 5);
            expect(flux.y).toBe(0);
            expect(flux.z).toBe(0);
            // And the other way on the other side of it.
            expect(result.fluxAt({...lamp, x: lamp.x - HALF_SUB_BLOCK}).x).toBeCloseTo(-flux.x, 6);
        });

        it("points straight back at the lamp", () =>
        {
            // Direction is straight-line, not the axis-aligned route (which quantizes and bands).
            const lamp = makeLight({range: 12});
            const result = propagate(openRoom(), [lamp]);

            let worstAlignment = 1;
            for (let subBlockIndex = 0; subBlockIndex < NUM_VOXEL_SUB_BLOCKS; ++subBlockIndex)
            {
                const x = result.flux[subBlockIndex * 3];
                const y = result.flux[subBlockIndex * 3 + 1];
                const z = result.flux[subBlockIndex * 3 + 2];
                const length = Math.hypot(x, y, z);
                if (length === 0)
                    continue;

                const center = subBlockCenter(subBlockIndex);
                const awayFromLamp = {
                    x: center.x - lamp.worldPos.x,
                    y: center.y - lamp.worldPos.y,
                    z: center.z - lamp.worldPos.z,
                };
                const awayLength = Math.hypot(awayFromLamp.x, awayFromLamp.y, awayFromLamp.z);

                worstAlignment = Math.min(worstAlignment,
                    (x * awayFromLamp.x + y * awayFromLamp.y + z * awayFromLamp.z) / (length * awayLength));
            }
            expect(worstAlignment).toBeGreaterThan(0.99);
        });

        it("charges a sub-block for the detour rather than redirecting the light", () =>
        {
            // Straight-line direction points detoured light through the wall; accepted, since detoured
            // light is already dim.
            const wallRow = 20;
            const walled = makeVoxels((row, col) =>
                (row === wallRow && col < 25) ? FULL_COLLISION_LAYER_MASK : 0);
            const lamp = makeLight({range: 40});

            const target = {x: LAMP.x, y: LAMP.y, z: wallRow + 1.25};
            const roundTheCorner = propagate(walled, [lamp]).at(target);
            const headOn = propagate(openRoom(), [lamp]).at(target);

            expect(roundTheCorner).toBeGreaterThan(0);
            // The detour is several times longer and the penalty squared, so little arrives.
            expect(roundTheCorner).toBeLessThan(headOn * 0.2);
        });

        it("charges nothing for a route as short as an empty room's, wherever the lamp stands", () =>
        {
            // A lamp between sub-blocks starts from more than one; each must count as where the route began,
            // or light crossing to the other's side would be charged for a detour it never made. Nor is it
            // one for light to come out half a sub-block from where it is measured, as a wall lamp's does.
            const offsets = [{x: 0, y: 0, z: 0}, {x: 1, y: 0, z: 0}, {x: -1, y: 0, z: 0}, {x: 0, y: 0, z: 1},
                {x: 0, y: 0, z: -1}, {x: 0, y: 1, z: 0}, {x: 0, y: -1, z: 0}];
            fc.assert(fc.property(lampPoints, fc.constantFrom(...offsets), (worldPos, offset) =>
            {
                const range = 6;
                const outletPos = {x: worldPos.x + offset.x * HALF_SUB_BLOCK,
                    y: worldPos.y + offset.y * HALF_SUB_BLOCK, z: worldPos.z + offset.z * HALF_SUB_BLOCK};
                const result = propagate(openRoom(), [makeLight({worldPos, outletPos, range, decay: 1})]);

                let worstError = 0;
                for (let subBlockIndex = 0; subBlockIndex < NUM_VOXEL_SUB_BLOCKS; ++subBlockIndex)
                {
                    const distance = distanceBetween(subBlockCenter(subBlockIndex), worldPos);
                    if (distance >= range - 1e-6)
                        continue;
                    const expected = getDistanceAttenuation(
                        Math.max(LIGHT_SOURCE_MIN_DISTANCE, distance), range, 1);
                    worstError = Math.max(worstError, Math.abs(result.light[subBlockIndex * 3] - expected));
                }
                expect(worstError).toBeLessThan(1e-5);
            }), {numRuns: 25});
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
            let numTinted = 0;
            for (let subBlockIndex = 0; subBlockIndex < NUM_VOXEL_SUB_BLOCKS; ++subBlockIndex)
            {
                if (result.light[subBlockIndex * 3 + 1] !== 0 || result.light[subBlockIndex * 3 + 2] !== 0)
                    ++numTinted;
            }
            expect(numTinted).toBe(0);
            expect(result.at(LAMP)).toBeGreaterThan(0);
        });

        it("leaves every sub-block dark when there are no lights at all", () =>
        {
            const result = propagate(openRoom(), []);
            expect(result.light.some(value => value !== 0)).toBe(false);
            expect(result.flux.some(value => value !== 0)).toBe(false);
        });

        it("does not depend on the order the lights are supplied in", () =>
        {
            fc.assert(fc.property(
                fc.array(fc.record({
                    worldPos: lampPoints,
                    colorR: fc.float({min: Math.fround(0.1), max: 4, noNaN: true}),
                    range: fc.float({min: Math.fround(1.5), max: 12, noNaN: true}),
                }), {minLength: 2, maxLength: 5}),
                fc.integer({min: 0, max: 1000}),
                (specs, shuffleSeed) =>
                {
                    const voxels = openRoom();
                    const lights = specs.map(spec => makeLight(spec));

                    // A rotation suffices to catch state leaking between lights.
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
            // The fill resets only what it touched (cost scales with range); a missed reset lights an unlit room.
            const scratch = new LightPropagationScratch();
            const run = (voxels: Voxel[], light: LightSource) =>
            {
                const result = propagate(voxels, []);
                LightBlockPropagationUtil.accumulate(result.isOpen, light, result.light, result.flux, scratch);
                return result;
            };

            const first = run(openRoom(), makeLight({range: 20}));
            expect(first.light.some(value => value !== 0)).toBe(true);

            // The same scratch, now handed a room with nowhere for light to be.
            const second = run(solidRoom(), makeLight({range: 20}));
            expect(second.light.some(value => value !== 0)).toBe(false);

            // A light of another reach, whose brightness the scratch must not answer from the first one's.
            const other = run(openRoom(), makeLight({range: 9, decay: 0.5}));
            expect(maxAbsoluteDifference(other.light,
                propagate(openRoom(), [makeLight({range: 9, decay: 0.5})]).light)).toBe(0);

            // And the first light again, which must give the first result back exactly.
            const third = run(openRoom(), makeLight({range: 20}));
            expect(maxAbsoluteDifference(third.light, first.light)).toBe(0);
            expect(maxAbsoluteDifference(third.flux, first.flux)).toBe(0);
        });
    });

    describe("smoothing", () =>
    {
        it("never carries light across a solid block", () =>
        {
            // Smoothing must not blur light through walls.
            const wallRow = 20;
            const voxels = makeVoxels((row) => row === wallRow ? FULL_COLLISION_LAYER_MASK : 0);
            const result = smoothed(propagate(voxels, [makeLight({range: 30})]));

            // The near face of the wall is as bright as ever; nothing at all reaches past it.
            expect(result.at({...LAMP, z: wallRow - 0.25})).toBeGreaterThan(0);
            expect(countLit(result, center => center.z > wallRow)).toBe(0);
        });

        it("leaves a solid block dark even when it was never lit to begin with", () =>
        {
            const result = smoothed(propagate(solidRoom(), [makeLight({range: 20})]));
            expect(result.light.some(value => value !== 0)).toBe(false);
        });

        it("conserves a flat field rather than darkening it at the edges", () =>
        {
            // Weights renormalize by actual neighbours, or surfaces get dark rims at walls.
            const result = propagate(openRoom(), []);
            result.light.fill(1);
            smoothed(result);
            expect(everyEntry(result.light, value => Math.abs(value - 1) < 1e-5)).toBe(true);
        });

        it("gives what a sweep of every sub-block would, though it visits only those near light", () =>
        {
            // The plain kernel, a sub-block at a time along each axis in turn: half of itself and a quarter of
            // each open neighbour, renormalized over those that took part.
            const strides = [1, NUM_COLLISION_LAYERS, NUM_COLLISION_LAYERS * NUM_VOXEL_SUB_COLS];
            const lengths = [NUM_COLLISION_LAYERS, NUM_VOXEL_SUB_COLS, NUM_VOXEL_SUB_ROWS];
            const sweepEverySubBlock = (field: Float32Array, isOpen: Uint8Array): Float32Array =>
            {
                let source = field;
                for (let axis = 0; axis < 3; ++axis)
                {
                    const target = new Float32Array(source.length);
                    for (let subBlockIndex = 0; subBlockIndex < NUM_VOXEL_SUB_BLOCKS; ++subBlockIndex)
                    {
                        if (isOpen[subBlockIndex] === 0)
                            continue;
                        const position = Math.floor(subBlockIndex / strides[axis]) % lengths[axis];
                        const neighbors: number[] = [];
                        if (position > 0 && isOpen[subBlockIndex - strides[axis]] === 1)
                            neighbors.push(subBlockIndex - strides[axis]);
                        if (position < lengths[axis] - 1 && isOpen[subBlockIndex + strides[axis]] === 1)
                            neighbors.push(subBlockIndex + strides[axis]);
                        for (let channel = 0; channel < 3; ++channel)
                        {
                            let sum = 0.5 * source[subBlockIndex * 3 + channel];
                            for (const neighbor of neighbors)
                                sum += 0.25 * source[neighbor * 3 + channel];
                            target[subBlockIndex * 3 + channel] = sum / (0.5 + 0.25 * neighbors.length);
                        }
                    }
                    source = target;
                }
                return source;
            };

            // Thin and whole walls, posts and a lone block for the light to meet, some of them at the room's edge.
            const voxels = makeVoxels((row, col) => (row === 9 && col > 3) ? FULL_COLLISION_LAYER_MASK : 0);
            setShapes(voxels, HIGH_Z_HALF, {row: 22, col: 0, cols: 20});
            setShapes(voxels, LOW_X_HALF, {row: 12, col: 25, rows: 8});
            setShapes(voxels, LOW_X_LOW_Z_QUARTER, {row: 14, col: 10, rows: 2, cols: 2});
            setShapes(voxels, VOXEL_BLOCK_SHAPE_WHOLE, {row: 0, col: 0});

            fc.assert(fc.property(fc.array(fc.record({
                worldPos: lampPoints,
                colorR: fc.integer({min: 1, max: 400}).map(hundredths => hundredths / 100),
                colorB: fc.integer({min: 0, max: 400}).map(hundredths => hundredths / 100),
                range: fc.integer({min: 2, max: 9}),
            }), {minLength: 1, maxLength: 3}), (specs) =>
            {
                const result = propagate(voxels, specs.map(spec => makeLight(spec)));
                const expectedLight = sweepEverySubBlock(result.light, result.isOpen);
                const expectedFlux = sweepEverySubBlock(result.flux, result.isOpen);
                smoothed(result);

                expect(maxAbsoluteDifference(result.light, expectedLight)).toBeLessThan(1e-5);
                expect(maxAbsoluteDifference(result.flux, expectedFlux)).toBeLessThan(1e-5);
            }), {numRuns: 20});
        });

        it("forgets the light of the run before", () =>
        {
            // Its scratch outlives a run, and a sweep leaves alone whatever it does not visit.
            const far = smoothed(propagate(openRoom(), [makeLight({worldPos: {x: 4.25, y: 1.75, z: 4.25}, range: 5})]));
            expect(far.at({x: 4.25, y: 1.75, z: 4.25})).toBeGreaterThan(0);

            // (Clear of the room's edges, where renormalizing keeps a sum only nearly.)
            const near = propagate(openRoom(), [makeLight({worldPos: {x: 27.25, y: 4.25, z: 27.25}, range: 3})]);
            const before = Array.from(near.light);
            smoothed(near);
            expect(countLit(near, center => distanceBetween(center, {x: 27.25, y: 4.25, z: 27.25}) > 5)).toBe(0);
            expect(near.light.reduce((sum, value) => sum + value, 0))
                .toBeCloseTo(before.reduce((sum, value) => sum + value, 0), 2);
        });
    });

    describe("nearness", () =>
    {
        // The head lamp dims for the brightest nearby light, discounted by distance (see
        // LightBlockDilationUtil), so a lamp's pool viewed from outside isn't washed out. It reads the room a
        // block at a time (see LightSubBlockUtil.averageOverBlocks).

        const blockLight = new Float32Array(NUM_VOXEL_BLOCKS * 3);
        const openBlocks = new Uint8Array(NUM_VOXEL_BLOCKS);
        const nearbyLight = new Float32Array(NUM_VOXEL_BLOCKS * 3);

        /** The room's light a block at a time, as the map holds it for the head lamp: smoothed, then averaged. */
        function averagedLight(voxels: Voxel[], lights: LightSource[]): PropagationResult
        {
            const result = smoothed(propagate(voxels, lights));
            LightSubBlockUtil.averageOverBlocks(result.light, result.isOpen, blockLight, openBlocks);
            return result;
        }

        const blockLightAt = (buffer: Float32Array, row: number, col: number, collisionLayer: number) =>
            buffer[VoxelQueryUtil.getVoxelBlockIndex(row, col, collisionLayer) * 3];

        it("reads a block as the mean of its open sub-blocks, and one no more than half open as a wall", () =>
        {
            const voxels = openRoom();
            setShapes(voxels, LOW_X_LOW_Z_QUARTER, {row: 5, col: 5});
            setShapes(voxels, HIGH_X_HALF, {row: 5, col: 7});
            setShapes(voxels, VOXEL_BLOCK_SHAPE_WHOLE, {row: 5, col: 9});

            const result = propagate(voxels, []);
            // A different light in each sub-block, and light in the filled ones too, which must not count.
            for (let subBlockIndex = 0; subBlockIndex < NUM_VOXEL_SUB_BLOCKS; ++subBlockIndex)
                result.light[subBlockIndex * 3] = 1 + subBlockCenter(subBlockIndex).x + 10 * subBlockCenter(subBlockIndex).z;
            LightSubBlockUtil.averageOverBlocks(result.light, result.isOpen, blockLight, openBlocks);

            const lightAt = (x: number, z: number) => 1 + x + 10 * z;
            const layer = 3;
            const isOpenAt = (row: number, col: number) => openBlocks[VoxelQueryUtil.getVoxelBlockIndex(row, col, layer)];

            // An empty cell: all four.
            expect(isOpenAt(5, 3)).toBe(1);
            expect(blockLightAt(blockLight, 5, 3, layer)).toBeCloseTo(
                (lightAt(3.25, 5.25) + lightAt(3.75, 5.25) + lightAt(3.25, 5.75) + lightAt(3.75, 5.75)) / 4, 3);
            // Beside a post: the three it leaves.
            expect(isOpenAt(5, 5)).toBe(1);
            expect(blockLightAt(blockLight, 5, 5, layer)).toBeCloseTo(
                (lightAt(5.75, 5.25) + lightAt(5.25, 5.75) + lightAt(5.75, 5.75)) / 3, 3);
            // A thin wall's cell and a whole block's: closed, and dark.
            for (const col of [7, 9])
            {
                expect(isOpenAt(5, col), `col ${col}`).toBe(0);
                expect(blockLightAt(blockLight, 5, col, layer), `col ${col}`).toBe(0);
            }
        });

        it("agrees with a search of the whole room, in an open room", () =>
        {
            // The per-axis sweep must equal a brute-force search (a bell curve over straight-line
            // distance), ruling out lossy sweeps and diamond-shaped reach.
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

                    // Relative error, except near zero where only the absolute difference is meaningful.
                    worstError = Math.max(worstError,
                        Math.abs(luminanceOf(nearbyLight, blockIndex) - bestLight) /
                        Math.max(bestLight, 1e-12));

                    // The color is the winning block's; only checked where the winner is unambiguous.
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
            // Nearness only adds reach: never less than the light at the point alone.
            fc.assert(fc.property(fc.array(fc.record({
                worldPos: lampPoints,
                colorR: fc.float({min: Math.fround(0.1), max: 4, noNaN: true}),
                range: fc.float({min: Math.fround(1.5), max: 12, noNaN: true}),
            }), {minLength: 1, maxLength: 3}), (specs) =>
            {
                averagedLight(openRoom(), specs.map(spec => makeLight(spec)));
                LightBlockDilationUtil.dilate(blockLight, nearbyLight, openBlocks);

                let worstShortfall = 0;
                for (let blockIndex = 0; blockIndex < NUM_VOXEL_BLOCKS; ++blockIndex)
                {
                    const at = blockIndex * 3;
                    const standing = getLightLuminance(blockLight[at], blockLight[at + 1], blockLight[at + 2]);
                    const near = getLightLuminance(nearbyLight[at], nearbyLight[at + 1],
                        nearbyLight[at + 2]);
                    worstShortfall = Math.max(worstShortfall,
                        (standing - near) / Math.max(standing, 1e-6));
                }
                expect(worstShortfall).toBeLessThan(1e-5);
            }), {numRuns: 15});
        });

        it("never carries light through a wall, be it a whole block thick or half a cell", () =>
        {
            // A lamp behind a wall isn't near, so a walled-off player keeps their head lamp.
            const wallRow = 20;
            for (const shape of [VOXEL_BLOCK_SHAPE_WHOLE, LOW_Z_HALF, HIGH_Z_HALF])
            {
                averagedLight(setShapes(openRoom(), shape, {row: wallRow, col: 0, cols: NUM_VOXEL_COLS}),
                    [makeLight({range: 30})]);
                LightBlockDilationUtil.dilate(blockLight, nearbyLight, openBlocks);

                expect(blockLightAt(nearbyLight, wallRow - 1, 16, 3), `shape ${shape}`).toBeGreaterThan(0);
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
                expect(brightestPastTheWall, `shape ${shape}`).toBe(0);
            }
        });
    });

    describe("never darkening what it reaches", () =>
    {
        // Installing a light never removes light. The amount is monotone by construction; the direction
        // (one vector per sub-block) isn't, hence the recorded directional share.

        /** Fraction of a sub-block's light that is directional (see LightBlockMap). */
        function directionalShareAt(result: PropagationResult, subBlockIndex: number): number
        {
            const at = subBlockIndex * 3;
            const luminance = getLightLuminance(result.light[at], result.light[at + 1],
                result.light[at + 2]);
            if (luminance <= 0)
                return 0;
            return Math.min(1, Math.hypot(result.flux[at], result.flux[at + 1],
                result.flux[at + 2]) / luminance);
        }

        /** What a surface with this normal receives (LIGHT_BLOCK_MAP_FRAGMENT_GLSL's arithmetic, on the CPU). */
        function shadeAt(result: PropagationResult, subBlockIndex: number, normal: Point): number
        {
            const at = subBlockIndex * 3;
            const lit = getLightLuminance(result.light[at], result.light[at + 1],
                result.light[at + 2]);
            const fluxX = result.flux[at], fluxY = result.flux[at + 1], fluxZ = result.flux[at + 2];
            const fluxLength = Math.hypot(fluxX, fluxY, fluxZ);
            // Light travels *along* the flux, so a surface faces it when its normal opposes it.
            const facing = (fluxLength > 0)
                ? Math.max(0, -(normal.x * fluxX + normal.y * fluxY + normal.z * fluxZ) / fluxLength)
                : 0;
            const reach = 1 - directionalShareAt(result, subBlockIndex) * (1 - facing);
            return lit * (LIGHT_BLOCK_MAP_AMBIENT_SHARE +
                (1 - LIGHT_BLOCK_MAP_AMBIENT_SHARE) * reach);
        }

        // Realistic quantized channels (zero or hundredths): denormal floats would test storage precision,
        // not propagation.
        const lightChannels = fc.integer({min: 0, max: 400}).map(hundredths => hundredths / 100);
        const lampSpecs = fc.record({
            worldPos: lampPoints,
            // Zero included on every channel, so unlit lamps are covered.
            colorR: lightChannels,
            colorG: lightChannels,
            colorB: lightChannels,
            range: fc.float({min: Math.fround(1.5), max: 12, noNaN: true}),
        });

        it("takes nothing at all from the room for a light with no light in it", () =>
        {
            // A black fitting lights nothing, so it must not sway the direction.
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
            // Two equidistant lamps, one nearly unlit: route-only weighting would cancel the direction.
            const bright = makeLight({worldPos: {x: 12.25, y: 1.75, z: 16.25}, range: 20});
            const nearlyDark = makeLight({worldPos: {x: 20.25, y: 1.75, z: 16.25},
                colorR: 0.01, colorG: 0.01, colorB: 0.01, range: 20});

            const result = propagate(openRoom(), [bright, nearlyDark]);
            // Light from the bright lamp travels toward increasing x to arrive here.
            expect(result.fluxAt(LAMP).x).toBeGreaterThan(0);
            // Nearly all the light here is directional, toward the bright lamp.
            expect(directionalShareAt(result, subBlockIndexAt(LAMP))).toBeGreaterThan(0.9);
        });

        it("lights a surface between two facing lamps more than one lamp does, not less", () =>
        {
            // Light from both sides nearly cancels; a dim lamp must not flip the leftover direction and leave
            // a surface darker under two lamps than under one.
            const towardFirstLamp = {x: -1, y: 0, z: 0};
            const target = subBlockIndexAt(LAMP);
            const first = makeLight({worldPos: {x: 12.25, y: 1.75, z: 16.25}, range: 20});
            const second = makeLight({worldPos: {x: 20.25, y: 1.75, z: 16.25}, range: 20,
                colorR: 1.1, colorG: 1.1, colorB: 1.1});

            const alone = propagate(openRoom(), [first]);
            const facing = propagate(openRoom(), [first, second]);

            // The surface faces the first lamp, so only the second lamp's contribution is at stake.
            expect(shadeAt(alone, target, towardFirstLamp))
                .toBeCloseTo(getLightLuminance(alone.light[target * 3], alone.light[target * 3 + 1],
                    alone.light[target * 3 + 2]), 5);
            expect(shadeAt(facing, target, towardFirstLamp))
                .toBeGreaterThan(shadeAt(alone, target, towardFirstLamp));
        });

        it("never records more direction than there is light to carry it", () =>
        {
            // The directional share is a ratio of two fields accumulated and smoothed in step.
            fc.assert(fc.property(fc.array(lampSpecs, {minLength: 1, maxLength: 4}), (specs) =>
            {
                const result = propagate(openRoom(), specs.map(spec => makeLight(spec)));

                const worstShare = (of: PropagationResult) =>
                {
                    let worst = 0;
                    for (let subBlockIndex = 0; subBlockIndex < NUM_VOXEL_SUB_BLOCKS; ++subBlockIndex)
                        worst = Math.max(worst, directionalShareAt(of, subBlockIndex));
                    return worst;
                };
                // Measured before the shader's clamp, so out-of-step fields show.
                const unclamped = (of: PropagationResult) =>
                {
                    let worst = 0;
                    for (let subBlockIndex = 0; subBlockIndex < NUM_VOXEL_SUB_BLOCKS; ++subBlockIndex)
                    {
                        const at = subBlockIndex * 3;
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
            // Every sub-block and every normal, with the field smoothed as before upload.
            const normals = [
                {x: 1, y: 0, z: 0}, {x: -1, y: 0, z: 0},
                {x: 0, y: 1, z: 0}, {x: 0, y: -1, z: 0},
                {x: 0, y: 0, z: 1}, {x: 0, y: 0, z: -1},
            ];
            fc.assert(fc.property(fc.array(lampSpecs, {minLength: 1, maxLength: 3}), lampSpecs,
                (installed, added) =>
                {
                    const voxels = openRoom();
                    const before = smoothed(propagate(voxels, installed.map(spec => makeLight(spec))));
                    const after = smoothed(propagate(voxels,
                        [...installed, added].map(spec => makeLight(spec))));

                    // Worst case scanned and asserted once (per-sub-block assertions cost minutes); relative,
                    // since values span orders of magnitude.
                    let worstLoss = 0;
                    for (let subBlockIndex = 0; subBlockIndex < NUM_VOXEL_SUB_BLOCKS; ++subBlockIndex)
                    {
                        // Unlit before, so with nothing to lose.
                        if (before.light[subBlockIndex * 3] === 0 && before.light[subBlockIndex * 3 + 1] === 0 &&
                            before.light[subBlockIndex * 3 + 2] === 0)
                            continue;
                        for (const normal of normals)
                        {
                            const wasLit = shadeAt(before, subBlockIndex, normal);
                            const nowLit = shadeAt(after, subBlockIndex, normal);
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
        // The head lamp asks the map how lit the surroundings are, and dims in lit rooms (see GraphicsManager).
        function mapWithLampAt(worldPos: Point): LightBlockMap
        {
            const map = new LightBlockMap();
            map.resetForRoom(openRoom());
            map.addLightSource("lamp", makeLight({worldPos, range: 20, colorR: 2, colorG: 2, colorB: 2}));
            map.update();
            return map;
        }

        const probe = new THREE.Color();
        const luminanceAt = (map: LightBlockMap, worldPos: Point) =>
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
            // The head lamp stays dimmed near a lamp's pool and returns gradually with distance.
            const range = 6;
            const lamp = makeLight({worldPos: {x: 16.5, y: 1.75, z: 16.5}, range, colorR: 3, colorG: 3, colorB: 3});
            const map = new LightBlockMap();
            map.resetForRoom(openRoom());
            map.addLightSource("lamp", lamp);
            map.update();

            // Past everything the lamp's own light reaches, smoothing included.
            const pastItsLight = {x: 16.5, y: 1.75, z: 16.5 + range + 2};
            const standing = smoothed(propagate(openRoom(), [lamp]));
            expect(standing.at(pastItsLight)).toBe(0);
            const pastItsLightNearby = luminanceAt(map, pastItsLight);
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

        it("goes dark again once its last lamp is taken away, and stays so through block edits", () =>
        {
            // A lampless room is skipped rather than worked out, which must not leave the last lamp's light standing.
            const map = mapWithLampAt({x: 16.5, y: 1.75, z: 16.5});
            expect(luminanceAt(map, {x: 16.5, y: 1.75, z: 17.5})).toBeGreaterThan(0);

            map.removeLightSource("lamp");
            map.update();
            expect(luminanceAt(map, {x: 16.5, y: 1.75, z: 17.5})).toBe(0);

            map.requestRecomputation();
            map.update();
            expect(luminanceAt(map, {x: 16.5, y: 1.75, z: 17.5})).toBe(0);

            // And a lamp put back lights it as before.
            map.addLightSource("lamp", makeLight({worldPos: {x: 16.5, y: 1.75, z: 16.5}, range: 20,
                colorR: 2, colorG: 2, colorB: 2}));
            map.update();
            expect(luminanceAt(map, {x: 16.5, y: 1.75, z: 17.5}))
                .toBe(luminanceAt(mapWithLampAt({x: 16.5, y: 1.75, z: 16.5}), {x: 16.5, y: 1.75, z: 17.5}));
        });

        it("forgets the lamps of a room it has left", () =>
        {
            const map = mapWithLampAt({x: 16.5, y: 1.75, z: 16.5});
            map.resetForRoom(undefined);
            map.update();
            expect(luminanceAt(map, {x: 16.5, y: 1.75, z: 17.5})).toBe(0);
            expect(map.hasLightSources()).toBe(false);
        });

        it("follows a lamp that is moved, by both of its points", () =>
        {
            const map = mapWithLampAt({x: 6.5, y: 1.75, z: 6.5});
            const far = {x: 26.5, y: 1.75, z: 26.5};
            const before = luminanceAt(map, far);

            map.setLightSourcePosition("lamp", far, far);
            map.update();
            expect(luminanceAt(map, far)).toBeGreaterThan(before * 2);
            expect(luminanceAt(map, far)).toBe(luminanceAt(mapWithLampAt(far), far));

            // Its outlet alone, into a block: it goes out.
            const voxels = setShapes(openRoom(), VOXEL_BLOCK_SHAPE_WHOLE, {row: 20, col: 20});
            const walled = new LightBlockMap();
            walled.resetForRoom(voxels);
            walled.addLightSource("lamp", makeLight({worldPos: far, range: 20}));
            walled.update();
            expect(luminanceAt(walled, far)).toBeGreaterThan(0);
            walled.setLightSourcePosition("lamp", far, {x: 20.25, y: 1.75, z: 20.25});
            walled.update();
            expect(luminanceAt(walled, far)).toBe(0);
        });

        it("keeps its colour rather than reporting only how much", () =>
        {
            // The head lamp also takes the room's color, so the result is a color, not a scalar.
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
            // Solid blocks hold no light but aren't dark surroundings; reading them as dark would restore
            // the head lamp right where the player looks. A thin wall's cell is no different.
            const wallCol = 8;
            for (const shape of [VOXEL_BLOCK_SHAPE_WHOLE, HIGH_X_HALF, LOW_X_HALF])
            {
                const voxels = setShapes(openRoom(), shape, {row: 0, col: wallCol, rows: NUM_VOXEL_ROWS});
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
                    expect(here, `shape ${shape}, x ${x}`).toBeGreaterThan(previous * 0.75);
                    previous = here;
                }
            }
        });

        it("still reads the light standing where no block around is open", () =>
        {
            // A passage a cell wide between two thin walls, each in the far half of its own cells: all of its
            // air lies in blocks the head lamp's reading takes for walls.
            const voxels = openRoom();
            setShapes(voxels, LOW_Z_HALF, {row: 15, col: 0, cols: NUM_VOXEL_COLS});
            setShapes(voxels, HIGH_Z_HALF, {row: 16, col: 0, cols: NUM_VOXEL_COLS});
            const map = new LightBlockMap();
            map.resetForRoom(voxels);
            map.addLightSource("lamp", makeLight({worldPos: {x: 16.25, y: 1.75, z: 16}, range: 10,
                colorR: 3, colorG: 3, colorB: 3}));
            map.update();

            expect(luminanceAt(map, {x: 12.5, y: 1.75, z: 16})).toBeGreaterThan(0);
            expect(luminanceAt(map, {x: 12.5, y: 1.75, z: 15.75})).toBeGreaterThan(0);
            // And nothing of it outside, past either wall.
            expect(luminanceAt(map, {x: 12.5, y: 1.75, z: 14.5})).toBe(0);
            expect(luminanceAt(map, {x: 12.5, y: 1.75, z: 17.5})).toBe(0);
        });

        it("changes smoothly rather than block by block", () =>
        {
            // Stepping between blocks must not step the head lamp's brightness.
            const map = mapWithLampAt({x: 16.5, y: 1.75, z: 16.5});
            const along = (z: number) => luminanceAt(map, {x: 16.5, y: 1.75, z});
            const stride = 0.05;
            let previous = along(18.5);
            let worstJump = 0;
            for (let z = 18.5; z <= 24.5; z += stride)
            {
                const here = along(z);
                worstJump = Math.max(worstJump, Math.abs(here - previous));
                previous = here;
            }

            // A twentieth-block move changes it by no more than its share of the steepest fall from one block's
            // middle to the next: a straight line between them, not a step at the border.
            let steepestFall = 0;
            for (let z = 18.5; z < 24.5; ++z)
                steepestFall = Math.max(steepestFall, Math.abs(along(z + 1) - along(z)));
            expect(steepestFall).toBeGreaterThan(0);
            expect(worstJump).toBeLessThan(steepestFall * stride * 1.01);
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

    describe("shrunk blocks", () =>
    {
        // Light is kept a sub-block at a time, so it fills what a shrunk block leaves of its cell and stops at
        // the rest (see LightSubBlockUtil).
        const wallRow = 20;
        const y = LAMP.y;
        const thinWall = (shape: number) => setShapes(openRoom(), shape, {row: wallRow, col: 0, cols: NUM_VOXEL_COLS});

        it("are open to light exactly where they leave their cell empty", () =>
        {
            const isOpen = new Uint8Array(NUM_VOXEL_SUB_BLOCKS);
            const openAt = (shape: number, x: number, z: number) =>
            {
                LightSubBlockUtil.markOpen(setShapes(openRoom(), shape, {row: wallRow, col: 16}), isOpen);
                return isOpen[subBlockIndexAt({x: 16 + x, y, z: wallRow + z})];
            };
            const quarters = [{x: 0.25, z: 0.25, bit: 0b0001}, {x: 0.75, z: 0.25, bit: 0b0010},
                {x: 0.25, z: 0.75, bit: 0b0100}, {x: 0.75, z: 0.75, bit: 0b1000}];
            for (const shape of [VOXEL_BLOCK_SHAPE_EMPTY, VOXEL_BLOCK_SHAPE_WHOLE, LOW_X_HALF, HIGH_X_HALF,
                LOW_Z_HALF, HIGH_Z_HALF, 0b0001, 0b0010, 0b0100, 0b1000])
            {
                for (const quarter of quarters)
                {
                    expect(openAt(shape, quarter.x, quarter.z), `shape ${shape.toString(2)} at ${quarter.x}, ${quarter.z}`)
                        .toBe((shape & quarter.bit) ? 0 : 1);
                }
            }

            // A room that is not there has nowhere for light to be.
            LightSubBlockUtil.markOpen(undefined, isOpen);
            expect(isOpen.some(value => value !== 0)).toBe(false);
        });

        it("stop light where they stand and nowhere else", () =>
        {
            const light = makeLight({range: 20});
            const behindWall = {...LAMP, z: wallRow + 1.25};

            // A wall half a cell thick shadows as a whole one does, whichever half of its cells it fills.
            for (const half of [LOW_Z_HALF, HIGH_Z_HALF])
                expect(propagate(thinWall(half), [light]).at(behindWall), `${half.toString(2)}`).toBe(0);
            // A row of posts does not, and neither does a wall standing along the light's way rather than across it.
            expect(propagate(thinWall(LOW_X_LOW_Z_QUARTER), [light]).at(behindWall)).toBeGreaterThan(0);
            expect(propagate(thinWall(LOW_X_HALF), [light]).at(behindWall)).toBeGreaterThan(0);
        });

        it("leave light in the half of a thin wall's cell that the wall does not fill", () =>
        {
            // The wall fills the far half of its cells, so their near half is open air, in front of its face.
            const result = smoothed(propagate(thinWall(HIGH_Z_HALF), [makeLight({range: 20})]));
            const inFrontOfFace = {...LAMP, z: wallRow + 0.25};
            expect(result.at(inFrontOfFace)).toBeGreaterThan(0);
            // As much as the air just before it holds, or nearly: it is no darker for lying in the wall's cell.
            expect(result.at(inFrontOfFace)).toBeGreaterThan(0.8 * result.at({...LAMP, z: wallRow - 0.25}));
            // And none inside the wall or past it.
            expect(countLit(result, center => center.z > wallRow + 0.5)).toBe(0);
        });

        it("let light through a window that two half blocks narrow from either side", () =>
        {
            // A whole wall with one opening, two cells wide; each cell of it half filled, from its outer side.
            const voxels = makeVoxels((row) => row === wallRow ? FULL_COLLISION_LAYER_MASK : 0);
            setShapes(voxels, LOW_X_HALF, {row: wallRow, col: 15});
            setShapes(voxels, HIGH_X_HALF, {row: wallRow, col: 16});
            const result = smoothed(propagate(voxels, [makeLight({worldPos: {x: 16, y, z: 16.25}, range: 20})]));

            // The opening is the two half cells left between them, lit through to the room beyond.
            for (const x of [15.75, 16.25])
            {
                expect(result.at({x, y, z: wallRow + 0.25}), `opening at x ${x}, near`).toBeGreaterThan(0);
                expect(result.at({x, y, z: wallRow + 0.75}), `opening at x ${x}, far`).toBeGreaterThan(0);
            }
            expect(result.at({x: 16.25, y, z: wallRow + 1.25})).toBeGreaterThan(0);

            // With the opening filled in, nothing passes.
            setShapes(voxels, VOXEL_BLOCK_SHAPE_WHOLE, {row: wallRow, col: 15, cols: 2});
            expect(countLit(propagate(voxels, [makeLight({worldPos: {x: 16, y, z: 16.25}, range: 20})]),
                center => center.z > wallRow)).toBe(0);
        });

        /** A lamp as the game hands one over (see the LightSource component): on a face, shining the way it looks. */
        function lampOn(face: Point, facing: Point, overrides: Partial<LightSource> = {}): LightSource
        {
            const out = (reachAlongXZ: number, reachAlongY: number) => ({x: face.x + reachAlongXZ * facing.x,
                y: face.y + reachAlongY * facing.y, z: face.z + reachAlongXZ * facing.z});
            return makeLight({worldPos: out(0.5, 0.25), outletPos: out(0.25, 0.25), ...overrides});
        }

        it("leave a lamp on a thin wall's inner face to light its own side alone", () =>
        {
            // The wall fills the higher-z half of its cells; the lamp hangs on the face across their middle.
            const voxels = thinWall(HIGH_Z_HALF);
            const result = propagate(voxels, [lampOn({x: 16.5, y, z: wallRow + 0.5}, {x: 0, y: 0, z: -1}, {range: 20})]);
            expect(result.at({...LAMP, z: wallRow + 0.25})).toBeGreaterThan(0);
            expect(result.at({...LAMP, z: wallRow - 0.75})).toBeGreaterThan(0);
            expect(countLit(result, center => center.z > wallRow + 0.5)).toBe(0);

            // On the wall's other face, it lights the other side alone.
            const behind = propagate(voxels, [lampOn({x: 16.5, y, z: wallRow + 1}, {x: 0, y: 0, z: 1}, {range: 20})]);
            expect(behind.at({...LAMP, z: wallRow + 1.25})).toBeGreaterThan(0);
            expect(countLit(behind, center => center.z < wallRow + 1)).toBe(0);
        });

        it("put out a lamp they are built over, though its light is measured from beyond them", () =>
        {
            // A lamp on a whole wall, looking toward -z, and half a cell of block flush against its face.
            const wall = () => makeVoxels((row) => row === wallRow ? FULL_COLLISION_LAYER_MASK : 0);
            const lamp = lampOn({x: 16.5, y, z: wallRow}, {x: 0, y: 0, z: -1}, {range: 20});
            expect(propagate(wall(), [lamp]).at({...LAMP, z: wallRow - 0.25})).toBeGreaterThan(0);

            const covered = propagate(setShapes(wall(), HIGH_Z_HALF, {row: wallRow - 1, col: 16}), [lamp]);
            expect(everyEntry(covered.light, value => value === 0)).toBe(true);

            // Covered across half its width only, it still shines from the other half.
            const halfCovered = propagate(setShapes(wall(), 0b1000, {row: wallRow - 1, col: 16}), [lamp]);
            expect(halfCovered.at({x: 16.75, y, z: wallRow - 0.25})).toBe(0);
            expect(halfCovered.at({x: 16.25, y, z: wallRow - 0.25})).toBeGreaterThan(0);
            expect(halfCovered.at({x: 16.75, y, z: wallRow - 0.75})).toBeGreaterThan(0);
        });

        it("leave a lamp to light the gap between its wall and a thin one facing it", () =>
        {
            // Half a cell of air in front of the lamp, then a wall half a cell thick: the light is measured
            // from that wall's face, and stays on the lamp's side of it.
            const voxels = makeVoxels((row) => row === wallRow ? FULL_COLLISION_LAYER_MASK : 0);
            setShapes(voxels, LOW_Z_HALF, {row: wallRow - 1, col: 0, cols: NUM_VOXEL_COLS});
            const result = propagate(voxels, [lampOn({x: 16.5, y, z: wallRow}, {x: 0, y: 0, z: -1}, {range: 20})]);

            expect(result.at({...LAMP, z: wallRow - 0.25})).toBeGreaterThan(0);
            expect(result.at({x: 12.25, y, z: wallRow - 0.25})).toBeGreaterThan(0);
            expect(countLit(result, center => center.z < wallRow - 0.5)).toBe(0);
        });

        it("leave a lamp they half cover to light from the half left open", () =>
        {
            // The middle of a lamp a cell wide lies between two sub-blocks; a post stands in one of them.
            const lamp = {x: 16.5, y, z: 16.25};
            const voxels = setShapes(openRoom(), LOW_X_LOW_Z_QUARTER, {row: 16, col: 16});
            const result = propagate(voxels, [makeLight({worldPos: lamp, range: 8, decay: 1})]);

            expect(result.at({...lamp, x: 16.25})).toBe(0);
            expect(result.at({...lamp, x: 16.75}))
                .toBeCloseTo(getDistanceAttenuation(LIGHT_SOURCE_MIN_DISTANCE, 8, 1), 5);
            // Round the post, to the side it covers: lit, and dimmer for the detour than light going straight.
            const pastThePost = {...lamp, x: 15.25};
            expect(result.at(pastThePost)).toBeGreaterThan(0);
            expect(result.at(pastThePost)).toBeLessThan(result.at({...lamp, x: 17.75}));
        });
    });

    describe("robustness", () =>
    {
        it("never throws, and never produces a negative or non-finite amount of light", () =>
        {
            const shapes = [VOXEL_BLOCK_SHAPE_EMPTY, VOXEL_BLOCK_SHAPE_WHOLE, LOW_X_HALF, HIGH_X_HALF, LOW_Z_HALF,
                HIGH_Z_HALF, 0b0001, 0b0010, 0b0100, 0b1000];
            fc.assert(fc.property(
                fc.record({
                    x: fc.float({min: -50, max: 80, noNaN: true}),
                    y: fc.float({min: -20, max: 30, noNaN: true}),
                    z: fc.float({min: -50, max: 80, noNaN: true}),
                }),
                fc.float({min: Math.fround(0.01), max: 60, noNaN: true}),
                fc.float({min: 0, max: 4, noNaN: true}),
                fc.integer({min: 0, max: FULL_COLLISION_LAYER_MASK}),
                fc.integer({min: 0, max: shapes.length - 1}),
                (worldPos, range, decay, mask, shapeIndex) =>
                {
                    // Stripes, so the fill meets solid, open and boundary blocks for any mask, with a band of
                    // one shape across them.
                    const voxels = makeVoxels((row, col) => ((row + col) % 2 === 0) ? mask : 0);
                    setShapes(voxels, shapes[shapeIndex], {row: 14, col: 0, rows: 5, cols: NUM_VOXEL_COLS});
                    const result = smoothed(propagate(voxels,
                        [makeLight({worldPos, range, decay})]));

                    expect(everyEntry(result.light,
                        value => Number.isFinite(value) && value >= 0)).toBe(true);
                    expect(everyEntry(result.flux, value => Number.isFinite(value))).toBe(true);
                    // And no light in what a block fills.
                    let numLitSolid = 0;
                    for (let subBlockIndex = 0; subBlockIndex < NUM_VOXEL_SUB_BLOCKS; ++subBlockIndex)
                    {
                        if (result.isOpen[subBlockIndex] === 0 && result.light[subBlockIndex * 3] !== 0)
                            ++numLitSolid;
                    }
                    expect(numLitSolid).toBe(0);
                }
            ), {numRuns: 30});
        });

        it("lights nothing, rather than hanging, from a position that is no position", () =>
        {
            for (const coordinate of [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NaN, 1e300])
            {
                const result = propagate(openRoom(), [makeLight({worldPos: {x: coordinate, y: 1.75, z: 16.25}})]);
                expect(result.light.some(value => value !== 0)).toBe(false);
            }
        });
    });
});
