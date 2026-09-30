import Vec3 from "../../../shared/math/types/vec3";
import WaveformUtil from "../../../shared/math/util/waveformUtil";
import Geometry3DUtil from "../../../shared/math/util/geometry3DUtil";
import ObjectScaleUtil from "../../../shared/object/util/objectScaleUtil";
import { ObjectMetadata } from "../../../shared/object/types/objectMetadata";
import AnimatedSpriteDescriptor from "../../../shared/graphics/particle/types/animatedSpriteDescriptor";
import ParticleSystem from "../../graphics/particle/particleSystem";
import SpriteHandle from "../../graphics/particle/types/spriteHandle";
import GameObjectComponent from "./gameObjectComponent";

// A persistent animated sprite on its object's face (see ParticleSystem.createSprite). It shows its type's
// baseline, changed by whatever the type's getOverride makes of the object's metadata; the component reads
// no metadata key itself. Like LightSource, it follows the stored placement and never updates per frame:
// the shader animates it from its rate alone.
export default class AnimatedSprite extends GameObjectComponent
{
    private handle: SpriteHandle | undefined;

    async onSpawn(): Promise<void>
    {
        this.refresh();
    }

    async onDespawn(): Promise<void>
    {
        this.handle?.release();
        this.handle = undefined;
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

        if (this.handle != undefined && this.handle.sprite !== descriptor.sprite)
        {
            this.handle.release();
            this.handle = undefined;
        }
        this.handle ??= ParticleSystem.createSprite(descriptor.sprite);
        if (this.handle == undefined)
            return;

        const {pos, dir, scale} = params.transform;
        const {normal} = Geometry3DUtil.getAxisFacingBasis(dir);
        const size = ObjectScaleUtil.getObjectSize(params.objectTypeIndex, scale);
        const offset = descriptor.faceOffset ?? 0;
        const position: Vec3 = {x: pos.x + normal.x * offset, y: pos.y + normal.y * offset, z: pos.z + normal.z * offset};
        this.handle.setPose(position, normal, descriptor.quarterTurns ?? 0,
            size.x * (descriptor.widthScale ?? 1), size.y * (descriptor.heightScale ?? 1));
        this.handle.setRate(descriptor.rate ?? WaveformUtil.constant(1));
        this.handle.setTint(descriptor.tintHex ?? "#ffffff");
    }
}
