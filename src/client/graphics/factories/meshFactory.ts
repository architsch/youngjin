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
// Meshes whose instance pool has been reported as exhausted, so that the shortage is logged once
// rather than on every frame the callers spend retrying.
const exhaustedMeshIds: Set<string> = new Set();

const MeshFactory =
{
    getMeshes: () =>
    {
        return Object.values(loadedMeshes);
    },
    // Fills "out" with every loaded mesh but one, for the callers that raycast the scene without
    // the room's voxel mesh: that mesh holds one instance per quad of a whole room, and three.js
    // tests a ray against every instance a mesh holds. The array is the caller's own, so a test
    // made every frame allocates nothing.
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
    // Undefined until the mesh has been loaded, which lets a caller holding an id alone (e.g. one of
    // an object's parts) reach the mesh that draws it.
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

        // The same mesh may be requested again while its first load is still awaiting the geometry
        // and material (e.g. two composed objects spawning in the same frame). All such callers must
        // share the first load: a second creation would replace the registered mesh and instanceId
        // pool, while earlier callers keep writing into the original — whose instances then never
        // get drawn (its count stays untouched by the pool's rentals).
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
    // Returns undefined when the mesh has no instance left to give out. A pool is sized for the
    // most a room is expected to need, so this means the room is holding more of something (e.g.
    // players) than that: the caller leaves whatever it was going to draw undrawn and retries
    // later, which degrades the scene rather than breaking it.
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
            // Reported once per mesh: the callers retry every frame, so logging each attempt
            // would bury everything else in the console.
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
        exhaustedMeshIds.delete(meshId); // The mesh has capacity again, so a later shortage is worth reporting afresh.
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

// Creates, registers, and adds to the scene a new instanced mesh (plus its instanceId pool, when
// requested). Must only run once per meshId — loadInstancedMesh above guards this by sharing the
// returned promise among concurrent callers.
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

    // A material that paints an outline around its instances reads a per-instance strength to know
    // which of them wear one (see MaterialConstructorMap's addInstanceOutline). Made here, alongside
    // the mesh, rather than the first time an instance asks for one: it is what the compiled shader
    // reads, and a mesh that gained it partway through its life would have been drawn without it up
    // to that point.
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
    // Instances are re-baked continuously (a voxel edit, a player moving, the orbit camera taking a
    // block out of the way), and each such change now uploads only its own slice of the buffer
    // rather than the whole of it — see InstancedMeshBinding's markInstanceForUpload.
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
        // The pool rents low instanceIds first (see the seeding order above), so the mesh's
        // active instance range only needs to span the high-water mark of rented instanceIds
        // (maintained in rentInstanceId/returnInstanceId) instead of the full capacity.
        // This keeps per-frame instance-buffer uploads, draws, and raycasts proportional to
        // actual usage. Meshes without a pool keep the default (full-capacity) count.
        newMesh.count = 0;
    }
    return newMesh;
}

export default MeshFactory;