import * as THREE from "three";
import GameObjectComponent from "./gameObjectComponent";
import Vec3 from "../../../shared/math/types/vec3";

// Performs a brief, self-contained easing motion on the owning GameObject's *visual* node: it
// offsets, rotates, and/or scales the meshes away from their resting pose and lets them ease back
// over a short interval. The motion is generic and parameterized via "bounce", so it can express
// anything from a single "pop" to a repeated "nod".
//
// It animates GameObject.visualObj — not GameObject.obj — so the cosmetic bounce never disturbs the
// authoritative gameplay transform (which networking, physics, the camera, and proximity logic read
// and write on "obj"). visualObj rests at identity, so the motion simply interpolates between
// identity and the peak offset/rotation/scale; nothing else writes visualObj, so there is no
// ordering dependency and re-triggering mid-bounce is safe.
export default class EasingMotion extends GameObjectComponent
{
    private elapsed = -1; // seconds into the active motion, or negative when idle
    private duration = 0;
    private positionOffset = new THREE.Vector3();
    private rotationOffset = new THREE.Euler();
    private scaleMultiplier = new THREE.Vector3(1, 1, 1);
    private oscillations = 1;

    private eulerTemp = new THREE.Euler();

    // Triggers (or restarts) a motion. The visuals ease to their peak offset/rotation/scale and
    // back to rest over "durationSeconds". "oscillations" controls how many swings happen along the
    // way: a value of 0.5 gives a single out-and-back, while larger values produce a repeated,
    // decaying bob (e.g. a nod). Omitted offsets/multipliers leave that channel at rest.
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
            // A weight that starts and ends at 0 so the visuals ease out and back to rest: the sine
            // carrier produces "oscillations" swings while the (1 - t) envelope tapers them.
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

        // Scene-graph meshes (Mesh/Model graphics) follow "node" automatically; baked instanced meshes
        // don't, so let the GameObject re-apply them. No-op for objects without instanced graphics.
        this.gameObject.onVisualTransformChanged();
    }
}
