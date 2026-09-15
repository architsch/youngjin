import * as THREE from "three";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import { INSTANCE_COLORED_MATERIAL_IDS, INSTANCED_WOOD_MATERIAL_ID } from "../../../shared/system/sharedConstants";
import InstancedMeshComposition from "./helpers/mesh/instancedMeshComposition";
import { InstancedMeshCompositionParams } from "../../../shared/graphics/mesh/composition/types/compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../../../shared/graphics/mesh/composition/types/instancedMeshCompositionPart";
import GameObject from "../types/gameObject";
import GameObjectComponent from "./gameObjectComponent";
import InstancedMeshGraphics from "./instancedMeshGraphics";
import MaterialParamsMap from "../../../shared/graphics/material/maps/materialParamsMap";
import MeshDataUtil from "../../../shared/graphics/mesh/util/meshDataUtil";
import InstancedMeshCapacityMap from "../../../shared/graphics/mesh/composition/maps/instancedMeshCapacityMap";

// Precomputed "+materialId" suffixes, to avoid splitting ids in the refresh loop (see
// MeshDataUtil.getInstancedMeshId).
const INSTANCE_COLORED_SUFFIXES = INSTANCE_COLORED_MATERIAL_IDS.map(
    (materialId) => MeshDataUtil.getInstancedMeshId("", materialId));
const INSTANCED_WOOD_SUFFIX = MeshDataUtil.getInstancedMeshId("", INSTANCED_WOOD_MATERIAL_ID);

function usesInstanceColor(instancedMeshId: string): boolean
{
    for (let i = 0; i < INSTANCE_COLORED_SUFFIXES.length; ++i)
    {
        if (instancedMeshId.endsWith(INSTANCE_COLORED_SUFFIXES[i]))
            return true;
    }
    return false;
}

export default class InstancedMeshComposer extends GameObjectComponent
{
    private instancedMeshGraphics: InstancedMeshGraphics;
    private instancedMeshComposition: InstancedMeshComposition;
    private instanceIdsByInstancedMeshId: {[instancedMeshId: string]: number[]} = {};
    private nextIndexByInstancedMeshIdTemp: {[instancedMeshId: string]: number} = {};

    // "refreshPending": refresh due (loads meshes first); "meshesLoading": waiting on a load;
    // "upToDate": instances match the parts, re-baked only on movement.
    private updateState: "refreshPending" | "meshesLoading" | "upToDate" = "refreshPending";

    // Instance matrices bake the world transform, so movement also requires a refresh. Stationary
    // frames are skipped by comparing against this.
    private bakedWorldMatrix: THREE.Matrix4 = new THREE.Matrix4();

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
        this.updateState = "refreshPending";
    }

    async onDespawn(): Promise<void>
    {
        // Return all instances.
        for (const instancedMeshId in this.instanceIdsByInstancedMeshId)
        {
            const instanceIds = this.instanceIdsByInstancedMeshId[instancedMeshId];
            for (const instanceId of instanceIds)
                this.instancedMeshGraphics.returnInstanceToPool(instancedMeshId, instanceId);
        }
    }

    onSetMetadata(key: ObjectMetadataKey, value: string): void
    {
        if (key !== ObjectMetadataKeyEnumMap.InstancedMeshComposition)
            return;
        this.reloadComposition();
    }

    // Rebuilds instances from the composition. Public for objects whose appearance is derived (e.g. a
    // lamp's, from its light; see WallLampGameObject), which recompose when that source changes.
    reloadComposition(): void
    {
        this.instancedMeshComposition.loadFromMetadata(this.gameObject);
        this.updateState = "refreshPending";
    }

    update(deltaTime: number)
    {
        switch (this.updateState)
        {
            case "refreshPending": // Composition has been modified, so it needs a refresh.
                if (this.allPartMeshesAreLoaded())
                    this.refreshInstancedMeshes(); // Upon termination, this function call sets "updateState" to "upToDate".
                else
                    this.loadInstancedMeshes(); // Upon start, this function call sets "updateState" to "meshesLoading".
                break;
            case "upToDate":
                if (!this.transformIsInSync())
                    this.refreshInstancedMeshes();
                break;
            // Otherwise (i.e. updateState === "meshesLoading"), the meshes are still loading so we must skip this 'update' frame.
        }
    }

    setHidden(hidden: boolean)
    {
        if (this.hidden === hidden)
            return;
        this.hidden = hidden;
        this.updateState = "refreshPending";
    }

    // Visits all instances across meshes, for whole-object actions (e.g. occlusion hiding).
    forEachInstance(visit: (instancedMeshId: string, instanceId: number) => void)
    {
        for (const instancedMeshId in this.instanceIdsByInstancedMeshId)
        {
            const instanceIds = this.instanceIdsByInstancedMeshId[instancedMeshId];
            for (let i = 0; i < instanceIds.length; ++i)
                visit(instancedMeshId, instanceIds[i]);
        }
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
        this.updateState = "refreshPending";
    }
    getParams(): InstancedMeshCompositionParams
    {
        return this.instancedMeshComposition.params;
    }
    // The first part drawn by a mesh whose id ends with the suffix (e.g. "+InstancedWood"; see
    // MeshDataUtil.getInstancedMeshId), for objects that place their own drawing by a part.
    getPartWithSuffix(instancedMeshIdSuffix: string): InstancedMeshCompositionPart | undefined
    {
        const parts = this.instancedMeshComposition.parts;
        for (let i = 0; i < parts.length; ++i)
        {
            if (parts[i].instancedMeshId.endsWith(instancedMeshIdSuffix))
                return parts[i];
        }
        return undefined;
    }
    rebuildParts()
    {
        this.decodeParts(this.encodeParts());
    }

    private allPartMeshesAreLoaded(): boolean
    {
        const parts = this.instancedMeshComposition.parts;
        for (let i = 0; i < parts.length; ++i)
        {
            if (!this.instancedMeshGraphics.instancedMeshIsLoaded(parts[i].instancedMeshId))
                return false;
        }
        return true;
    }

    // Whether visualObj hasn't moved (or bounced) since the last bake.
    private transformIsInSync(): boolean
    {
        this.gameObject.obj.updateMatrixWorld(); // Recurses to visualObj, so the compared matrix is current.
        return this.gameObject.visualObj.matrixWorld.equals(this.bakedWorldMatrix);
    }

    private async loadInstancedMeshes()
    {
        this.updateState = "meshesLoading";
        try
        {
            const parts = this.instancedMeshComposition.parts;
            for (let i = 0; i < parts.length; ++i)
            {
                const instancedMeshId = parts[i].instancedMeshId;
                // Meshes are shared across object types, so whichever loads one first fixes its size.
                const capacity = InstancedMeshCapacityMap[instancedMeshId];
                if (capacity == undefined)
                    throw new Error(`No generated capacity for "${instancedMeshId}" (see InstancedMeshCapacityBuilder)`);
                const ids = instancedMeshId.split("+");
                const geometryId = ids[0];
                const materialId = ids[1];
                await this.instancedMeshGraphics.loadInstancedMesh(
                    geometryId, MaterialParamsMap.getParamsById(materialId), capacity, true);
            }
        }
        catch (error)
        {
            console.error(`InstancedMeshComposer::loadInstancedMeshes :: Failed to load an instanced mesh:`, error);
        }
        finally
        {
            this.updateState = "refreshPending";
        }
    }

    private refreshInstancedMeshes()
    {
        for (const instancedMeshId in this.nextIndexByInstancedMeshIdTemp)
            this.nextIndexByInstancedMeshIdTemp[instancedMeshId] = 0;

        const parts = this.instancedMeshComposition.parts;
        for (let i = 0; i < parts.length; ++i)
        {
            const part = parts[i];
            const instancedMeshId = part.instancedMeshId;
            let nextIndex = this.nextIndexByInstancedMeshIdTemp[instancedMeshId];
            if (nextIndex == undefined)
            {
                nextIndex = 0;
                this.nextIndexByInstancedMeshIdTemp[instancedMeshId] = 1;
            }
            else
            {
                this.nextIndexByInstancedMeshIdTemp[instancedMeshId]++;
            }

            let instanceIds = this.instanceIdsByInstancedMeshId[instancedMeshId];
            if (instanceIds == undefined)
            {
                instanceIds = [];
                this.instanceIdsByInstancedMeshId[instancedMeshId] = instanceIds;
            }

            // An exhausted pool leaves this part undrawn until an instance frees up.
            let instanceId = instanceIds[nextIndex];
            if (instanceId == undefined)
            {
                // Parts take slots in order, so once one misses, later parts of this mesh miss too.
                if (nextIndex != instanceIds.length)
                    continue;
                const rentedInstanceId = this.instancedMeshGraphics.rentInstanceFromPool(instancedMeshId);
                if (rentedInstanceId == undefined)
                    continue;
                instanceId = rentedInstanceId;
                instanceIds.push(instanceId);
            }

            this.instancedMeshGraphics.updateInstanceTransform(
                instancedMeshId, instanceId,
                part.offset.x, this.hidden ? -9999 : part.offset.y, part.offset.z,
                part.dir.x, part.dir.y, part.dir.z, part.scale.x, part.scale.y, part.scale.z);
            if (usesInstanceColor(instancedMeshId))
            {
                this.instancedMeshGraphics.updateInstanceColor(
                    instancedMeshId, instanceId,
                    part.color!.x, part.color!.y, part.color!.z);
            }

            // In addition to the instance color: wood parts also carry moulding params.
            if (instancedMeshId.endsWith(INSTANCED_WOOD_SUFFIX))
            {
                this.instancedMeshGraphics.updateInstanceMouldingParams(
                    instancedMeshId, instanceId,
                    part.mouldingColor!.x, part.mouldingColor!.y, part.mouldingColor!.z,
                    part.mouldingThickness!, part.mouldingIsConvex!);
            }
        }

        // Return obsolete instances
        for (const instancedMeshId in this.nextIndexByInstancedMeshIdTemp)
        {
            const numInstancesInUse = this.nextIndexByInstancedMeshIdTemp[instancedMeshId];
            const instanceIds = this.instanceIdsByInstancedMeshId[instancedMeshId];
            for (let obsoleteIndex = numInstancesInUse; obsoleteIndex < instanceIds.length; ++obsoleteIndex)
            {
                this.instancedMeshGraphics.returnInstanceToPool(
                    instancedMeshId, instanceIds[obsoleteIndex]);
            }
            // Only shrinks; padding would hand bogus ids back to the pool later.
            if (instanceIds.length > numInstancesInUse)
                instanceIds.length = numInstancesInUse;
        }

        // updateMatrixWorld covers the zero-part case, where no bake refreshed it.
        this.gameObject.obj.updateMatrixWorld();
        this.bakedWorldMatrix.copy(this.gameObject.visualObj.matrixWorld);

        this.updateState = "upToDate";
    }
}
