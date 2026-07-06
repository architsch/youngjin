import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import { INSTANCED_COLOR_MATERIAL_ID, INSTANCED_EYE_MATERIAL_ID } from "../../../shared/system/sharedConstants";
import InstancedMeshComposition from "./helpers/mesh/instancedMeshComposition";
import InstancedMeshCompositionPart from "../../../shared/graphics/mesh/composition/types/instancedMeshCompositionPart";
import GameObject from "../types/gameObject";
import GameObjectComponent from "./gameObjectComponent";
import InstancedMeshGraphics from "./instancedMeshGraphics";
import MaterialParamsMap from "../../../shared/graphics/material/maps/materialParamsMap";

export default class InstancedMeshComposer extends GameObjectComponent
{
    private instancedMeshGraphics: InstancedMeshGraphics;
    private instancedMeshComposition: InstancedMeshComposition;
    private instanceIdsByInstancedMeshId: {[instancedMeshId: string]: number[]} = {};
    private nextIndexByInstancedMeshIdTemp: {[instancedMeshId: string]: number} = {};
    private instancedMeshUpdateOngoing: boolean = false;
    private hidden: boolean = false;

    constructor(gameObject: GameObject, componentConfig: {[key: string]: any})
    {
        super(gameObject, componentConfig);

        this.instancedMeshGraphics = gameObject.components.instancedMeshGraphics as InstancedMeshGraphics;
        if (!this.instancedMeshGraphics)
            throw new Error("InstancedMeshComposer requires InstancedMeshGraphics component");

        this.instancedMeshComposition = new InstancedMeshComposition(
            componentConfig.codecType, componentConfig.codecVersion);
    }

    async onSpawn(): Promise<void>
    {
        this.instancedMeshComposition.loadFromMetadata(this.gameObject);
    }

    async onDespawn(): Promise<void>
    {
        // Return all instances.
        for (const instancedMeshId in this.instanceIdsByInstancedMeshId)
        {
            const instanceIds = this.instanceIdsByInstancedMeshId[instancedMeshId];
            const ids = instancedMeshId.split("+");
            const geometryId = ids[0];
            const materialId = ids[1];
            for (const instanceId of instanceIds)
                this.instancedMeshGraphics.returnInstanceToPool(geometryId, materialId, instanceId);
        }
    }

    onSetMetadata(key: ObjectMetadataKey, value: string): void
    {
        if (key !== ObjectMetadataKeyEnumMap.InstancedMeshComposition)
            return;
        this.instancedMeshComposition.loadFromMetadata(this.gameObject);
    }

    update(deltaTime: number)
    {
        this.updateInstancedMeshes();
    }

    setHidden(hidden: boolean)
    {
        this.hidden = hidden;
    }

    saveParts()
    {
        this.instancedMeshComposition.saveToMetadata(this.gameObject);
    }
    encodeParts(): string
    {
        return this.instancedMeshComposition.encodeParts();
    }
    decodeParts(encodedParams: string)
    {
        this.instancedMeshComposition.decodeParts(encodedParams);
    }
    getParts(): InstancedMeshCompositionPart[]
    {
        return this.instancedMeshComposition.parts;
    }
    addPart(part: InstancedMeshCompositionPart)
    {
        this.instancedMeshComposition.parts.push(part);
    }
    updatePart(instancedMeshId: string, instanceId: number, partNew: InstancedMeshCompositionPart)
    {
        const partIndex = this.getPartIndex(instancedMeshId, instanceId);
        this.updatePartAtIndex(partIndex, partNew);
    }
    updatePartAtIndex(partIndex: number, partNew: InstancedMeshCompositionPart)
    {
        if (partIndex >= 0)
            this.instancedMeshComposition.parts[partIndex] = partNew;
        else
            console.error(`InstancedMeshComposer::updatePartAtIndex :: Part not found (partIndex = ${partIndex}, partNew = ${JSON.stringify(partNew)})`);
    }
    removePart(instancedMeshId: string, instanceId: number)
    {
        const partIndex = this.getPartIndex(instancedMeshId, instanceId);
        if (partIndex >= 0)
            this.instancedMeshComposition.parts.splice(partIndex, 1);
        else
            console.error(`InstancedMeshComposer::removePart :: Part not found (partIndex = ${partIndex})`);
    }

    private getPartIndex(instancedMeshId: string, instanceId: number): number
    {
        let instanceIds = this.instanceIdsByInstancedMeshId[instancedMeshId];
        if (instanceIds == undefined)
        {
            console.error(`InstancedMeshComposer::getPartIndex :: InstanceIds not found (instancedMeshId = ${instancedMeshId}, instanceId = ${instanceId})`);
            return -1;
        }

        let index = -1;
        const parts = this.instancedMeshComposition.parts;
        for (let i = 0; i < parts.length; ++i)
        {
            if (parts[i].instancedMeshId != instancedMeshId)
                continue;
            if (instanceIds[++index] === instanceId)
                return i;
        }
        console.error(`InstancedMeshComposer::getPartIndex :: Part not found (instancedMeshId = ${instancedMeshId}, instanceId = ${instanceId})`);
        return -1;
    }

    private async updateInstancedMeshes()
    {
        if (this.instancedMeshUpdateOngoing)
            return;
        this.instancedMeshUpdateOngoing = true;

        for (const instancedMeshId in this.nextIndexByInstancedMeshIdTemp)
            this.nextIndexByInstancedMeshIdTemp[instancedMeshId] = 0;

        const parts = this.instancedMeshComposition.parts;
        for (let i = 0; i < parts.length; ++i)
        {
            const part = parts[i];
            let nextIndex = this.nextIndexByInstancedMeshIdTemp[part.instancedMeshId];
            if (nextIndex == undefined)
            {
                nextIndex = 0;
                this.nextIndexByInstancedMeshIdTemp[part.instancedMeshId] = 1;
            }
            else
            {
                this.nextIndexByInstancedMeshIdTemp[part.instancedMeshId]++;
            }

            let instanceIds = this.instanceIdsByInstancedMeshId[part.instancedMeshId];
            if (instanceIds == undefined)
            {
                instanceIds = [];
                this.instanceIdsByInstancedMeshId[part.instancedMeshId] = instanceIds;
            }

            const ids = part.instancedMeshId.split("+");
            const geometryId = ids[0];
            const materialId = ids[1];

            // Rent a new instance if needed.
            let instanceId = instanceIds[nextIndex];
            if (instanceId == undefined)
            {
                // Ensure that the necessary InstancedMesh has been loaded.
                await this.instancedMeshGraphics.loadInstancedMesh(
                    geometryId, MaterialParamsMap.getParamsById(materialId),
                    this.componentConfig.maxNumInstancesPerMesh, true);

                instanceId = this.instancedMeshGraphics.rentInstanceFromPool(geometryId, materialId);
                instanceIds.push(instanceId);
            }

            this.instancedMeshGraphics.updateInstanceTransform(
                geometryId, materialId, instanceId,
                part.offset.x, this.hidden ? -9999 : part.offset.y, part.offset.z,
                part.dir.x, part.dir.y, part.dir.z, part.scale.x, part.scale.y, part.scale.z);
            if (materialId == INSTANCED_COLOR_MATERIAL_ID)
            {
                this.instancedMeshGraphics.updateInstanceColor(
                    geometryId, materialId, instanceId,
                    part.color!.x, part.color!.y, part.color!.z);
            }
            else if (materialId == INSTANCED_EYE_MATERIAL_ID)
            {
                this.instancedMeshGraphics.updateInstanceEyeColors(
                    geometryId, materialId, instanceId,
                    part.pupilColor!.x, part.pupilColor!.y, part.pupilColor!.z,
                    part.irisColor!.x, part.irisColor!.y, part.irisColor!.z);

                // The eye square is scaled to the larger of the two radii (see PlayerCompositionCodec),
                // so that circle spans the full square; express both radii as fractions of the
                // square's side length (0.5 = touches the square's edges).
                const maxEyeRadius = Math.max(part.pupilRadius!, part.irisRadius!);
                const radiusToSideFraction = (maxEyeRadius > 0) ? (0.5 / maxEyeRadius) : 0;
                this.instancedMeshGraphics.updateInstanceEyeRadii(
                    geometryId, materialId, instanceId,
                    part.pupilRadius! * radiusToSideFraction,
                    part.irisRadius! * radiusToSideFraction);
            }
        }

        // Return obsolete instances.
        for (const instancedMeshId in this.nextIndexByInstancedMeshIdTemp)
        {
            const nextIndex = this.nextIndexByInstancedMeshIdTemp[instancedMeshId];

            const instanceIds = this.instanceIdsByInstancedMeshId[instancedMeshId];
            if (instanceIds !== undefined)
            {
                const ids = instancedMeshId.split("+");
                const geometryId = ids[0];
                const materialId = ids[1];
                for (let obsoleteIndex = nextIndex; obsoleteIndex < instanceIds.length; ++obsoleteIndex)
                {
                    this.instancedMeshGraphics.returnInstanceToPool(
                        geometryId, materialId, instanceIds[obsoleteIndex]);
                }
            }
        }
        this.instancedMeshUpdateOngoing = false;
    }
}