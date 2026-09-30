import * as THREE from "three";
import Vec3 from "../../../../shared/math/types/vec3";
import Waveform from "../../../../shared/math/types/waveform";
import WaveformUtil from "../../../../shared/math/util/waveformUtil";
import Pool from "../../../../shared/system/types/pool";
import InstancedParticleMaterialParams from "../../../../shared/graphics/material/types/instancedParticleMaterialParams";
import { ParticleRenderState } from "../../../../shared/graphics/particle/types/particleRenderState";
import MeshFactory from "../../factories/meshFactory";
import { PARTICLE_DATA_ATTRIBUTES } from "../../shaders/particleShader";
import { packWaveformShape, unpackWaveformShape } from "../../shaders/waveformGLSL";
import ParticleColorUtil from "../util/particleColorUtil";
import ParticleRingAllocator from "./particleRingAllocator";
import ParticleSpawn from "./particleSpawn";

// Floats per instance, read by the shader as four vec4 attributes (see particleShader):
//          particle                                    sprite
// data0    origin, spawn time                          position, t0 (its last rate change)
// data1    velocity, lifetime                          orientation code, phase at t0, width, height
// data2    param row, seed, size, packed tint          param row, packed tint, packed shape, 0
// data3    level at birth, landing height, 0, 0        rate waveform: low, high, frequency, phase
const FLOATS_PER_INSTANCE = 16;

// After labels (transparent at 0) and before gizmos, so air in front of a label is drawn over it.
const BLENDED_RENDER_ORDER = 1;

// One draw call: the particles and sprites that share a render state. Sprite slots come first and the ring
// of transient particles after them, so the draw range is every slot plus the ring's high-water mark. A
// batch with nothing alive is hidden and costs no draw call.
export default class ParticleBatch
{
    readonly renderState: ParticleRenderState;
    readonly slotCapacity: number;
    readonly ringCapacity: number;
    private readonly data: Float32Array;
    private readonly buffer: THREE.InstancedInterleavedBuffer;
    private readonly slotPool: Pool<number>;
    private readonly slotLive: Uint8Array;
    private readonly ring: ParticleRingAllocator;
    private readonly deathTimes: Float32Array; // per ring entry
    private readonly dirtySlots: number[] = [];
    private readonly rangesTemp: {start: number, count: number}[] = [];
    private mesh: THREE.Mesh | undefined;
    private numLiveSlots = 0;
    private latestDeathTime = -Infinity;
    private numOverwrites = 0;
    private wholeBufferDirty = false;

    constructor(renderState: ParticleRenderState, slotCapacity: number, ringCapacity: number)
    {
        this.renderState = renderState;
        this.slotCapacity = slotCapacity;
        this.ringCapacity = ringCapacity;
        this.data = new Float32Array((slotCapacity + ringCapacity) * FLOATS_PER_INSTANCE);
        this.buffer = new THREE.InstancedInterleavedBuffer(this.data, FLOATS_PER_INSTANCE);
        this.buffer.setUsage(THREE.DynamicDrawUsage);
        // Lowest slots first, as MeshFactory rents instance ids.
        this.slotPool = new Pool<number>(slotCapacity, (index: number) => slotCapacity - index - 1);
        this.slotLive = new Uint8Array(slotCapacity);
        this.ring = new ParticleRingAllocator(ringCapacity);
        this.deathTimes = new Float32Array(ringCapacity).fill(-Infinity);
    }

    async load(): Promise<void>
    {
        const attributes: {[name: string]: THREE.InterleavedBufferAttribute} = {};
        PARTICLE_DATA_ATTRIBUTES.forEach((name, i) =>
            attributes[name] = new THREE.InterleavedBufferAttribute(this.buffer, 4, i * 4));
        this.mesh = await MeshFactory.loadParticleBatchMesh(`ParticleBatch-${this.renderState}`,
            new InstancedParticleMaterialParams(this.renderState), attributes);
        if (this.renderState === "blended")
            this.mesh.renderOrder = BLENDED_RENDER_ORDER;
        this.mesh.visible = false;
    }

    // --- Sprites (persistent) ---

    // Undefined when every slot is taken. The sprite draws nothing until it is given a pose.
    rentSlot(paramRow: number, time: number): number | undefined
    {
        const slot = this.slotPool.rentItem();
        if (slot == undefined)
            return undefined;
        this.slotLive[slot] = 1;
        ++this.numLiveSlots;

        const o = slot * FLOATS_PER_INSTANCE;
        this.data.fill(0, o, o + FLOATS_PER_INSTANCE);
        this.data[o + 3] = time;
        // A random start, so sprites of one kind don't turn in step.
        this.data[o + 5] = Math.random();
        this.data[o + 8] = paramRow;
        this.data[o + 9] = ParticleColorUtil.WHITE;
        this.writeWaveform(o, WaveformUtil.constant(1));
        this.markSlotDirty(slot);
        return slot;
    }

    setSpritePose(slot: number, position: Vec3, orientationCode: number, width: number, height: number): void
    {
        const o = slot * FLOATS_PER_INSTANCE;
        this.data[o] = position.x;
        this.data[o + 1] = position.y;
        this.data[o + 2] = position.z;
        this.data[o + 4] = orientationCode;
        this.data[o + 6] = width;
        this.data[o + 7] = height;
        this.markSlotDirty(slot);
    }

    setSpriteTint(slot: number, packedTint: number): void
    {
        this.data[slot * FLOATS_PER_INSTANCE + 9] = packedTint;
        this.markSlotDirty(slot);
    }

    // The phase carries on from where it stands (read back exactly as the shader sees it), so a new rate
    // never makes the sprite jump.
    setSpriteRate(slot: number, waveform: Waveform, time: number): void
    {
        const o = slot * FLOATS_PER_INSTANCE;
        const phase = this.data[o + 5] + WaveformUtil.integrate(this.readWaveform(o), this.data[o + 3], time);
        this.data[o + 3] = time;
        this.data[o + 5] = phase;
        this.writeWaveform(o, waveform);
        this.markSlotDirty(slot);
    }

    releaseSlot(slot: number): void
    {
        if (!this.slotLive[slot])
            return;
        this.slotLive[slot] = 0;
        --this.numLiveSlots;

        // All zeros draws nothing (zero size, or a particle with no life).
        const o = slot * FLOATS_PER_INSTANCE;
        this.data.fill(0, o, o + FLOATS_PER_INSTANCE);
        this.markSlotDirty(slot);
        this.slotPool.returnItem(slot);
    }

    // --- Particles (transient) ---

    // False for a batch without a ring.
    writeParticle(spawn: ParticleSpawn, time: number): boolean
    {
        const index = this.ring.allocate();
        if (index < 0)
            return false;
        if (this.deathTimes[index] > time)
            ++this.numOverwrites;
        const deathTime = spawn.spawnTime + spawn.lifetime;
        this.deathTimes[index] = deathTime;
        this.latestDeathTime = Math.max(this.latestDeathTime, deathTime);

        const d = this.data;
        const o = (this.slotCapacity + index) * FLOATS_PER_INSTANCE;
        d[o] = spawn.origin.x;
        d[o + 1] = spawn.origin.y;
        d[o + 2] = spawn.origin.z;
        d[o + 3] = spawn.spawnTime;
        d[o + 4] = spawn.velocity.x;
        d[o + 5] = spawn.velocity.y;
        d[o + 6] = spawn.velocity.z;
        d[o + 7] = spawn.lifetime;
        d[o + 8] = spawn.paramRow;
        d[o + 9] = spawn.seed;
        d[o + 10] = spawn.size;
        d[o + 11] = spawn.packedTint;
        d[o + 12] = spawn.levelAtBirth;
        d[o + 13] = spawn.landingY;
        d[o + 14] = 0;
        d[o + 15] = 0;
        return true;
    }

    // Stale entries past the high-water mark are never drawn, and new ones overwrite them.
    clearParticles(): void
    {
        this.ring.reset();
        this.deathTimes.fill(-Infinity);
        this.latestDeathTime = -Infinity;
    }

    // --- Per frame ---

    // Queues what changed since the last flush for upload, and hides the batch when nothing is alive.
    flush(time: number): void
    {
        if (this.mesh == undefined)
            return;

        if (this.wholeBufferDirty)
        {
            // three.js uploads the whole buffer only when no range is queued.
            this.buffer.clearUpdateRanges();
            this.buffer.needsUpdate = true;
            this.wholeBufferDirty = false;
            this.dirtySlots.length = 0;
            this.ring.takeDirtyRanges(this.rangesTemp);
        }
        else
        {
            let queued = this.queueDirtySlots();
            const ringOffset = this.slotCapacity * FLOATS_PER_INSTANCE;
            for (const range of this.ring.takeDirtyRanges(this.rangesTemp))
            {
                this.buffer.addUpdateRange(ringOffset + range.start * FLOATS_PER_INSTANCE,
                    range.count * FLOATS_PER_INSTANCE);
                queued = true;
            }
            if (queued)
                this.buffer.needsUpdate = true;
        }

        (this.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount =
            this.slotCapacity + this.ring.getHighWaterMark();
        this.mesh.visible = this.numLiveSlots > 0 || this.latestDeathTime > time;
    }

    // Moves every stored time back by delta (see ParticleSystem's clock rebase). Waveform phases advance
    // by the same interval, so every level and phase stays where it was.
    shiftTimes(delta: number): void
    {
        for (let slot = 0; slot < this.slotCapacity; ++slot)
        {
            if (!this.slotLive[slot])
                continue;
            const o = slot * FLOATS_PER_INSTANCE;
            this.data[o + 3] -= delta;
            const wavePhase = this.data[o + 15] + this.data[o + 14] * delta;
            this.data[o + 15] = wavePhase - Math.floor(wavePhase);
        }
        for (let i = 0; i < this.ringCapacity; ++i)
        {
            this.data[(this.slotCapacity + i) * FLOATS_PER_INSTANCE + 3] -= delta;
            this.deathTimes[i] -= delta;
        }
        this.latestDeathTime -= delta;
        this.wholeBufferDirty = true;
    }

    // --- Stats ---

    getNumLiveParticles(time: number): number
    {
        let count = 0;
        for (let i = 0; i < this.ringCapacity; ++i)
        {
            if (this.deathTimes[i] > time)
                ++count;
        }
        return count;
    }

    getNumLiveSprites(): number
    {
        return this.numLiveSlots;
    }

    getNumOverwrites(): number
    {
        return this.numOverwrites;
    }

    private markSlotDirty(slot: number): void
    {
        this.dirtySlots.push(slot);
    }

    // Consecutive dirty slots go up as one range.
    private queueDirtySlots(): boolean
    {
        if (this.dirtySlots.length == 0)
            return false;
        this.dirtySlots.sort((a, b) => a - b);
        let start = this.dirtySlots[0];
        let end = start + 1;
        for (let i = 1; i <= this.dirtySlots.length; ++i)
        {
            const slot = this.dirtySlots[i];
            if (i < this.dirtySlots.length && slot <= end)
            {
                end = Math.max(end, slot + 1);
                continue;
            }
            this.buffer.addUpdateRange(start * FLOATS_PER_INSTANCE, (end - start) * FLOATS_PER_INSTANCE);
            start = slot;
            end = slot + 1;
        }
        this.dirtySlots.length = 0;
        return true;
    }

    private writeWaveform(o: number, waveform: Waveform): void
    {
        this.data[o + 10] = packWaveformShape(waveform);
        this.data[o + 12] = waveform.low;
        this.data[o + 13] = waveform.high;
        this.data[o + 14] = waveform.frequency;
        this.data[o + 15] = waveform.phase - Math.floor(waveform.phase);
    }

    private readWaveform(o: number): Waveform
    {
        const {shape, duty} = unpackWaveformShape(this.data[o + 10]);
        return {shape, duty, low: this.data[o + 12], high: this.data[o + 13],
            frequency: this.data[o + 14], phase: this.data[o + 15]};
    }
}
