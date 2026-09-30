/**
 * Particles and animated sprites, without a GPU: the ring allocator (wrapping, at most two upload ranges, its
 * high-water mark), sprite slots and phase continuity, clock rebasing, waveforms (level and closed-form
 * integral), parameter-row baking, the effect definitions in their JSON map (each one sound, and the checker
 * catching what a compiler would), the gameplay events that trigger effects (fired by edits only), and the
 * components' baseline + override resolution. What the shader draws is checked headlessly instead (see
 * docs/testing/integration/scenarios.md).
 */
import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import fc from "fast-check";

vi.mock("../../../src/client/graphics/graphicsManager", async () => {
    const THREE = await import("three");
    const camera = new THREE.PerspectiveCamera();
    const scene = new THREE.Scene();
    const lightBlockMap = { requestRecomputation() {}, resetForRoom(_voxels?: unknown) {},
        getNearbyLightAt(_worldPos: unknown, out: any) { return out.setRGB(0, 0, 0); } };
    return { default: { getCamera: () => camera, getScene: () => scene,
        getLightBlockMap: () => lightBlockMap, isResolutionAtFloor: () => false,
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

vi.mock("../../../src/client/graphics/types/gizmo/generic/worldSpaceOutlineRect", () => ({
    default: class WorldSpaceOutlineRectStub
    {
        static async create() { return new WorldSpaceOutlineRectStub(); }
        addToParent() {}
        setTransform() {}
        setTransformRaw() {}
        setVisible() {}
        dispose() {}
    },
}));

import App from "../../../src/client/app";
import ParticleRingAllocator from "../../../src/client/graphics/particle/types/particleRingAllocator";
import ParticleBatch from "../../../src/client/graphics/particle/types/particleBatch";
import ParticleSpawn from "../../../src/client/graphics/particle/types/particleSpawn";
import SpriteHandle from "../../../src/client/graphics/particle/types/spriteHandle";
import ParticleParamTextureUtil from "../../../src/client/graphics/particle/util/particleParamTextureUtil";
import ParticleEffectConfigUtil from "../../../src/client/graphics/particle/util/particleEffectConfigUtil";
import ParticleEffectConfigMap from "../../../src/client/graphics/particle/maps/particleEffectConfigMap";
import ParticleLayerConfig from "../../../src/client/graphics/particle/types/particleLayerConfig";
import ParticleSystem from "../../../src/client/graphics/particle/particleSystem";
import { PARTICLE_CURVE_SAMPLES, PARTICLE_KIND_CODE, PARTICLE_ORIENTATION_CODE, PARTICLE_PARAM_ROW_TEXELS,
    PARTICLE_PARAM_TEXEL } from "../../../src/client/graphics/shaders/particleShader";
import { unpackWaveformShape } from "../../../src/client/graphics/shaders/waveformGLSL";
import { ObjectMetadata } from "../../../src/shared/object/types/objectMetadata";
import AnimatedSprite from "../../../src/client/object/components/animatedSprite";
import GameObject from "../../../src/client/object/types/gameObject/gameObject";
import ClientVoxelManager from "../../../src/client/voxel/clientVoxelManager";
import { roomShapeChangedObservable, voxelBlockEditObservable } from "../../../src/client/system/clientObservables";
import Waveform from "../../../src/shared/math/types/waveform";
import WaveformUtil from "../../../src/shared/math/util/waveformUtil";
import AnimatedSpriteDescriptor from "../../../src/shared/graphics/particle/types/animatedSpriteDescriptor";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import AddVoxelBlockSignal from "../../../src/shared/voxel/types/update/addVoxelBlockSignal";
import RemoveVoxelBlockSignal from "../../../src/shared/voxel/types/update/removeVoxelBlockSignal";
import SetVoxelQuadTextureSignal from "../../../src/shared/voxel/types/update/setVoxelQuadTextureSignal";
import Room from "../../../src/shared/room/types/room";
import { createEditingUser } from "../helpers/mockUser";
import { buildPillar, createRoom, quadIndexOf } from "../helpers/selectionHarness";

const FLOATS_PER_INSTANCE = 16;

// ─── Fixtures ───

function makeSpawn(overrides: Partial<ParticleSpawn> = {}): ParticleSpawn
{
    return {origin: {x: 1, y: 2, z: 3}, spawnTime: 0, velocity: {x: 0, y: 1, z: 0}, lifetime: 1,
        paramRow: 0, seed: 0.5, size: 0.2, packedTint: 0xffffff, levelAtBirth: 1, landingY: -1e6, ...overrides};
}

// The batch's own instance data, which is what the shader reads.
function instanceData(batch: ParticleBatch): Float32Array
{
    return (batch as unknown as {data: Float32Array}).data;
}

// A sprite's rate as its slot holds it (float32, duty packed), which is what the shader integrates.
function storedWaveform(batch: ParticleBatch, slot: number): Waveform
{
    const data = instanceData(batch);
    const o = slot * FLOATS_PER_INSTANCE;
    const {shape, duty} = unpackWaveformShape(data[o + 10]);
    return {shape, duty, low: data[o + 12], high: data[o + 13], frequency: data[o + 14], phase: data[o + 15]};
}

// A sprite's phase at a time, as the shader works it out from its slot.
function spritePhaseAt(batch: ParticleBatch, slot: number, time: number): number
{
    const data = instanceData(batch);
    const o = slot * FLOATS_PER_INSTANCE;
    return data[o + 5] + WaveformUtil.integrate(storedWaveform(batch, slot), data[o + 3], time);
}

const waveformArbitrary: fc.Arbitrary<Waveform> = fc.record({
    shape: fc.constantFrom("constant" as const, "sine" as const, "pulse" as const),
    low: fc.double({min: -2, max: 2, noNaN: true}),
    high: fc.double({min: -2, max: 4, noNaN: true}),
    frequency: fc.double({min: 0.05, max: 4, noNaN: true}),
    phase: fc.double({min: -3, max: 3, noNaN: true}),
    duty: fc.double({min: 0.05, max: 1, noNaN: true}),
});

// Midpoint-rule integral of the level, fine enough to check the closed form.
function integrateNumerically(waveform: Waveform, t0: number, t1: number, steps: number = 20000): number
{
    const dt = (t1 - t0) / steps;
    let sum = 0;
    for (let i = 0; i < steps; ++i)
        sum += WaveformUtil.getLevel(waveform, t0 + (i + 0.5) * dt) * dt;
    return sum;
}

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
});

// ─── The ring of transient particles ───

describe("ParticleRingAllocator", () => {
    it("wraps its head, and draws no more than it has written", () => {
        const ring = new ParticleRingAllocator(8);
        expect(ring.getHighWaterMark()).toBe(0);
        const indices = Array.from({length: 11}, () => ring.allocate());
        expect(indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2]);
        expect(ring.getHighWaterMark()).toBe(8);
    });

    it("reports what each frame wrote as at most two runs, covering exactly what was written", () => {
        fc.assert(fc.property(fc.integer({min: 1, max: 64}), fc.array(fc.integer({min: 0, max: 100}), {maxLength: 30}),
            (capacity, framesOfSpawns) => {
                const ring = new ParticleRingAllocator(capacity);
                const ranges: {start: number, count: number}[] = [];
                for (const spawns of framesOfSpawns)
                {
                    const written = new Set<number>();
                    for (let i = 0; i < spawns; ++i)
                        written.add(ring.allocate());
                    ring.takeDirtyRanges(ranges);

                    expect(ranges.length).toBeLessThanOrEqual(2);
                    const covered = new Set<number>();
                    for (const range of ranges)
                    {
                        expect(range.start).toBeGreaterThanOrEqual(0);
                        expect(range.start + range.count).toBeLessThanOrEqual(capacity);
                        for (let i = range.start; i < range.start + range.count; ++i)
                            covered.add(i);
                    }
                    expect([...covered].sort((a, b) => a - b)).toEqual([...written].sort((a, b) => a - b));
                    expect(ring.getHighWaterMark()).toBeLessThanOrEqual(capacity);
                }
            }));
    });

    it("draws and reports nothing without capacity", () => {
        const ring = new ParticleRingAllocator(0);
        expect(ring.allocate()).toBe(-1);
        expect(ring.takeDirtyRanges([])).toEqual([]);
        expect(ring.getHighWaterMark()).toBe(0);
    });
});

// ─── A batch: sprite slots and the ring ───

describe("ParticleBatch", () => {
    it("reuses freed sprite slots, lowest first, and never moves a live one", () => {
        const batch = new ParticleBatch("solid", 4, 0);
        const slots = [batch.rentSlot(0, 0), batch.rentSlot(0, 0), batch.rentSlot(0, 0)];
        expect(slots).toEqual([0, 1, 2]);
        batch.releaseSlot(1);
        expect(batch.rentSlot(0, 0)).toBe(1);
        expect(batch.rentSlot(0, 0)).toBe(3);
        expect(batch.rentSlot(0, 0)).toBeUndefined();
        expect(batch.getNumLiveSprites()).toBe(4);
    });

    it("writes a released slot as all zeros, which draws nothing", () => {
        const batch = new ParticleBatch("solid", 2, 0);
        const slot = batch.rentSlot(3, 0)!;
        batch.setSpritePose(slot, {x: 1, y: 2, z: 3}, 5, 1, 1);
        batch.releaseSlot(slot);
        const data = instanceData(batch);
        expect([...data.subarray(slot * FLOATS_PER_INSTANCE, (slot + 1) * FLOATS_PER_INSTANCE)].every(v => v == 0))
            .toBe(true);
        expect(batch.getNumLiveSprites()).toBe(0);
    });

    it("keeps a sprite's phase continuous across a change of rate, then follows the new rate", () => {
        fc.assert(fc.property(waveformArbitrary, waveformArbitrary, fc.double({min: 0.1, max: 30, noNaN: true}),
            (first, second, changeAt) => {
                const batch = new ParticleBatch("solid", 1, 0);
                const slot = batch.rentSlot(0, 0)!;
                batch.setSpriteRate(slot, first, 0);
                const before = spritePhaseAt(batch, slot, changeAt);
                batch.setSpriteRate(slot, second, changeAt);
                expect(spritePhaseAt(batch, slot, changeAt)).toBeCloseTo(before, 3);

                const stored = storedWaveform(batch, slot);
                expect(stored.shape).toBe(second.shape);
                expect(stored.low).toBeCloseTo(second.low, 5);
                expect(stored.high).toBeCloseTo(second.high, 5);
                expect(stored.frequency).toBeCloseTo(second.frequency, 5);
            }));
    });

    it("counts live particles it overwrote, and none it didn't", () => {
        const batch = new ParticleBatch("blended", 0, 4);
        for (let i = 0; i < 4; ++i)
            batch.writeParticle(makeSpawn({spawnTime: 0, lifetime: 10}), 0);
        expect(batch.getNumOverwrites()).toBe(0);
        batch.writeParticle(makeSpawn({spawnTime: 1, lifetime: 10}), 1);
        expect(batch.getNumOverwrites()).toBe(1);
        // Past every death, overwriting costs nothing.
        batch.writeParticle(makeSpawn({spawnTime: 20, lifetime: 1}), 20);
        expect(batch.getNumOverwrites()).toBe(1);
        expect(batch.getNumLiveParticles(1)).toBe(4);
    });

    it("keeps every age, phase and level on a clock rebase", () => {
        const waveform: Waveform = {shape: "sine", low: 0.5, high: 2.5, frequency: 0.37, phase: 0.2, duty: 1};
        const batch = new ParticleBatch("blended", 1, 2);
        const slot = batch.rentSlot(0, 100)!;
        batch.setSpriteRate(slot, waveform, 3500);
        batch.writeParticle(makeSpawn({spawnTime: 3599, lifetime: 5}), 3599);

        const now = 3601, delta = 3600;
        const phaseBefore = spritePhaseAt(batch, slot, now);
        const levelBefore = WaveformUtil.getLevel(storedWaveform(batch, slot), now);
        const spawnTimeBefore = instanceData(batch)[FLOATS_PER_INSTANCE + 3];
        batch.shiftTimes(delta);

        const data = instanceData(batch);
        expect(spritePhaseAt(batch, slot, now - delta)).toBeCloseTo(phaseBefore, 2);
        expect(WaveformUtil.getLevel(storedWaveform(batch, slot), now - delta)).toBeCloseTo(levelBefore, 3);
        expect(now - spawnTimeBefore).toBeCloseTo((now - delta) - data[FLOATS_PER_INSTANCE + 3], 3);
        expect(batch.getNumLiveParticles(now - delta)).toBe(1);
    });

    it("forgets every particle when cleared, so none reappears under a new clock", () => {
        const batch = new ParticleBatch("blended", 0, 4);
        batch.writeParticle(makeSpawn({spawnTime: 5, lifetime: 10}), 5);
        batch.clearParticles();
        expect(batch.getNumLiveParticles(6)).toBe(0);
    });
});

describe("SpriteHandle", () => {
    it("forwards only real changes of rate, so an unchanged one never rebases the phase", () => {
        const batch = new ParticleBatch("solid", 1, 0);
        const slot = batch.rentSlot(0, 0)!;
        let time = 1;
        const released: SpriteHandle[] = [];
        const handle = new SpriteHandle("fanBlades", batch, slot, () => time, (h) => released.push(h));
        const waveform: Waveform = {shape: "sine", low: 1, high: 3, frequency: 0.5, phase: 0, duty: 1};

        handle.setRate(waveform);
        expect(instanceData(batch)[3]).toBe(1);
        time = 5;
        handle.setRate({...waveform});
        expect(instanceData(batch)[3]).toBe(1);

        handle.release();
        expect(handle.isReleased()).toBe(true);
        expect(released).toEqual([handle]);
        handle.release();
        expect(released.length).toBe(1);
    });
});

// ─── Waveforms ───

describe("WaveformUtil", () => {
    it("keeps every level within its range", () => {
        fc.assert(fc.property(waveformArbitrary, fc.double({min: -100, max: 100, noNaN: true}), (waveform, t) => {
            const level = WaveformUtil.getLevel(waveform, t);
            const low = Math.min(waveform.low, waveform.high), high = Math.max(waveform.low, waveform.high);
            if (waveform.shape === "constant")
                expect(level).toBeCloseTo(waveform.high, 9);
            else
            {
                expect(level).toBeGreaterThanOrEqual(low - 1e-9);
                expect(level).toBeLessThanOrEqual(high + 1e-9);
            }
        }));
    });

    it("integrates to what summing its level gives", () => {
        fc.assert(fc.property(waveformArbitrary, fc.double({min: -20, max: 20, noNaN: true}),
            fc.double({min: 0, max: 6, noNaN: true}), (waveform, t0, duration) => {
                expect(WaveformUtil.integrate(waveform, t0, t0 + duration))
                    .toBeCloseTo(integrateNumerically(waveform, t0, t0 + duration), 3);
            }), {numRuns: 60});
    });

    it("integrates additively over any split, so there is no jump at a cycle's end", () => {
        fc.assert(fc.property(waveformArbitrary, fc.double({min: -50, max: 50, noNaN: true}),
            fc.double({min: 0, max: 10, noNaN: true}), fc.double({min: 0, max: 10, noNaN: true}),
            (waveform, a, first, second) => {
                const whole = WaveformUtil.integrate(waveform, a, a + first + second);
                const parts = WaveformUtil.integrate(waveform, a, a + first) +
                    WaveformUtil.integrate(waveform, a + first, a + first + second);
                expect(parts).toBeCloseTo(whole, 6);
            }));
    });

    it("holds a constant waveform at its level", () => {
        const waveform = WaveformUtil.constant(2.5);
        expect(WaveformUtil.getLevel(waveform, 123.4)).toBe(2.5);
        expect(WaveformUtil.integrate(waveform, 1, 5)).toBeCloseTo(10, 9);
    });
});

// ─── Parameter rows ───

describe("ParticleParamTextureUtil", () => {
    it("resamples a curve linearly from its first value to its last", () => {
        expect(ParticleParamTextureUtil.resampleCurve([2], 4)).toEqual([2, 2, 2, 2]);
        const samples = ParticleParamTextureUtil.resampleCurve([0, 1, 0], 5);
        expect(samples.map(v => Number(v.toFixed(6)))).toEqual([0, 0.5, 1, 0.5, 0]);
    });

    it("lays a layer's row out as the shader reads it", () => {
        const data = new Float32Array(2 * PARTICLE_PARAM_ROW_TEXELS * 4);
        const sprite = {u: 0.25, v: 0.5, width: 0.0625, height: 0.125, frames: 4};
        ParticleParamTextureUtil.writeLayerRow(data, 1, {
            sprite: "puff", orientation: "velocity", additiveness: 0.7, lit: true,
            speed: [1, 2], lifetime: [1, 1], size: [0.1, 0.1], spin: [-1, 3], gravity: 9, drag: 2,
            turbulence: 0.1, stretch: 0.3, frameRate: 12,
            alphaCurve: [0, 1], sizeCurve: [1, 3], colorCurve: ["#ffffff"],
        }, sprite);
        const texel = (index: number) => [...data.subarray((PARTICLE_PARAM_ROW_TEXELS + index) * 4,
            (PARTICLE_PARAM_ROW_TEXELS + index) * 4 + 4)].map(v => Number(v.toFixed(5)));
        expect(texel(PARTICLE_PARAM_TEXEL.atlasRect)).toEqual([0.25, 0.5, 0.0625, 0.125]);
        expect(texel(PARTICLE_PARAM_TEXEL.animation))
            .toEqual([4, 12, PARTICLE_KIND_CODE.particle, PARTICLE_ORIENTATION_CODE.velocity]);
        expect(texel(PARTICLE_PARAM_TEXEL.motion)).toEqual([9, 2, 0.1, 0.3]);
        expect(texel(PARTICLE_PARAM_TEXEL.look)).toEqual([0.7, 1, -1, 3]);
        // Alpha rides in the color curve's fourth channel; size is packed four samples to a texel.
        expect(texel(PARTICLE_PARAM_TEXEL.colorCurve)[3]).toBe(0);
        expect(texel(PARTICLE_PARAM_TEXEL.colorCurve + PARTICLE_CURVE_SAMPLES - 1)[3]).toBe(1);
        expect(texel(PARTICLE_PARAM_TEXEL.sizeCurve)[0]).toBe(1);
        expect(texel(PARTICLE_PARAM_TEXEL.sizeCurve + 1)[3]).toBe(3);
        // Nothing else is written into the neighbouring row.
        expect(data.subarray(0, PARTICLE_PARAM_ROW_TEXELS * 4).every(v => v == 0)).toBe(true);
    });

    it("never marks a solid layer additive or lit", () => {
        const data = new Float32Array(PARTICLE_PARAM_ROW_TEXELS * 4);
        ParticleParamTextureUtil.writeLayerRow(data, 0, {sprite: "puff", renderState: "solid", additiveness: 1,
            lit: true, speed: [1, 1], lifetime: [1, 1], size: [1, 1]},
            {u: 0, v: 0, width: 1, height: 1, frames: 1});
        expect(data[PARTICLE_PARAM_TEXEL.look * 4]).toBe(0);
        expect(data[PARTICLE_PARAM_TEXEL.look * 4 + 1]).toBe(0);
    });
});

// ─── Effect definitions ───

describe("effect definitions", () => {
    const SOUND_LAYER: ParticleLayerConfig = {sprite: "puff", burst: 4, speed: [1, 2], lifetime: [0.5, 1],
        size: [0.2, 0.4]};
    const problemsWith = (change: object) =>
        ParticleEffectConfigUtil.getProblems({layers: [{...SOUND_LAYER, ...change} as ParticleLayerConfig]});

    it("are all sound, since the JSON map is never type-checked", () => {
        for (const effect of ParticleEffectConfigMap.getEffects())
        {
            const problems = ParticleEffectConfigUtil.getProblems(ParticleEffectConfigMap.getConfig(effect)!);
            expect({effect, problems}).toEqual({effect, problems: []});
        }
    });

    it("include every effect the gameplay events play, whatever the editor renamed", () => {
        for (const effect of ["blockRemoved"])
            expect(ParticleEffectConfigMap.getConfig(effect), effect).toBeDefined();
    });

    it("are checked for what a compiler would catch, and for what it wouldn't", () => {
        expect(ParticleEffectConfigUtil.getProblems({layers: [SOUND_LAYER]})).toEqual([]);
        expect(ParticleEffectConfigUtil.getProblems({layers: []})).toEqual(["It has no layers."]);
        expect(problemsWith({sprite: "smoke"})).toEqual([expect.stringMatching(/^Layer 1: "sprite" is not/)]);
        expect(problemsWith({speeed: 2})).toEqual(["Layer 1: unknown field \"speeed\"."]);
        expect(problemsWith({launch: "outward"})).toEqual([expect.stringMatching(/"launch" is not one of/)]);
        expect(problemsWith({size: [0.4, 0.2]})).toEqual([expect.stringMatching(/"size" runs backwards/)]);
        expect(problemsWith({lifetime: [0, 1]})).toEqual([expect.stringMatching(/"lifetime" must start above 0/)]);
        expect(problemsWith({colorCurve: ["#fff"]})).toEqual([expect.stringMatching(/"colorCurve"/)]);
        expect(problemsWith({alphaCurve: [0, 1.5]})).toEqual([expect.stringMatching(/"alphaCurve"/)]);
        expect(problemsWith({spread: 4})).toEqual([expect.stringMatching(/"spread" is outside/)]);
        expect(problemsWith({burst: 2.5})).toEqual([expect.stringMatching(/"burst" is not a whole number/)]);
        expect(problemsWith({burst: 0})).toEqual([expect.stringMatching(/never emits/)]);
        expect(problemsWith({burst: 0, rate: 5})).toEqual([]);
    });
});

// ─── Gameplay events ───

describe("voxel block events", () => {
    const ROOM_ID = "particle-room";
    const TEXTURES = [1, 1, 1, 1, 1, 1];
    let room: Room;
    let blockEdits: {kind: string, quadIndex: number}[];
    let shapeChanges: string[];

    beforeEach(() => {
        room = createRoom(ROOM_ID);
        (App.getCurrentRoom as Mock).mockReturnValue(room);
        (App.getVoxelQuads as Mock).mockReturnValue(room.voxelQuads);
        (App.getUser as Mock).mockReturnValue(createEditingUser());
        blockEdits = [];
        shapeChanges = [];
        voxelBlockEditObservable.addListener("particleTest", (edit) => { blockEdits.push({...edit}); });
        roomShapeChangedObservable.addListener("particleTest", (roomId) => { shapeChanges.push(roomId); });
        return () => {
            voxelBlockEditObservable.removeListener("particleTest");
            roomShapeChangedObservable.removeListener("particleTest");
        };
    });

    it("fires once per edit, with what the edit did", async () => {
        buildPillar(room, 10, 5);
        blockEdits.length = 0;
        const added = quadIndexOf(10, 6, "x", "+", 2);
        await ClientVoxelManager.onAddVoxelBlockSignalReceived(new AddVoxelBlockSignal(ROOM_ID, added, TEXTURES));
        await ClientVoxelManager.onSetVoxelQuadTextureSignalReceived(
            new SetVoxelQuadTextureSignal(ROOM_ID, added, 2));
        await ClientVoxelManager.onRemoveVoxelBlockSignalReceived(new RemoveVoxelBlockSignal(ROOM_ID, added));

        expect(blockEdits).toEqual([
            {kind: "add", quadIndex: added},
            {kind: "retexture", quadIndex: added},
            {kind: "remove", quadIndex: added},
        ]);
        // Retexturing leaves the room's shape alone.
        expect(shapeChanges).toEqual([ROOM_ID, ROOM_ID]);
    });

    it("fires nothing for an edit that is refused", async () => {
        buildPillar(room, 10, 5);
        const added = quadIndexOf(10, 6, "x", "+", 2);
        await ClientVoxelManager.onAddVoxelBlockSignalReceived(new AddVoxelBlockSignal(ROOM_ID, added, TEXTURES));
        await ClientVoxelManager.onRemoveVoxelBlockSignalReceived(new RemoveVoxelBlockSignal(ROOM_ID, added));
        blockEdits.length = 0;
        shapeChanges.length = 0;

        // The user's own removal of a block that is already gone.
        expect(ClientVoxelManager.removeVoxelBlock(room, added, true)).toBe(false);
        expect(blockEdits).toEqual([]);
        expect(shapeChanges).toEqual([]);
    });

    it("fires no block event for a scripted chunk edit, but still reports the room's new shape", () => {
        ClientVoxelManager.addVoxelBlocksByChunk(room, 4, 4, 2, 2, 1, 2, TEXTURES, false);
        ClientVoxelManager.removeVoxelBlocksByChunk(room, 4, 4, 2, 2, 1, 2, false);
        expect(blockEdits).toEqual([]);
        expect(shapeChanges).toEqual([ROOM_ID, ROOM_ID]);
    });
});

// ─── Components ───

describe("AnimatedSprite", () => {
    const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function makeObject(metadata: {[key: number]: string}): GameObject
    {
        const params = new AddObjectSignal("room", "user", "User", canvasTypeIndex, "sprite-object",
            new ObjectTransform({x: 5, y: 1, z: 3}, {x: 0, y: 0, z: 1}, {x: 1, y: 1, z: 1}),
            metadata as unknown as ObjectMetadata);
        return {params} as unknown as GameObject;
    }

    function fakeHandle(sprite: string)
    {
        return {sprite, setPose: vi.fn(), setRate: vi.fn(), setTint: vi.fn(), release: vi.fn()};
    }

    it("shows its baseline, changed by what the type makes of the object's metadata", async () => {
        const handles: ReturnType<typeof fakeHandle>[] = [];
        vi.spyOn(ParticleSystem, "createSprite").mockImplementation((sprite: string) => {
            handles.push(fakeHandle(sprite));
            return handles[handles.length - 1] as unknown as SpriteHandle;
        });
        const fast: Waveform = {shape: "sine", low: 1, high: 4, frequency: 0.5, phase: 0, duty: 1};
        const baseline: AnimatedSpriteDescriptor = {sprite: "fanBlades", faceOffset: 0.1, widthScale: 0.5};
        const component = new AnimatedSprite(makeObject({7: "fast"}), {
            baseline,
            getOverride: (metadata: {[key: number]: string}) => (metadata[7] === "fast") ? {rate: fast} : undefined,
        });

        await component.onSpawn();
        expect(handles.map(h => h.sprite)).toEqual(["fanBlades"]);
        expect(handles[0].setRate).toHaveBeenLastCalledWith(fast);
        const [position, facing, quarterTurns, width] = handles[0].setPose.mock.lastCall!;
        expect(position.z).toBeCloseTo(3.1, 6);
        expect(facing).toEqual({x: 0, y: 0, z: 1});
        expect(quarterTurns).toBe(0);
        expect(width).toBeGreaterThan(0);

        await component.onDespawn();
        expect(handles[0].release).toHaveBeenCalledOnce();
    });

    it("swaps its sprite when the override names another", async () => {
        const handles: ReturnType<typeof fakeHandle>[] = [];
        vi.spyOn(ParticleSystem, "createSprite").mockImplementation((sprite: string) => {
            handles.push(fakeHandle(sprite));
            return handles[handles.length - 1] as unknown as SpriteHandle;
        });
        const object = makeObject({});
        const component = new AnimatedSprite(object, {
            baseline: {sprite: "fanBlades"},
            getOverride: (metadata: {[key: number]: string}) => (metadata[7] === "lit") ? {sprite: "glow"} : undefined,
        });
        await component.onSpawn();
        object.params.metadata[7] = "lit";
        component.onSetMetadata();
        expect(handles.map(h => h.sprite)).toEqual(["fanBlades", "glow"]);
        expect(handles[0].release).toHaveBeenCalledOnce();
    });
});
