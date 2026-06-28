import Vec3 from "../../../shared/math/types/vec3";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import InstancedMeshComposition from "../../graphics/types/mesh/instancedMeshComposition";
import GameObject from "../types/gameObject";
import GameObjectComponent from "./gameObjectComponent";
import InstancedMeshGraphics from "./instancedMeshGraphics";

const nextIndexByGeometryIdTemp: {[geometryId: string]: number} = {};

export default class InstancedMeshComposer extends GameObjectComponent
{
    private instancedMeshGraphics: InstancedMeshGraphics;
    private instancedMeshComposition: InstancedMeshComposition = new InstancedMeshComposition();
    private instanceIdsByGeometryId: {[geometryId: string]: number[]} = {};
    private instancedMeshUpdateOngoing: boolean = false;
    private hidden: boolean = false;

    constructor(gameObject: GameObject, componentConfig: {[key: string]: any})
    {
        super(gameObject, componentConfig);

        this.instancedMeshGraphics = gameObject.components.instancedMeshGraphics as InstancedMeshGraphics;
        if (!this.instancedMeshGraphics)
            throw new Error("InstancedMeshComposer requires InstancedMeshGraphics component");
    }

    async onSpawn(): Promise<void>
    {
        this.instancedMeshComposition.loadFromMetadata(this.gameObject);
    }

    async onDespawn(): Promise<void>
    {
        // Return all instances.
        for (const geometryId in this.instanceIdsByGeometryId)
        {
            const instanceIds = this.instanceIdsByGeometryId[geometryId];
            for (const instanceId of instanceIds)
                this.instancedMeshGraphics.returnInstanceToPool(geometryId, playerMaterialParams, instanceId);
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

    addPart(geometryId: string, dir: Vec3, offset: Vec3, scale: Vec3, color: Vec3)
    {
        const parts = this.instancedMeshComposition.parts;
        parts.push({geometryId, dir, offset, scale, color});
        this.instancedMeshComposition.saveToMetadata(this.gameObject);
    }
    removePart(geometryId: string, instanceId: number)
    {
        for (const geometryId in nextIndexByGeometryIdTemp)
            nextIndexByGeometryIdTemp[geometryId] = 0;

        let partIndex = -1;
        const parts = this.instancedMeshComposition.parts;
        for (let i = 0; i < parts.length; ++i)
        {
            const part = parts[i];
            let nextIndex = nextIndexByGeometryIdTemp[part.geometryId];
            if (nextIndex == undefined)
            {
                nextIndexByGeometryIdTemp[part.geometryId] = 0;
                nextIndex = 0;
            }
            else
            {
                nextIndexByGeometryIdTemp[part.geometryId]++;
            }

            let instanceIds = this.instanceIdsByGeometryId[part.geometryId];
            if (instanceIds == undefined)
            {
                console.error(`InstanceIds not found (part.geometryId = ${part.geometryId})`);
                break;
            }
            
            if (nextIndex > 0 && instanceIds[nextIndex-1] == instanceId)
            {
                partIndex = i;
                break;
            }
        }

        if (partIndex >= 0)
        {
            parts.splice(partIndex, 1);
            this.instancedMeshComposition.saveToMetadata(this.gameObject);
        }
        else
            console.error(`Part not found (geometryId = ${geometryId}, instanceId = ${instanceId})`);
    }

    private async updateInstancedMeshes()
    {
        if (this.instancedMeshUpdateOngoing)
            return;
        this.instancedMeshUpdateOngoing = true;

        for (const geometryId in nextIndexByGeometryIdTemp)
            nextIndexByGeometryIdTemp[geometryId] = 0;

        const parts = this.instancedMeshComposition.parts;
        for (let i = 0; i < parts.length; ++i)
        {
            const part = parts[i];
            let nextIndex = nextIndexByGeometryIdTemp[part.geometryId];
            if (nextIndex == undefined)
            {
                nextIndexByGeometryIdTemp[part.geometryId] = 0;
                nextIndex = 0;
            }
            else
            {
                nextIndexByGeometryIdTemp[part.geometryId]++;
            }

            let instanceIds = this.instanceIdsByGeometryId[part.geometryId];
            if (instanceIds == undefined)
            {
                instanceIds = [];
                this.instanceIdsByGeometryId[part.geometryId] = instanceIds;
            }

            // Rent a new instance if needed.
            let instanceId = instanceIds[nextIndex];
            if (instanceId == undefined)
            {
                // Ensure that the necessary InstancedMesh has been loaded.
                await this.instancedMeshGraphics.loadInstancedMesh(
                    part.geometryId, playerMaterialParams, this.componentConfig.maxNumInstancesPerMesh, true);

                instanceId = this.instancedMeshGraphics.rentInstanceFromPool(
                    part.geometryId, playerMaterialParams);
                instanceIds.push(instanceId);
            }

            this.instancedMeshGraphics.updateInstanceTransform(
                part.geometryId, playerMaterialParams, instanceId,
                part.offset.x, this.hidden ? -9999 : part.offset.y, part.offset.z,
                part.dir.x, part.dir.y, part.dir.z, part.scale.x, part.scale.y, part.scale.z);
            this.instancedMeshGraphics.updateInstanceColor(
                part.geometryId, playerMaterialParams, instanceId,
                part.color.x, part.color.y, part.color.z);
        }

        // Return obsolete instances.
        for (const geometryId in nextIndexByGeometryIdTemp)
        {
            const nextIndex = nextIndexByGeometryIdTemp[geometryId];

            const instanceIds = this.instanceIdsByGeometryId[geometryId];
            if (instanceIds !== undefined)
            {
                for (let obsoleteIndex = nextIndex; obsoleteIndex < instanceIds.length; ++obsoleteIndex)
                {
                    this.instancedMeshGraphics.returnInstanceToPool(
                        geometryId, playerMaterialParams, instanceIds[obsoleteIndex]);
                }
            }
        }
        this.instancedMeshUpdateOngoing = false;
    }
}