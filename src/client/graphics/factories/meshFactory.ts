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
    loadInstancedMesh: async (geometryId: string, materialParams: MaterialParams,
        maxNumInstances: number, createInstanceIdPool: boolean): Promise<THREE.InstancedMesh> =>
    {
        const meshId = `${geometryId}-${materialParams.getMaterialId()}`;
        const loadedMesh = loadedMeshes[meshId];
        if (loadedMesh != undefined)
        {
            return loadedMesh as THREE.InstancedMesh;
        }
        const geometryClone = (await GeometryFactory.load(geometryId)).clone();
        const material = await MaterialFactory.load(materialParams);

        const uvStartArray = new Float32Array(maxNumInstances * 2);
        const uvStartBufferAttrib = new THREE.InstancedBufferAttribute(uvStartArray, 2);
        geometryClone.setAttribute("uvStart", uvStartBufferAttrib);

        const uvSampleSizeArray = new Float32Array(maxNumInstances * 2);
        const uvSampleSizeBufferAttrib = new THREE.InstancedBufferAttribute(uvSampleSizeArray, 2);
        geometryClone.setAttribute("uvSampleSize", uvSampleSizeBufferAttrib);

        const newMesh = new THREE.InstancedMesh(geometryClone, material, maxNumInstances);
        newMesh.frustumCulled = false;
        GraphicsManager.addObjectToSceneIfNotAlreadyAdded(newMesh);
        loadedMeshes[meshId] = newMesh;

        if (createInstanceIdPool)
        {
            if (instanceIdPools[meshId] != undefined)
                throw new Error(`InstanceId pool already exists (meshId = ${meshId})`);
            instanceIdPools[meshId] = new Pool<number>(maxNumInstances,
                (index: number) => maxNumInstances - index - 1);
        }
        return newMesh as THREE.InstancedMesh;
    },
    rentInstanceId: (meshId: string): number =>
    {
        const pool = instanceIdPools[meshId];
        if (pool == undefined)
            throw new Error(`Instance ID pool not found (meshId = ${meshId})`);
        return pool.rentItem();
    },
    returnInstanceId: (meshId: string, instanceId: number): void =>
    {
        const pool = instanceIdPools[meshId];
        if (pool == undefined)
            throw new Error(`Instance ID pool not found (meshId = ${meshId})`);
        pool.returnItem(instanceId);
    },
    unloadAll: (): void =>
    {
        const idsTemp: string[] = [];
        for (const id of Object.keys(loadedMeshes))
            idsTemp.push(id);
        for (const id of idsTemp)
            MeshFactory.unload(id);
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
}

export default MeshFactory;