import Vec2 from "../../../shared/math/types/vec2";
import Vec3 from "../../../shared/math/types/vec3";
import WaveformUtil from "../../../shared/math/util/waveformUtil";
import Geometry3DUtil from "../../../shared/math/util/geometry3DUtil";
import ObjectScaleUtil from "../../../shared/object/util/objectScaleUtil";
import { ObjectMetadata } from "../../../shared/object/types/objectMetadata";
import AnimatedSpriteDescriptor from "../../../shared/graphics/particle/types/animatedSpriteDescriptor";
import ParticleSystem from "../../graphics/particle/particleSystem";
import SpriteHandle from "../../graphics/particle/types/spriteHandle";
import GameObjectComponent from "./gameObjectComponent";

const MIDDLE_ONLY: Vec2[] = [{x: 0, y: 0}];

// A persistent animated sprite on its object's face (see ParticleSystem.createSprite), shown at each of its
// centers. It shows its type's baseline, changed by whatever the type's getOverride makes of the object's
// metadata; the component reads no metadata key itself. Like LightSource, it follows the stored placement and
// never updates per frame: the shader animates it from its rate alone.
export default class AnimatedSprite extends GameObjectComponent
{
    private handles: SpriteHandle[] = [];

    async onSpawn(): Promise<void>
    {
        this.refresh();
    }

    async onDespawn(): Promise<void>
    {
        this.releaseFrom(0);
    }

    // Whatever the key: only the type's own getOverride knows which ones matter.
    onSetMetadata(): void
    {
        this.refresh();
    }

    onTransformChanged(_resized: boolean): void
    {
        this.refresh();
    }

    private refresh(): void
    {
        const config = this.componentConfig as {baseline: AnimatedSpriteDescriptor,
            getOverride?: (metadata: ObjectMetadata) => Partial<AnimatedSpriteDescriptor> | undefined};
        const params = this.gameObject.params;
        const descriptor: AnimatedSpriteDescriptor =
            {...config.baseline, ...(config.getOverride?.(params.metadata) ?? {})};
        const centers = descriptor.centers ?? MIDDLE_ONLY;

        if (this.handles.length > 0 && this.handles[0].sprite !== descriptor.sprite)
            this.releaseFrom(0);
        this.releaseFrom(centers.length);
        while (this.handles.length < centers.length)
        {
            const handle = ParticleSystem.createSprite(descriptor.sprite);
            if (handle == undefined)
                break;
            this.handles.push(handle);
        }

        const {pos, dir, scale} = params.transform;
        const {normal, right, up} = Geometry3DUtil.getAxisFacingBasis(dir);
        const size = ObjectScaleUtil.getObjectSize(params.objectTypeIndex, scale);
        const offset = descriptor.faceOffset ?? 0;
        this.handles.forEach((handle, i) => {
            const across = centers[i].x * size.x, upward = centers[i].y * size.y;
            const position: Vec3 = {
                x: pos.x + normal.x * offset + right.x * across + up.x * upward,
                y: pos.y + normal.y * offset + right.y * across + up.y * upward,
                z: pos.z + normal.z * offset + right.z * across + up.z * upward,
            };
            handle.setPose(position, normal, descriptor.quarterTurns ?? 0,
                size.x * (descriptor.widthScale ?? 1), size.y * (descriptor.heightScale ?? 1));
            handle.setRate(descriptor.rate ?? WaveformUtil.constant(1));
            handle.setTint(descriptor.tintHex ?? "#ffffff");
        });
    }

    private releaseFrom(index: number): void
    {
        for (const handle of this.handles.splice(index))
            handle.release();
    }
}
