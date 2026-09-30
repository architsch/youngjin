import * as THREE from "three";
import Vec3 from "../../../../shared/math/types/vec3";
import Waveform from "../../../../shared/math/types/waveform";
import WaveformUtil from "../../../../shared/math/util/waveformUtil";
import Geometry3DUtil from "../../../../shared/math/util/geometry3DUtil";
import ParticleEffectConfig from "./particleEffectConfig";
import ParticleColorUtil from "../util/particleColorUtil";

// A continuous emitter (see ParticleSystem.createEmitter). Its owner sets its pose and levels when they
// change; ParticleSystem spawns from it each frame while it is in view. The effect's frame is its
// forward direction and the in-plane axes a face gives it (see Geometry3DUtil.getFacingBasis).
export default class ParticleEmitterHandle
{
    readonly effect: string;
    readonly config: ParticleEffectConfig;
    readonly position = new THREE.Vector3();
    readonly forward = new THREE.Vector3(0, 1, 0);
    readonly right = new THREE.Vector3(1, 0, 0);
    readonly up = new THREE.Vector3(0, 0, -1);
    rateScale = 1;
    speedScale = 1;
    sizeScale = 1;
    level: Waveform = WaveformUtil.constant(1);
    // How far along forward its particles may travel before they end.
    stopDistance = Infinity;
    packedTint = ParticleColorUtil.WHITE;
    // Particles owed to each layer, carried between frames.
    readonly owed: number[];
    // A played effect (see ParticleSystem.play): its rate layers emit only for their durations.
    oneShot = false;
    elapsed = 0;
    // Its layers' bursts go off once, the first time it is in view.
    burstPending = true;
    stopped = false;
    wasInView = false;

    constructor(effect: string, config: ParticleEffectConfig)
    {
        this.effect = effect;
        this.config = config;
        this.owed = config.layers.map(() => 0);
    }

    setPose(position: Vec3, forward: Vec3): void
    {
        this.position.set(position.x, position.y, position.z);
        this.forward.set(forward.x, forward.y, forward.z).normalize();
        const {right, up} = Geometry3DUtil.getFacingBasis(forward);
        this.right.set(right.x, right.y, right.z);
        this.up.set(up.x, up.y, up.z);
    }

    setScales(rateScale: number, speedScale: number, sizeScale: number = 1): void
    {
        this.rateScale = rateScale;
        this.speedScale = speedScale;
        this.sizeScale = sizeScale;
    }

    // Scales emission rate and speed over time.
    setLevel(level: Waveform): void
    {
        this.level = {...level};
    }

    setStopDistance(distance: number): void
    {
        this.stopDistance = distance;
    }

    setTint(hex: string): void
    {
        this.packedTint = ParticleColorUtil.packHex(hex);
    }

    // Its particles already in flight finish their lives.
    stop(): void
    {
        this.stopped = true;
    }
}
