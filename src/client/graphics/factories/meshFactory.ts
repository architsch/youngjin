import * as THREE from "three";
import GeometryFactory from "./geometryFactory";
import MaterialFactory from "./materialFactory";
import Pool from "../../../shared/system/types/pool";
import MaterialParams from "../../../shared/graphics/material/types/materialParams";
import InstancedTexturePackMaterialParams from "../../../shared/graphics/material/types/instancedTexturePackMaterialParams";
import GraphicsManager from "../graphicsManager";

const loadedMeshes: { [meshId: string]: THREE.Mesh } = {};
const loadedLineSegments: { [id: string]: THREE.LineSegments } = {};
const instanceIdPools: { [meshId: string]: Pool<number> } = {};
const ongoingInstancedMeshLoads: { [meshId: string]: Promise<THREE.InstancedMesh> } = {};
// So pool exhaustion is logged once per mesh, not every frame callers retry.
const exhaustedMeshIds: Set<string> = new Set();

const MeshFactory =
{
    getMeshes: () =>
    {
        return Object.values(loadedMeshes);
    },
    // For raycasts that must skip the room's voxel mesh (three.js tests every instance). Fills the
    // caller's array to avoid per-frame allocation.
    getMeshesExcept: (excludedMeshId: string, out: THREE.Mesh[]): THREE.Mesh[] =>
    {
        out.length = 0;
        for (const meshId in loadedMeshes)
        {
            if (meshId !== excludedMeshId)
                out.push(loadedMeshes[meshId]);
        }
        return out;
    },
    getMesh: (meshId: string): THREE.Mesh | undefined =>
    {
        return loadedMeshes[meshId];
    },
    loadMesh: async (meshId: string, geometryId: string, materialParams: MaterialParams): Promise<THREE.Mesh> =>
    {
        const loadedMesh = loadedMeshes[meshId];
        if (loadedMesh != undefined)
            return loadedMesh;

        const geometry = await GeometryFactory.load(geometryId);
        const material = await MaterialFactory.load(materialParams);

        const newMesh = new THREE.Mesh(geometry, material);
        newMesh.name = meshId;
        loadedMeshes[meshId] = newMesh;
        return newMesh;
    },
    loadLineSegments: async (geometryId: string, colorHex: string, depthTest: boolean = false): Promise<THREE.LineSegments> =>
    {
        const id = `${geometryId}-LineSegments-${colorHex}`;
        const loaded = loadedLineSegments[id];
        if (loaded != undefined)
            return loaded;

        const edgesGeometry = await GeometryFactory.load(geometryId, "edges");
        const material = new THREE.LineBasicMaterial({ color: colorHex, depthTest });
        const lineSegments = new THREE.LineSegments(edgesGeometry, material);
        loadedLineSegments[id] = lineSegments;
        return lineSegments;
    },
    loadInstancedMesh: async (meshId: string, geometryId: string, materialParams: MaterialParams,
        maxNumInstances: number, createInstanceIdPool: boolean): Promise<THREE.InstancedMesh> =>
    {
        const loadedMesh = loadedMeshes[meshId];
        if (loadedMesh != undefined)
        {
            return loadedMesh as THREE.InstancedMesh;
        }

        // Concurrent callers must share the first load; a second creation would replace the
        // registered mesh and pool while earlier callers keep writing into the orphaned one.
        let ongoingLoad = ongoingInstancedMeshLoads[meshId];
        if (ongoingLoad == undefined)
        {
            ongoingLoad = createInstancedMesh(meshId, geometryId, materialParams,
                maxNumInstances, createInstanceIdPool);
            ongoingInstancedMeshLoads[meshId] = ongoingLoad;
            try
            {
                return await ongoingLoad;
            }
            finally
            {
                delete ongoingInstancedMeshLoads[meshId]; // On failure, this permits a retry.
            }
        }
        return ongoingLoad;
    },
    // Undefined when the pool is exhausted; the caller leaves the part undrawn and retries later.
    rentInstanceId: (meshId: string): number | undefined =>
    {
        const pool = instanceIdPools[meshId];
        if (pool == undefined)
        {
            console.error(`Instance ID pool not found (meshId = ${meshId})`);
            return undefined;
        }
        const instanceId = pool.rentItem();
        if (instanceId == undefined)
        {
            if (!exhaustedMeshIds.has(meshId))
            {
                exhaustedMeshIds.add(meshId);
                console.warn(`MeshFactory.rentInstanceId :: Instance pool exhausted, so some parts will go undrawn (meshId = ${meshId})`);
            }
            return undefined;
        }
        const mesh = loadedMeshes[meshId] as THREE.InstancedMesh;
        if (instanceId + 1 > mesh.count)
            mesh.count = instanceId + 1;
        return instanceId;
    },
    returnInstanceId: (meshId: string, instanceId: number): void =>
    {
        const pool = instanceIdPools[meshId];
        if (pool == undefined)
            throw new Error(`Instance ID pool not found (meshId = ${meshId})`);
        pool.returnItem(instanceId);
        exhaustedMeshIds.delete(meshId);
        if (pool.allItemsAreFree())
            (loadedMeshes[meshId] as THREE.InstancedMesh).count = 0;
    },
    unloadAll: (): void =>
    {
        const meshIds: string[] = [];
        for (const id of Object.keys(loadedMeshes))
            meshIds.push(id);
        for (const id of meshIds)
            MeshFactory.unload(id);

        const lineSegmentIds: string[] = [];
        for (const id of Object.keys(loadedLineSegments))
            lineSegmentIds.push(id);
        for (const id of lineSegmentIds)
            MeshFactory.unloadLineSegments(id);
    },
    unload: (meshId: string): void =>
    {
        const mesh = loadedMeshes[meshId];
        if (mesh == undefined)
        {
            console.error(`Mesh is already unloaded (meshId = ${meshId})`);
            return;
        }
        const pool = instanceIdPools[meshId];
        if (pool)
        {
            if (!pool.allItemsAreFree())
                throw new Error(`There are instances which haven't been returned to the pool (meshId = ${meshId})`);
            delete instanceIdPools[meshId];
        }
        mesh.removeFromParent();
        delete loadedMeshes[meshId];
    },
    unloadLineSegments: (id: string): void =>
    {
        const lineSegments = loadedLineSegments[id];
        if (lineSegments == undefined)
        {
            console.error(`LineSegments is already unloaded (id = ${id})`);
            return;
        }
        (lineSegments.material as THREE.LineBasicMaterial).dispose();
        lineSegments.removeFromParent();
        delete loadedLineSegments[id];
    },
}

// Must run only once per meshId (loadInstancedMesh shares the promise among concurrent callers).
async function createInstancedMesh(meshId: string, geometryId: string, materialParams: MaterialParams,
    maxNumInstances: number, createInstanceIdPool: boolean): Promise<THREE.InstancedMesh>
{
    const geometryClone = (await GeometryFactory.load(geometryId)).clone();
    const material = await MaterialFactory.load(materialParams);

    const uvStartArray = new Float32Array(maxNumInstances * 2);
    const uvStartBufferAttrib = new THREE.InstancedBufferAttribute(uvStartArray, 2);
    geometryClone.setAttribute("uvStart", uvStartBufferAttrib);

    const uvSampleSizeArray = new Float32Array(maxNumInstances * 2);
    const uvSampleSizeBufferAttrib = new THREE.InstancedBufferAttribute(uvSampleSizeArray, 2);
    geometryClone.setAttribute("uvSampleSize", uvSampleSizeBufferAttrib);

    // Created up front because the compiled shader reads it; adding it later wouldn't take effect.
    const outlineColorHex = (materialParams as InstancedTexturePackMaterialParams).outlineColorHex;
    if (outlineColorHex)
    {
        const outlineStrengthArray = new Float32Array(maxNumInstances);
        const outlineStrengthBufferAttrib = new THREE.InstancedBufferAttribute(outlineStrengthArray, 1);
        outlineStrengthBufferAttrib.setUsage(THREE.DynamicDrawUsage);
        geometryClone.setAttribute("outlineStrength", outlineStrengthBufferAttrib);
    }

    const newMesh = new THREE.InstancedMesh(geometryClone, material, maxNumInstances);
    newMesh.name = meshId;
    newMesh.frustumCulled = false;
    // Partial uploads per changed instance (see InstancedMeshBinding).
    newMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    uvStartBufferAttrib.setUsage(THREE.DynamicDrawUsage);
    uvSampleSizeBufferAttrib.setUsage(THREE.DynamicDrawUsage);
    GraphicsManager.addObjectToSceneIfNotAlreadyAdded(newMesh);
    loadedMeshes[meshId] = newMesh;

    if (createInstanceIdPool)
    {
        if (instanceIdPools[meshId] != undefined)
            throw new Error(`InstanceId pool already exists (meshId = ${meshId})`);
        instanceIdPools[meshId] = new Pool<number>(maxNumInstances,
            (index: number) => maxNumInstances - index - 1);
        // The pool rents low ids first, so count only needs to track the high-water mark, keeping
        // uploads, draws and raycasts proportional to actual usage.
        newMesh.count = 0;
    }
    return newMesh;
}

export default MeshFactory;