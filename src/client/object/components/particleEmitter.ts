import Vec3 from "../../../shared/math/types/vec3";
import Waveform from "../../../shared/math/types/waveform";
import WaveformUtil from "../../../shared/math/util/waveformUtil";
import Geometry3DUtil from "../../../shared/math/util/geometry3DUtil";
import ObjectScaleUtil from "../../../shared/object/util/objectScaleUtil";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import { ObjectMetadata } from "../../../shared/object/types/objectMetadata";
import ParticleEmitterDescriptor from "../../../shared/graphics/particle/types/particleEmitterDescriptor";
import ParticleSystem from "../../graphics/particle/particleSystem";
import ParticleEmitterHandle from "../../graphics/particle/types/particleEmitterHandle";
import { roomShapeChangedObservable } from "../../system/clientObservables";
import App from "../../app";
import GameObjectComponent from "./gameObjectComponent";

// No stream reaches farther than this before a wall stops it.
const MAX_STOP_DISTANCE = 32;

// A stream of particles out of its object's face (see ParticleSystem.createEmitter), resolved like
// AnimatedSprite's: its type's baseline, changed by what getOverride makes of the object's metadata. Sized
// to the object's footprint. One that walls stop is re-measured whenever the room's blocks change.
export default class ParticleEmitter extends GameObjectComponent
{
    private handle: ParticleEmitterHandle | undefined;
    private level: Waveform | undefined;
    private listeningForRoomShape = false;

    async onSpawn(): Promise<void>
    {
        this.refresh();
    }

    async onDespawn(): Promise<void>
    {
        this.handle?.stop();
        this.handle = undefined;
        this.setListeningForRoomShape(false);
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
        const descriptor = this.resolveDescriptor();
        if (this.handle != undefined && this.handle.effect !== descriptor.effect)
        {
            this.handle.stop();
            this.handle = undefined;
        }
        if (this.handle == undefined)
        {
            this.handle = ParticleSystem.createEmitter(descriptor.effect);
            this.level = undefined;
        }
        if (this.handle == undefined)
            return;

        const params = this.gameObject.params;
        const size = ObjectScaleUtil.getObjectSize(params.objectTypeIndex, params.transform.scale);
        this.handle.setPose(this.getOrigin(descriptor), this.getNormal());
        this.handle.setScales(descriptor.rateScale ?? 1, descriptor.speedScale ?? 1, Math.max(size.x, size.y));
        // Only a real change, so the level's phase carries on (see ParticleSystem's clock rebase).
        const level = descriptor.level ?? WaveformUtil.constant(1);
        if (this.level == undefined || !WaveformUtil.equals(level, this.level))
        {
            this.level = {...level};
            this.handle.setLevel(level);
        }
        this.setListeningForRoomShape(descriptor.stopAtBlocks ?? false);
        this.refreshStopDistance(descriptor);
    }

    private refreshStopDistance(descriptor: ParticleEmitterDescriptor): void
    {
        const voxels = App.getCurrentRoom()?.voxelGrid.voxels;
        const stopDistance = (descriptor.stopAtBlocks && voxels != undefined)
            ? VoxelQueryUtil.getDistanceToOccupiedBlock(voxels, this.getOrigin(descriptor), this.getNormal(),
                MAX_STOP_DISTANCE)
            : Infinity;
        this.handle?.setStopDistance(stopDistance);
    }

    private resolveDescriptor(): ParticleEmitterDescriptor
    {
        const config = this.componentConfig as {baseline: ParticleEmitterDescriptor,
            getOverride?: (metadata: ObjectMetadata) => Partial<ParticleEmitterDescriptor> | undefined};
        return {...config.baseline, ...(config.getOverride?.(this.gameObject.params.metadata) ?? {})};
    }

    private getNormal(): Vec3
    {
        return Geometry3DUtil.getAxisFacingBasis(this.gameObject.params.transform.dir).normal;
    }

    private getOrigin(descriptor: ParticleEmitterDescriptor): Vec3
    {
        const pos = this.gameObject.params.transform.pos;
        const normal = this.getNormal();
        const offset = descriptor.faceOffset ?? 0;
        return {x: pos.x + normal.x * offset, y: pos.y + normal.y * offset, z: pos.z + normal.z * offset};
    }

    private setListeningForRoomShape(listen: boolean): void
    {
        if (listen === this.listeningForRoomShape)
            return;
        const key = `${this.gameObject.params.objectId}.ParticleEmitter`;
        if (listen)
            roomShapeChangedObservable.addListener(key, () => this.refreshStopDistance(this.resolveDescriptor()));
        else
            roomShapeChangedObservable.removeListener(key);
        this.listeningForRoomShape = listen;
    }
}
