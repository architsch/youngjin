import * as THREE from "three";
import GameObjectComponent from "./gameObjectComponent";
import Vec3 from "../../../shared/math/types/vec3";

// A brief cosmetic motion (pop, nod, ...) on GameObject.visualObj, never obj, so gameplay transforms
// are unaffected. visualObj rests at identity and nothing else writes it, so re-triggering is safe.
export default class EasingMotion extends GameObjectComponent
{
    private elapsed = -1; // seconds into the active motion, or negative when idle
    private duration = 0;
    private positionOffset = new THREE.Vector3();
    private rotationOffset = new THREE.Euler();
    private scaleMultiplier = new THREE.Vector3(1, 1, 1);
    private oscillations = 1;

    private eulerTemp = new THREE.Euler();

    // Starts or restarts a motion. oscillations = 0.5 is one out-and-back; larger values give a
    // decaying bob. Omitted channels stay at rest.
    bounce(params: {
        durationSeconds: number,
        positionOffset?: Vec3,
        rotationOffset?: Vec3,
        scaleMultiplier?: Vec3,
        oscillations?: number,
    }): void
    {
        if (params.durationSeconds <= 0)
            return;

        this.duration = params.durationSeconds;
        this.positionOffset.set(params.positionOffset?.x ?? 0, params.positionOffset?.y ?? 0, params.positionOffset?.z ?? 0);
        this.rotationOffset.set(params.rotationOffset?.x ?? 0, params.rotationOffset?.y ?? 0, params.rotationOffset?.z ?? 0);
        this.scaleMultiplier.set(params.scaleMultiplier?.x ?? 1, params.scaleMultiplier?.y ?? 1, params.scaleMultiplier?.z ?? 1);
        this.oscillations = params.oscillations ?? 1;

        this.elapsed = 0;
    }

    update(deltaTime: number): void
    {
        if (this.elapsed < 0)
            return;

        const node = this.gameObject.visualObj;

        this.elapsed += deltaTime;

        if (this.elapsed >= this.duration) // Motion finished: snap the visuals back to their resting pose.
        {
            node.position.set(0, 0, 0);
            node.quaternion.identity();
            node.scale.set(1, 1, 1);
            this.elapsed = -1;
        }
        else
        {
            const t = this.elapsed / this.duration;
            // Sine carrier with a (1 - t) envelope: starts and ends at rest.
            const weight = Math.sin(2 * Math.PI * this.oscillations * t) * (1 - t);

            node.position.copy(this.positionOffset).multiplyScalar(weight);

            this.eulerTemp.set(
                this.rotationOffset.x * weight,
                this.rotationOffset.y * weight,
                this.rotationOffset.z * weight);
            node.quaternion.setFromEuler(this.eulerTemp);

            node.scale.set(
                1 + (this.scaleMultiplier.x - 1) * weight,
                1 + (this.scaleMultiplier.y - 1) * weight,
                1 + (this.scaleMultiplier.z - 1) * weight);
        }

        // Instanced meshes are baked, so they must be re-applied (no-op without instanced graphics).
        this.gameObject.onVisualTransformChanged();
    }
}
