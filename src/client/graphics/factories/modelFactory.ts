import * as THREE from "three";
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const gltfLoader = new GLTFLoader();
const loadedModels: { [url: string]: THREE.Group } = {};

const ModelFactory =
{
    load: async (url: string): Promise<THREE.Group> =>
    {
        const loadedMoel = loadedModels[url];
        if (loadedMoel != undefined)
            return loadedMoel;

        const gltf: GLTF = await gltfLoader.loadAsync(url);

        loadedModels[url] = gltf.scene;
        return gltf.scene;
    },
    unloadAll: (): void =>
    {
        const urlsTemp: string[] = [];
        for (const url of Object.keys(loadedModels))
            urlsTemp.push(url);
        for (const url of urlsTemp)
            ModelFactory.unload(url);
    },
    unload: (url: string): void =>
    {
        const gltfScene = loadedModels[url];
        if (gltfScene == undefined)
        {
            console.error(`Model is already unloaded (url = ${url})`);
            return;
        }

        gltfScene.traverse(function (node) {
            if (node instanceof THREE.Mesh)
            {
                if (node.geometry)
                {
                    node.geometry.dispose();
                }
                if (node.material)
                {
                    for (const key in node.material)
                    {
                        if (node.material[key] instanceof THREE.Texture)
                        {
                            node.material[key].dispose();
                        }
                    }
                    node.material.dispose();
                }
            }
        });

        delete loadedModels[url];
    },
}

export default ModelFactory;