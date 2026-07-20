import * as THREE from "three";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import { INSTANCE_COLORED_MATERIAL_IDS, INSTANCED_EYE_MATERIAL_ID } from "../../../shared/system/sharedConstants";
import InstancedMeshComposition from "./helpers/mesh/instancedMeshComposition";
import { InstancedMeshCompositionParams } from "../../../shared/graphics/mesh/composition/types/compositionParams/instancedMeshCompositionParams";
import GameObject from "../types/gameObject";
import GameObjectComponent from "./gameObjectComponent";
import InstancedMeshGraphics from "./instancedMeshGraphics";
import MaterialParamsMap from "../../../shared/graphics/material/maps/materialParamsMap";
import MeshDataUtil from "../../../shared/graphics/mesh/util/meshDataUtil";

// Precomputed "+materialId" suffixes, so the refresh loop can branch on a part's material without
// splitting its instancedMeshId (see MeshDataUtil.getInstancedMeshId for the id's format).
const INSTANCE_COLORED_SUFFIXES = INSTANCE_COLORED_MATERIAL_IDS.map(
    (materialId) => MeshDataUtil.getInstancedMeshId("", materialId));
const INSTANCED_EYE_SUFFIX = MeshDataUtil.getInstancedMeshId("", INSTANCED_EYE_MATERIAL_ID);

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

    // The composer's update pipeline, expressed as a single state variable:
    //   "refreshPending" - a full refresh is due (composition/visibility changed, or just spawned).
    //                      update() first ensures every part's instanced mesh is loaded, then
    //                      refreshes and settles into "upToDate".
    //   "meshesLoading"  - an asynchronous instanced-mesh load is in flight; update() waits.
    //   "upToDate"       - instances mirror the current parts; only movement triggers re-baking.
    private updateState: "refreshPending" | "meshesLoading" | "upToDate" = "refreshPending";

    // The instance matrices bake the GameObject's world transform (see InstancedMeshBinding), so a
    // refresh is due not only when the composition changes but whenever the object moves. This holds
    // the visual node's world matrix as of the last refresh, so stationary frames can be skipped.
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

    // True while the visual node's world matrix still matches the one the instances were last baked
    // under — i.e. the GameObject hasn't moved (nor bounced via a cosmetic transform) since the
    // last refresh, so the baked instance matrices are still valid.
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
                const ids = parts[i].instancedMeshId.split("+");
                const geometryId = ids[0];
                const materialId = ids[1];
                await this.instancedMeshGraphics.loadInstancedMesh(
                    geometryId, MaterialParamsMap.getParamsById(materialId),
                    this.componentConfig.maxNumInstancesPerMesh, true);
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

            // Rent a new instance if this part doesn't have one yet.
            let instanceId = instanceIds[nextIndex];
            if (instanceId == undefined)
            {
                instanceId = this.instancedMeshGraphics.rentInstanceFromPool(instancedMeshId);
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
            else if (instancedMeshId.endsWith(INSTANCED_EYE_SUFFIX))
            {
                this.instancedMeshGraphics.updateInstanceEyeColors(
                    instancedMeshId, instanceId,
                    part.pupilColor!.x, part.pupilColor!.y, part.pupilColor!.z,
                    part.irisColor!.x, part.irisColor!.y, part.irisColor!.z);

                // The eye square is scaled to the larger of the two radii (see PlayerCompositionCodec),
                // so that circle spans the full square; express both radii as fractions of the
                // square's side length (0.5 = touches the square's edges).
                const maxEyeRadius = Math.max(part.pupilRadius!, part.irisRadius!);
                const radiusToSideFraction = (maxEyeRadius > 0) ? (0.5 / maxEyeRadius) : 0;
                this.instancedMeshGraphics.updateInstanceEyeRadii(
                    instancedMeshId, instanceId,
                    part.pupilRadius! * radiusToSideFraction,
                    part.irisRadius! * radiusToSideFraction);
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
            instanceIds.length = numInstancesInUse;
        }

        // Capture the world transform the instances were just baked under (see transformIsInSync).
        // The extra updateMatrixWorld covers the zero-part case, where no bake refreshed it above.
        this.gameObject.obj.updateMatrixWorld();
        this.bakedWorldMatrix.copy(this.gameObject.visualObj.matrixWorld);

        this.updateState = "upToDate";
    }
}
