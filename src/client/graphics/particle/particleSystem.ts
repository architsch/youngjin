import * as THREE from "three";
import Vec3 from "../../../shared/math/types/vec3";
import WaveformUtil from "../../../shared/math/util/waveformUtil";
import GraphicsManager from "../graphicsManager";
import ParticleBatch from "./types/particleBatch";
import ParticleEmitterHandle from "./types/particleEmitterHandle";
import ParticleLayerConfig from "./types/particleLayerConfig";
import SpriteHandle from "./types/spriteHandle";
import ParticleEffectConfigMap from "./maps/particleEffectConfigMap";
import SpriteConfigMap from "./maps/spriteConfigMap";
import ParticleAtlasUtil from "./util/particleAtlasUtil";
import ParticleParamTextureUtil from "./util/particleParamTextureUtil";
import ParticleMaterialUtil from "./util/particleMaterialUtil";
import ParticleSpawnUtil from "./util/particleSpawnUtil";

// Capacities per batch. Translucent sprites and every transient particle share the blended batch; the solid
// batch holds cut-out sprites and has no ring yet. The overwrite count (see getStats) says when a ring is too
// small.
const BLENDED_SLOTS = 128;
const BLENDED_RING = 4096;
const SOLID_SLOTS = 256;
const SOLID_RING = 0;

// Stored times are rebased past this (see ParticleBatch.shiftTimes), while float32 still resolves about half
// a millisecond.
const CLOCK_REBASE_SECONDS = 3600;

// Nothing spawns farther than this from the camera, or out of view by more than its margin (scaled by the
// effect's size). An emitter back in view refills its stream at once (see tickEmitter).
const MAX_SPAWN_DISTANCE = 40;
const VIEW_MARGIN = 2;

// While adaptive resolution is at its floor, emitters spawn this share of their particles.
const REDUCED_DENSITY = 0.5;

const UP: Vec3 = {x: 0, y: 1, z: 0};

let loadPromise: Promise<void> | undefined;
let loaded = false;
// Seconds since the room loaded, rebased now and then (see rebaseClock).
let clock = 0;
let blendedBatch: ParticleBatch;
let solidBatch: ParticleBatch;
const emitters: Set<ParticleEmitterHandle> = new Set();
const sprites: Set<SpriteHandle> = new Set();
const ringlessWarnings: Set<string> = new Set();

const frustum = new THREE.Frustum();
const projectionTemp = new THREE.Matrix4();
const cameraPositionTemp = new THREE.Vector3();
const sphereTemp = new THREE.Sphere();
const spawnTemp = ParticleSpawnUtil.createSpawn();

// Particles and persistent animated sprites (see docs/graphics/particles.md). The shader computes everything
// after a particle's birth from the clock, so CPU work is proportional to what spawns, and each render state
// is one draw call however much is alive.
const ParticleSystem =
{
    // Builds everything on the first call. The batches then stay in the persistent scene, so every room's
    // shader precompile covers them.
    load: (): Promise<void> =>
    {
        if (loadPromise == undefined)
            loadPromise = build();
        return loadPromise;
    },
    // Before the frame renders, so what spawns now is drawn now.
    update: (deltaTime: number): void =>
    {
        if (!loaded)
            return;
        clock += deltaTime;
        if (clock > CLOCK_REBASE_SECONDS)
            rebaseClock(CLOCK_REBASE_SECONDS);
        ParticleMaterialUtil.setTime(clock);
        updateFrustum();

        const density = GraphicsManager.isResolutionAtFloor() ? REDUCED_DENSITY : 1;
        for (const emitter of emitters)
            tickEmitter(emitter, deltaTime, density);
        blendedBatch.flush(clock);
        solidBatch.flush(clock);
    },
    // Between rooms, after every object has released what it held.
    unload: (): void =>
    {
        if (!loaded)
            return;
        // A stopped emitter waits for the next tick to leave the set, so one stopped this frame isn't a leak.
        const numLeakedEmitters = [...emitters].filter(emitter => !emitter.oneShot && !emitter.stopped).length;
        if (numLeakedEmitters > 0 || sprites.size > 0)
            console.warn(`ParticleSystem.unload :: Released ${numLeakedEmitters} emitters and ${sprites.size} sprites their owners never did`);
        for (const emitter of emitters)
            emitter.stop();
        emitters.clear();
        for (const sprite of [...sprites])
            sprite.release();

        blendedBatch.clearParticles();
        solidBatch.clearParticles();
        clock = 0;
        ParticleMaterialUtil.setTime(clock);
        blendedBatch.flush(clock);
        solidBatch.flush(clock);
    },
    // A one-shot effect. direction is its frame's forward axis (up if absent); scale sizes it, and its speeds
    // and spawn volume, together.
    play: (effect: string, position: Vec3, options?: {direction?: Vec3, scale?: number, tintHex?: string}): void =>
    {
        if (!loaded)
            return;
        const config = ParticleEffectConfigMap.getConfig(effect);
        if (config == undefined)
        {
            console.warn(`ParticleSystem.play :: Unknown effect (effect = ${effect})`);
            return;
        }
        const scale = options?.scale ?? 1;
        if (!isInView(position, VIEW_MARGIN * scale))
            return;

        const emitter = new ParticleEmitterHandle(effect, config);
        emitter.setPose(position, options?.direction ?? UP);
        emitter.setScales(1, 1, scale);
        if (options?.tintHex)
            emitter.setTint(options.tintHex);
        emitter.oneShot = true;
        emitter.wasInView = true;
        emitter.burstPending = false;
        spawnBursts(emitter);
        if (config.layers.some(layer => (layer.rate ?? 0) > 0 && (layer.duration ?? 0) > 0))
            emitters.add(emitter);
    },
    // A continuous emitter, running until stopped.
    createEmitter: (effect: string): ParticleEmitterHandle | undefined =>
    {
        if (!loaded)
            return undefined;
        const config = ParticleEffectConfigMap.getConfig(effect);
        if (config == undefined)
        {
            console.warn(`ParticleSystem.createEmitter :: Unknown effect (effect = ${effect})`);
            return undefined;
        }
        const emitter = new ParticleEmitterHandle(effect, config);
        emitters.add(emitter);
        return emitter;
    },
    // A persistent sprite, drawn until released. Undefined when its batch has no free slot.
    createSprite: (sprite: string): SpriteHandle | undefined =>
    {
        if (!loaded)
            return undefined;
        const config = SpriteConfigMap.getConfig(sprite);
        const row = ParticleParamTextureUtil.getSpriteRow(sprite);
        if (config == undefined || row == undefined)
        {
            console.warn(`ParticleSystem.createSprite :: Unknown sprite (sprite = ${sprite})`);
            return undefined;
        }
        const batch = (config.renderState === "solid") ? solidBatch : blendedBatch;
        const slot = batch.rentSlot(row, clock);
        if (slot == undefined)
        {
            console.warn(`ParticleSystem.createSprite :: Every ${config.renderState} sprite slot is taken (sprite = ${sprite})`);
            return undefined;
        }
        const handle = new SpriteHandle(sprite, batch, slot, () => clock,
            (released: SpriteHandle) => sprites.delete(released));
        sprites.add(handle);
        return handle;
    },
    getStats: (): {particles: number, sprites: number, overwrites: number} =>
    {
        if (!loaded)
            return {particles: 0, sprites: 0, overwrites: 0};
        return {
            particles: blendedBatch.getNumLiveParticles(clock) + solidBatch.getNumLiveParticles(clock),
            sprites: blendedBatch.getNumLiveSprites() + solidBatch.getNumLiveSprites(),
            overwrites: blendedBatch.getNumOverwrites() + solidBatch.getNumOverwrites(),
        };
    },
}

async function build(): Promise<void>
{
    // The materials are built around the atlas and read the parameter rows, so both come first.
    ParticleMaterialUtil.setTextures(ParticleAtlasUtil.build(), ParticleParamTextureUtil.bake());
    blendedBatch = new ParticleBatch("blended", BLENDED_SLOTS, BLENDED_RING);
    solidBatch = new ParticleBatch("solid", SOLID_SLOTS, SOLID_RING);
    await blendedBatch.load();
    await solidBatch.load();
    loaded = true;
}

function tickEmitter(emitter: ParticleEmitterHandle, deltaTime: number, density: number)
{
    const layers = emitter.config.layers;
    emitter.elapsed += deltaTime;
    if (emitter.stopped || (emitter.oneShot && layers.every(layer => emitter.elapsed > (layer.duration ?? 0))))
    {
        emitters.delete(emitter);
        return;
    }

    const inView = isInView(emitter.position, VIEW_MARGIN * emitter.sizeScale);
    const cameIntoView = inView && !emitter.wasInView;
    emitter.wasInView = inView;
    if (!inView)
        return;
    if (emitter.burstPending)
    {
        emitter.burstPending = false;
        spawnBursts(emitter);
    }

    const rows = ParticleParamTextureUtil.getLayerRows(emitter.effect)!;
    for (let i = 0; i < layers.length; ++i)
    {
        const layer = layers[i];
        const rate = (layer.rate ?? 0) * emitter.rateScale * density;
        if (rate <= 0 || (emitter.oneShot && emitter.elapsed > (layer.duration ?? 0)))
            continue;

        // Back in view, or new: fill the stream as if it had been running all along.
        if (cameIntoView && !emitter.oneShot)
        {
            const span = layer.lifetime[1];
            const count = Math.floor(rate * getLevel(emitter, clock) * span);
            for (let k = 0; k < count; ++k)
            {
                const spawnTime = clock - Math.random() * span;
                spawn(emitter, layer, rows[i], spawnTime, getLevel(emitter, spawnTime));
            }
            emitter.owed[i] = 0;
            continue;
        }

        emitter.owed[i] += rate * getLevel(emitter, clock) * deltaTime;
        const count = Math.floor(emitter.owed[i]);
        emitter.owed[i] -= count;
        for (let k = 0; k < count; ++k)
        {
            // Spread across the frame, so a stream doesn't come out in clumps.
            const spawnTime = clock - deltaTime * (1 - (k + 0.5) / count);
            spawn(emitter, layer, rows[i], spawnTime, getLevel(emitter, spawnTime));
        }
    }
}

function spawnBursts(emitter: ParticleEmitterHandle)
{
    const rows = ParticleParamTextureUtil.getLayerRows(emitter.effect)!;
    emitter.config.layers.forEach((layer, i) =>
    {
        for (let k = 0; k < (layer.burst ?? 0); ++k)
            spawn(emitter, layer, rows[i], clock, 1);
    });
}

function spawn(emitter: ParticleEmitterHandle, layer: ParticleLayerConfig, row: number, spawnTime: number,
    level: number)
{
    const batch = (layer.renderState === "solid") ? solidBatch : blendedBatch;
    ParticleSpawnUtil.fill(spawnTemp, emitter, layer, row, spawnTime, level, emitter.packedTint);
    if (!batch.writeParticle(spawnTemp, clock) && !ringlessWarnings.has(emitter.effect))
    {
        ringlessWarnings.add(emitter.effect);
        console.warn(`ParticleSystem :: The ${batch.renderState} batch holds no transient particles (effect = ${emitter.effect})`);
    }
}

// A negative level emits nothing rather than owing particles.
function getLevel(emitter: ParticleEmitterHandle, time: number): number
{
    return Math.max(0, WaveformUtil.getLevel(emitter.level, time));
}

// From the camera as last rendered, which is at most a frame old.
function updateFrustum()
{
    const camera = GraphicsManager.getCamera();
    projectionTemp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projectionTemp);
    cameraPositionTemp.setFromMatrixPosition(camera.matrixWorld);
}

function isInView(position: Vec3, margin: number): boolean
{
    sphereTemp.center.set(position.x, position.y, position.z);
    sphereTemp.radius = margin;
    return sphereTemp.center.distanceTo(cameraPositionTemp) <= MAX_SPAWN_DISTANCE + margin &&
        frustum.intersectsSphere(sphereTemp);
}

// Keeps the clock where float32 still resolves it finely. Emitter levels advance by the same interval, so
// they stay in step with what the shader shows.
function rebaseClock(delta: number)
{
    clock -= delta;
    blendedBatch.shiftTimes(delta);
    solidBatch.shiftTimes(delta);
    for (const emitter of emitters)
    {
        const phase = emitter.level.phase + emitter.level.frequency * delta;
        emitter.level.phase = phase - Math.floor(phase);
    }
}

export default ParticleSystem;
