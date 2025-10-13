import * as THREE from "three";
import GeometryFactory from "./geometryFactory";
import MaterialFactory from "./materialFactory";
import Pool from "../../util/pool";

const loadedMeshes: { [meshId: string]: THREE.Mesh } = {};
const instanceIdPools: { [meshId: string]: Pool<number> } = {};

const MeshFactory =
{
    getMeshes: () =>
    {
        return Object.values(loadedMeshes);
    },
    loadMesh: async (geometryId: string, materialId: string): Promise<THREE.Mesh> =>
    {
        const meshId = `${geometryId}-${materialId}`;
        const loadedMesh = loadedMeshes[meshId];
        if (loadedMesh != undefined)
            return loadedMesh;

        const geometry = await GeometryFactory.load(geometryId);
        const material = await MaterialFactory.load(materialId);

        const newMesh = new THREE.Mesh(geometry, material);
        loadedMeshes[meshId] = newMesh;
        return newMesh;
    },
    loadInstancedMesh: async (geometryId: string, materialId: string, numInstances: number)
        : Promise<{ instancedMesh: THREE.InstancedMesh, instanceId: number }> =>
    {
        const meshId = `${geometryId}-${materialId}`;
        const loadedMesh = loadedMeshes[meshId];
        if (loadedMesh != undefined)
        {
            const pool = instanceIdPools[meshId];
            if (pool == undefined)
                throw new Error(`Instance ID pool not found (meshId = ${meshId})`);

            const instanceId = pool.rentItem();
            //console.log(`Existing mesh (meshId = ${meshId}, instanceId = ${instanceId})`);
            return { instancedMesh: loadedMesh as THREE.InstancedMesh, instanceId };
        }
        const geometry = await GeometryFactory.load(geometryId);
        const material = await MaterialFactory.load(materialId);

        const uvStartArray = new Float32Array(numInstances * 2);
        geometry.setAttribute("uvStart", new THREE.InstancedBufferAttribute(uvStartArray, 2));

        const newMesh = new THREE.InstancedMesh(geometry, material, numInstances);
        loadedMeshes[meshId] = newMesh;

        if (instanceIdPools[meshId] != undefined)
            throw new Error(`Instance ID pool already exists (meshId = ${meshId})`);

        const pool = new Pool<number>(numInstances, (index: number) => numInstances - index - 1);
        instanceIdPools[meshId] = pool;

        const instanceId = pool.rentItem();
        //console.log(`New mesh (meshId = ${meshId}, instanceId = ${instanceId})`);
        return { instancedMesh: newMesh, instanceId };
    },
    unloadAll: (): void =>
    {
        //console.log("MeshFactory :: unloadAll");
        const idsTemp: string[] = [];
        for (const url of Object.keys(loadedMeshes))
            idsTemp.push(url);
        for (const url of idsTemp)
            MeshFactory.unload(url);
    },
    unload: (meshId: string, instanceId: number = -1): void =>
    {
        //console.log(`Unloading mesh... (meshId = ${meshId}, instanceId = ${instanceId})`);
        const mesh = loadedMeshes[meshId];
        if (mesh == undefined)
        {
            console.error(`Mesh is already unloaded (meshId = ${meshId})`);
            return;
        }

        if (instanceId >= 0)
        {
            const pool = instanceIdPools[meshId];
            if (pool == undefined)
                throw new Error(`Instance ID pool not found (meshId = ${meshId})`);
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
        else
        {
            const mesh = loadedMeshes[meshId];
            mesh.removeFromParent();
            delete loadedMeshes[meshId];
        }
    },
}

export default MeshFactory;