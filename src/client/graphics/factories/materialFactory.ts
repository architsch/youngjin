import * as THREE from "three";
import TextureFactory from "./textureFactory";
import MaterialParams from "../types/materialParams";

const loadedMaterials: { [materialId: string]: THREE.Material } = {};

const MaterialFactory =
{
    load: async (materialParams: MaterialParams): Promise<THREE.Material> =>
    {
        const materialId = `${materialParams.type}-${materialParams.additionalParam}`;
        const loadedMaterial = loadedMaterials[materialId];
        if (loadedMaterial != undefined)
            return loadedMaterial;

        let newMaterial: THREE.Material;
        switch (materialParams.type)
        {
            case "Regular": newMaterial = await createRegularMaterial(materialParams.additionalParam); break;
            case "Wireframe": newMaterial = await createWireframeMaterial(materialParams.additionalParam); break;
            default: throw new Error(`Unknown material type (materialParams.type = ${materialParams.type})`);
        }
        loadedMaterials[materialId] = newMaterial;
        return newMaterial;
    },
    unloadAll: (): void =>
    {
        const idsTemp: string[] = [];
        for (const id of Object.keys(loadedMaterials))
            idsTemp.push(id);
        for (const id of idsTemp)
            MaterialFactory.unload(id);
    },
    unload: (materialId: string): void =>
    {
        const material = loadedMaterials[materialId];
        if (material == undefined)
        {
            console.error(`Material is already unloaded (materialId = ${materialId})`);
            return;
        }
        material.dispose();
        delete loadedMaterials[materialId];
    },
}

async function createRegularMaterial(textureURL: string): Promise<THREE.Material>
{
    const texture = await TextureFactory.load(textureURL);
    const newMaterial = new THREE.MeshPhongMaterial();
    newMaterial.map = texture;

    const pixelBleedingPreventionScale = 127 / 128;
    const textureGridCellScale = 0.125;
    const uvScale = textureGridCellScale * pixelBleedingPreventionScale;

    newMaterial.onBeforeCompile = (shader) => {
        shader.vertexShader = `
            attribute vec2 uvStart;
            ${shader.vertexShader}
        `;
        shader.vertexShader = shader.vertexShader.replace(
            "#include <uv_vertex>",
            `
            #include <uv_vertex>
            vMapUv = uvStart + ${uvScale.toFixed(7)} * vMapUv;
            `
        );
    };
    return newMaterial;
}

async function createWireframeMaterial(colorHex: string): Promise<THREE.Material>
{
    const newMaterial = new THREE.MeshBasicMaterial({ color: colorHex, wireframe: true });
    return newMaterial;
}

export default MaterialFactory;