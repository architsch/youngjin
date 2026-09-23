import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import { INSTANCE_COLORED_MATERIAL_IDS, INSTANCED_WOOD_MATERIAL_ID } from "../../../shared/system/sharedConstants";
import InstancedMeshComposition from "./helpers/mesh/instancedMeshComposition";
import { InstancedMeshCompositionParams } from "../../../shared/graphics/mesh/composition/types/compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../../../shared/graphics/mesh/composition/types/instancedMeshCompositionPart";
import GameObject from "../types/gameObject";
import GameObjectComponent from "./gameObjectComponent";
import InstancedMeshGraphics from "./instancedMeshGraphics";
import MaterialParamsMap from "../../../shared/graphics/material/maps/materialParamsMap";
import InstancedMeshIdMap from "../../../shared/graphics/mesh/maps/instancedMeshIdMap";
import InstancedMeshCapacityMap from "../../../shared/graphics/mesh/composition/maps/instancedMeshCapacityMap";
import Observable from "../../../shared/system/types/observable";

function getPartMeshId(part: InstancedMeshCompositionPart): string
{
    return InstancedMeshIdMap.getInstancedMeshId(part.geometryId, part.materialId);
}

export default class InstancedMeshComposer extends GameObjectComponent
{
    private instancedMeshGraphics: InstancedMeshGraphics;
    private instancedMeshComposition: InstancedMeshComposition;
    private instanceIdsByInstancedMeshId: {[instancedMeshId: string]: number[]} = {};
    private nextIndexByInstancedMeshIdTemp: {[instancedMeshId: string]: number} = {};

    // "awaitingSpawn": no composition loaded yet (updates can run before onSpawn); "refreshPending":
    // refresh due (loads meshes first); "meshesLoading": waiting on a load; "upToDate": instances match
    // the parts, re-baked only on movement.
    private updateState: "awaitingSpawn" | "refreshPending" | "meshesLoading" | "upToDate" = "awaitingSpawn";

    private hidden: boolean = false;

    // Notified after every decode, for owners that place their own drawing by the composition (e.g. a
    // canvas's picture inside its frame). Per object, so a listener hears only its own composer.
    readonly partsRebuiltObservable = new Observable<InstancedMeshComposer>(this);

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
        this.reloadComposition();
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

    private reloadComposition(): void
    {
        this.instancedMeshComposition.loadFromMetadata(this.gameObject);
        this.updateState = "refreshPending";
        this.partsRebuiltObservable.notify();
    }

    // A resize is a re-decode, not a re-bake: the codec lays the parts out against the size, so new parts
    // have to be built before any of them can be placed. Built from the live params, so an edit still
    // waiting to be saved survives it. Before spawn there is nothing to follow; onSpawn reads both.
    onTransformChanged(resized: boolean): void
    {
        if (this.updateState == "awaitingSpawn")
            return;
        if (resized)
            this.rebuildParts();
        else if (this.updateState == "upToDate") // A pending refresh or load bakes the latest matrix anyway.
            this.updateState = "refreshPending";
    }

    update(deltaTime: number)
    {
        // "meshesLoading", "awaitingSpawn" and "upToDate" have nothing to do this frame.
        if (this.updateState != "refreshPending") // Composition has been modified, or the object moved.
            return;
        if (this.allPartMeshesAreLoaded())
            this.refreshInstancedMeshes(); // Upon termination, this function call sets "updateState" to "upToDate".
        else
            this.loadInstancedMeshes(); // Upon start, this function call sets "updateState" to "meshesLoading".
    }

    setHidden(hidden: boolean)
    {
        if (this.hidden === hidden)
            return;
        this.hidden = hidden;
        if (this.updateState != "awaitingSpawn")
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
        this.instancedMeshComposition.decodeParts(encodedParams, this.gameObject);
        this.updateState = "refreshPending";
        this.partsRebuiltObservable.notify();
    }
    getParams(): InstancedMeshCompositionParams
    {
        return this.instancedMeshComposition.params;
    }
    // The first part drawn in the given material, for objects that place their own drawing by a part.
    getPartWithMaterial(materialId: string): InstancedMeshCompositionPart | undefined
    {
        const parts = this.instancedMeshComposition.parts;
        for (let i = 0; i < parts.length; ++i)
        {
            if (parts[i].materialId == materialId)
                return parts[i];
        }
        return undefined;
    }
    // Also for objects whose appearance is derived (e.g. a lamp's, from its light; see LampGameObject),
    // which recompose when that source changes.
    rebuildParts()
    {
        this.decodeParts(this.encodeParts());
    }

    private allPartMeshesAreLoaded(): boolean
    {
        const parts = this.instancedMeshComposition.parts;
        for (let i = 0; i < parts.length; ++i)
        {
            if (!this.instancedMeshGraphics.instancedMeshIsLoaded(getPartMeshId(parts[i])))
                return false;
        }
        return true;
    }

    private async loadInstancedMeshes()
    {
        this.updateState = "meshesLoading";
        // A composition reloaded while this is suspended starts a pass of its own, and the parts this
        // one was walking are gone. Abandoning it leaves the state machine to that newer pass; carrying
        // on would load meshes nothing needs and hand back a state it no longer owns, which starts yet
        // another pass. (Loads are shared, so abandoning one wastes nothing; see MeshFactory.)
        const revision = this.instancedMeshComposition.revision;
        const superseded = () => this.instancedMeshComposition.revision != revision;
        try
        {
            const parts = this.instancedMeshComposition.parts;
            for (let i = 0; i < parts.length; ++i)
            {
                const part = parts[i];
                const instancedMeshId = getPartMeshId(part);
                // Meshes are shared across object types, so whichever loads one first fixes its size.
                const capacity = InstancedMeshCapacityMap[instancedMeshId];
                if (capacity == undefined)
                    throw new Error(`No generated capacity for "${instancedMeshId}" (see InstancedMeshCapacityBuilder)`);
                await this.instancedMeshGraphics.loadInstancedMesh(
                    part.geometryId, MaterialParamsMap.getParamsById(part.materialId), capacity, true);
                if (superseded())
                    return;
            }
        }
        catch (error)
        {
            console.error(`InstancedMeshComposer::loadInstancedMeshes :: Failed to load an instanced mesh:`, error);
        }
        finally
        {
            if (!superseded())
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
            const instancedMeshId = getPartMeshId(part);
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
            if (INSTANCE_COLORED_MATERIAL_IDS.includes(part.materialId))
            {
                this.instancedMeshGraphics.updateInstanceColor(
                    instancedMeshId, instanceId,
                    part.color!.x, part.color!.y, part.color!.z);
            }

            // In addition to the instance color: wood parts also carry moulding params.
            if (part.materialId == INSTANCED_WOOD_MATERIAL_ID)
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

        this.updateState = "upToDate";
    }
}
