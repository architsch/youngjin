import * as THREE from "three";
import GeometryFactory from "./geometryFactory";
import MaterialFactory from "./materialFactory";
import Pool from "../../../shared/system/types/pool";
import MaterialParams from "../types/material/materialParams";
import GraphicsManager from "../graphicsManager";

const loadedMeshes: { [meshId: string]: THREE.Mesh } = {};
const instanceIdPools: { [meshId: string]: Pool<number> } = {};

const MeshFactory =
{
    getMeshes: () =>
    {
        return Object.values(loadedMeshes);
    },
    loadMesh: async (geometryId: string, materialParams: MaterialParams): Promise<THREE.Mesh> =>
    {
        const meshId = `${geometryId}-${materialParams.getMaterialId()}`;
        const loadedMesh = loadedMeshes[meshId];
        if (loadedMesh != undefined)
            return loadedMesh;

        const geometry = await GeometryFactory.load(geometryId);
        const material = await MaterialFactory.load(materialParams);

        const newMesh = new THREE.Mesh(geometry, material);
        loadedMeshes[meshId] = newMesh;
        return newMesh;
    },
    loadMeshInstance: async (geometryId: string, materialParams: MaterialParams, maxNumInstances: number)
        : Promise<{ instancedMesh: THREE.InstancedMesh, instanceId: number }> =>
    {
        const meshId = `${geometryId}-${materialParams.getMaterialId()}`;
        const loadedMesh = loadedMeshes[meshId];
        if (loadedMesh != undefined)
        {
            const pool = instanceIdPools[meshId];
            if (pool == undefined)
                throw new Error(`Instance ID pool not found (meshId = ${meshId})`);
            return { instancedMesh: loadedMesh as THREE.InstancedMesh, instanceId: pool.rentItem() };
        }
        const geometryClone = (await GeometryFactory.load(geometryId)).clone();
        const material = await MaterialFactory.load(materialParams);

        const uvStartArray = new Float32Array(maxNumInstances * 2);
        const uvStartBufferAttrib = new THREE.InstancedBufferAttribute(uvStartArray, 2);
        geometryClone.setAttribute("uvStart", uvStartBufferAttrib);

        const newMesh = new THREE.InstancedMesh(geometryClone, material, maxNumInstances);
        newMesh.frustumCulled = false;
        GraphicsManager.addObjectToSceneIfNotAlreadyAdded(newMesh);
        loadedMeshes[meshId] = newMesh;

        if (instanceIdPools[meshId] != undefined)
            throw new Error(`Instance ID pool already exists (meshId = ${meshId})`);

        const pool = new Pool<number>(maxNumInstances,
            (index: number) => maxNumInstances - index - 1);
        instanceIdPools[meshId] = pool;
        return { instancedMesh: newMesh as THREE.InstancedMesh, instanceId: pool.rentItem() };
    },
    unloadAll: (): void =>
    {
        const idsTemp: string[] = [];
        for (const url of Object.keys(loadedMeshes))
            idsTemp.push(url);
        for (const url of idsTemp)
            MeshFactory.unload(url);
    },
    unload: (meshId: string, instanceIds: number[] = []): void =>
    {
        const mesh = loadedMeshes[meshId];
        if (mesh == undefined)
        {
            console.error(`Mesh is already unloaded (meshId = ${meshId})`);
            return;
        }

        if (instanceIds.length > 0) // This is an instanced mesh
        {
            const pool = instanceIdPools[meshId];
            if (pool == undefined)
                throw new Error(`Instance ID pool not found (meshId = ${meshId})`);
            for (const instanceId of instanceIds)
                pool.returnItem(instanceId);
            
            if (pool.allItemsAreFree())
            {
                const instancedMesh = loadedMeshes[meshId] as THREE.InstancedMesh;
                instancedMesh.removeFromParent();
                instancedMesh.dispose();
                delete loadedMeshes[meshId];
                delete instanceIdPools[meshId];
            }
        }
        else // This is NOT an instanced mesh
        {
            const mesh = loadedMeshes[meshId];
            mesh.removeFromParent();
            delete loadedMeshes[meshId];
        }
    },
}

export default MeshFactory;