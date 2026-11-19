import GameObject from "./gameObject";
import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import FanObjectTypeConfig from "../../../../shared/object/types/objectTypeConfig/fanObjectTypeConfig";
import Vec3 from "../../../../shared/math/types/vec3";
import Geometry3DUtil from "../../../../shared/math/util/geometry3DUtil";
import InstancedMeshComposer from "../../components/instancedMeshComposer";
import AudioManager from "../../../audio/audioManager";
import SpatialAudioVoice from "../../../audio/types/spatialAudioVoice";

// How its wind sounds with one blade, and how much louder and higher with each more.
export const ONE_BLADE_WIND_VOLUME = 0.35;
export const WIND_VOLUME_PER_BLADE = 0.1;
export const ONE_BLADE_WIND_RATE = 0.9;
export const WIND_RATE_PER_BLADE = 0.1;
// How far past where its push reaches its wind is heard, in world units.
export const WIND_HEARD_PAST_REACH = 5;
// How far in front of its face its wind is heard from: in the air it blows through, so that the wall it hangs on muffles
// it for anyone beyond.
export const WIND_SOURCE_OFFSET = 0.25;

// A fan: a composed housing, blades turning in their vents and a wind out of it. The blades and the wind are its
// AnimatedSprite and ParticleEmitter, which follow its setting on their own, as its push does (see
// FanObjectTypeConfig, PhysicsForceUtil); the housing is recomposed here in its color, and the wind sounds from here.
export default class FanGameObject extends GameObject
{
    private instancedMeshComposer: InstancedMeshComposer;
    private wind: SpatialAudioVoice | undefined;

    constructor(params: AddObjectSignal)
    {
        super(params);

        this.instancedMeshComposer = this.components.instancedMeshComposer as InstancedMeshComposer;
        if (!this.instancedMeshComposer)
            throw new Error("FanGameObject requires InstancedMeshComposer component");
        if (!this.components.animatedSprite)
            throw new Error("FanGameObject requires AnimatedSprite component");
        if (!this.components.particleEmitter)
            throw new Error("FanGameObject requires ParticleEmitter component");
    }

    async onSpawn(): Promise<void>
    {
        await super.onSpawn();
        this.startWind();
    }

    async onDespawn(): Promise<void>
    {
        this.wind?.stop();
        this.wind = undefined;
        await super.onDespawn();
    }

    // The housing's color is derived from the fan's own key rather than stored in the composition (see
    // FanObjectTypeConfig).
    onSetMetadata(key: ObjectMetadataKey, value: string)
    {
        super.onSetMetadata(key, value);
        if (key === ObjectMetadataKeyEnumMap.FanColor)
            this.instancedMeshComposer.rebuildParts();
        else if (key === ObjectMetadataKeyEnumMap.ForceProperties)
            this.startWind();
    }

    onTransformChanged(resized: boolean)
    {
        super.onTransformChanged(resized);
        this.wind?.setPosition(this.getWindSource());
    }

    // Anew for a new setting, since a voice takes its pitch as it starts.
    private startWind(): void
    {
        const {blades, range} = FanObjectTypeConfig.util.getSetting(this.params.metadata);
        this.wind?.stop();
        this.wind = AudioManager.playLoopAt("fan/wind", this.getWindSource(), {
            volume: ONE_BLADE_WIND_VOLUME + WIND_VOLUME_PER_BLADE * (blades - 1),
            rate: ONE_BLADE_WIND_RATE + WIND_RATE_PER_BLADE * (blades - 1),
            range: range + WIND_HEARD_PAST_REACH,
        });
    }

    private getWindSource(): Vec3
    {
        const pos = this.params.transform.pos;
        const normal = Geometry3DUtil.getAxisFacingBasis(this.params.transform.dir).normal;
        return {x: pos.x + WIND_SOURCE_OFFSET * normal.x, y: pos.y + WIND_SOURCE_OFFSET * normal.y,
            z: pos.z + WIND_SOURCE_OFFSET * normal.z};
    }
}
