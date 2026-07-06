import * as THREE from "three";
import MaterialParams from "../../../../shared/graphics/material/types/materialParams";
import MeshFactory from "../../factories/meshFactory";
import TextureFactory from "../../factories/textureFactory";
import GameObject from "../../../object/types/gameObject";
import InstancedTexturePackMaterialParams from "../../../../shared/graphics/material/types/instancedTexturePackMaterialParams";
import TextureUtil from "../../util/textureUtil";
import MeshDataUtil from "../../../../shared/graphics/mesh/util/meshDataUtil";

const tempObj = new THREE.Object3D();
const vec3Temp = new THREE.Vector3();
const colorTemp = new THREE.Color();

// instanceKey = `${instancedMeshId}/${instanceId}`
const objMap: {[instanceKey: string]: GameObject } = {};

export default class InstancedMeshBinding
{
    materialParams: MaterialParams;
    geometryId: string;
    maxNumInstances: number;
    createInstanceIdPool: boolean;
    instancedMesh: THREE.InstancedMesh | undefined;

    constructor(materialParams: MaterialParams, geometryId: string, maxNumInstances: number,
        createInstanceIdPool: boolean)
    {
        this.materialParams = materialParams;
        this.geometryId = geometryId;
        this.maxNumInstances = maxNumInstances;
        this.createInstanceIdPool = createInstanceIdPool;
    }

    static findGameObject(instancedMeshObj: THREE.Object3D, instanceId: number): GameObject | undefined
    {
        const instanceKey = `${instancedMeshObj.name}/${instanceId}`;
        const obj = objMap[instanceKey];
        if (obj == undefined)
        {
            console.error(`instanceKey doesn't exist in objMap (instanceKey = ${instanceKey})`);
            return undefined;
        }
        return obj;
    }

    async loadInstancedMesh(): Promise<void>
    {
        if (this.instancedMesh) // instancedMesh is already loaded
            return;
        if (!this.materialParams)
            throw new Error("MaterialParams hasn't been set yet.");

        const instancedMesh = await MeshFactory.loadInstancedMesh(
            this.getInstancedMeshId(),
            this.geometryId,
            this.materialParams,
            this.maxNumInstances,
            this.createInstanceIdPool
        );
        this.instancedMesh = instancedMesh;
    }

    // Swaps the shared TexturePack material's texture in place, disposing the now-obsolete one. The
    // material (and its compiled shader, baked UV scales, GPU buffers) is preserved and keeps being
    // reused — only the underlying image changes. Relies on the material being cached under a stable
    // customMaterialId so its identity is independent of the texture path (see VoxelGameObject).
    // A no-op when the requested texture is already current.
    async swapTexturePackTexture(newTexturePath: string): Promise<void>
    {
        if (!this.instancedMesh)
        {
            console.error("InstancedMesh hasn't been loaded yet.");
            return;
        }
        const params = this.materialParams as InstancedTexturePackMaterialParams;
        const oldTexturePath = params.texturePath;
        if (oldTexturePath === newTexturePath)
            return;

        const newTexture = await TextureFactory.loadStaticImageTexture(newTexturePath);
        const material = this.instancedMesh.material as THREE.MeshPhongMaterial;
        material.map = newTexture;
        newTexture.needsUpdate = true; // Swapping material.map needs no shader recompile (one map → one map).
        params.texturePath = newTexturePath;

        // Nothing else references the old texture pack image (the voxel material is its sole user),
        // so dispose it now that the material points at the new one.
        if (oldTexturePath)
            TextureFactory.unload(oldTexturePath);
    }

    reserveInstance(gameObject: GameObject, instanceId: number)
    {
        const instanceKey = this.getInstanceKey(instanceId);
        if (objMap[instanceKey])
            console.error(`instanceKey is already registered (instanceKey = ${instanceKey})`);
        objMap[instanceKey] = gameObject;
    }
    unreserveInstance(gameObject: GameObject, instanceId: number)
    {
        const instanceKey = this.getInstanceKey(instanceId);
        if (!objMap[instanceKey])
            console.error(`instanceKey is not registered (instanceKey = ${instanceKey})`);
        delete objMap[instanceKey];

        this.updateInstanceTransform(gameObject, instanceId, 0, -9999, 0, 0, -1, 0);
    }

    rentInstanceFromPool(gameObject: GameObject): number
    {
        if (!this.instancedMesh)
            throw new Error("InstancedMesh hasn't been loaded yet.");
        if (!this.createInstanceIdPool)
            throw new Error("You cannot rent an instance without an instanceId pool.");

        const instanceId = MeshFactory.rentInstanceId(this.getInstancedMeshId());
        this.reserveInstance(gameObject, instanceId);
        return instanceId;
    }
    returnInstanceToPool(gameObject: GameObject, instanceId: number)
    {
        if (!this.instancedMesh)
            throw new Error("InstancedMesh hasn't been loaded yet.");
        if (!this.createInstanceIdPool)
            throw new Error("You cannot return an instance without an instanceId pool.");

        MeshFactory.returnInstanceId(this.getInstancedMeshId(), instanceId);
        this.unreserveInstance(gameObject, instanceId);
    }

    updateInstanceTransform(gameObject: GameObject, instanceId: number,
        offsetX: number, offsetY: number, offsetZ: number,
        dirX: number, dirY: number, dirZ: number,
        xScale: number = 1, yScale: number = 1, zScale: number = 1)
    {
        if (!this.instancedMesh)
        {
            console.error(`InstancedMesh hasn't been loaded yet (objectId = ${gameObject.params.objectId})`);
            return;
        }
        gameObject.obj.updateMatrixWorld(); // Recurses to visualObj, so its (possibly bounced) world matrix is current too.
        // Bake under the visual node rather than obj, so any cosmetic transform applied there (e.g.
        // EasingMotion's bounce, pivoting about the GameObject's center) composes into the instance.
        // At rest the visual node is identity, so this is identical to baking directly under obj.
        gameObject.visualObj.add(tempObj);

        tempObj.scale.set(xScale, yScale, zScale);

        tempObj.position.set(0, 0, 0);
        vec3Temp.set(
            gameObject.position.x + dirX,
            gameObject.position.y + dirY,
            gameObject.position.z + dirZ
        );
        tempObj.lookAt(vec3Temp);
        tempObj.getWorldDirection(vec3Temp);

        tempObj.position.set(offsetX, offsetY, offsetZ);
        tempObj.updateMatrixWorld();

        this.instancedMesh.setMatrixAt(instanceId, tempObj.matrixWorld);
        this.instancedMesh.instanceMatrix.needsUpdate = true;
        // Invalidate the cached bounding sphere so that InstancedMesh.raycast
        // recomputes it to include the updated instance position.
        this.instancedMesh.boundingSphere = null;

        tempObj.removeFromParent();
    }

    // Sample offsets and scales are normalized numbers in range [0,1], corresponding to the full range of pixels covered by the texture's sampling window.
    updateInstanceTextureUV(gameObject: GameObject, instanceId: number, textureIndex: number,
        sampleOffsetX: number = 0, sampleOffsetY: number = 0,
        sampleScaleX: number = 1, sampleScaleY: number = 1)
    {
        if (!this.instancedMesh)
        {
            console.error(`InstancedMesh hasn't been loaded yet (objectId = ${gameObject.params.objectId})`);
            return;
        }
        const instancedTexturePackMaterialParams = this.materialParams as InstancedTexturePackMaterialParams;
        const w = instancedTexturePackMaterialParams.textureWidth;
        const h = instancedTexturePackMaterialParams.textureHeight;
        const cw = instancedTexturePackMaterialParams.textureGridCellWidth;
        const ch = instancedTexturePackMaterialParams.textureGridCellHeight;

        const textureGridCellWidthScale = cw / w;
        const textureGridCellHeightScale = ch / h;

        const uvStartBufferAttrib = this.instancedMesh.geometry.getAttribute("uvStart");
        // (0.5 / cw) = pixel-bleeding prevention shift
        const uStart = textureGridCellWidthScale
            * ((0.5 / cw) + textureIndex % (1 / textureGridCellWidthScale) + sampleOffsetX);
        // (0.5 / ch) = pixel-bleeding prevention shift
        const vStart = textureGridCellHeightScale
            * ((0.5 / ch) + Math.floor(textureIndex * textureGridCellWidthScale) + sampleOffsetY);
        uvStartBufferAttrib.setXY(instanceId, uStart, vStart);
        uvStartBufferAttrib.needsUpdate = true;

        const uvSampleSizeBufferAttrib = this.instancedMesh.geometry.getAttribute("uvSampleSize");
        uvSampleSizeBufferAttrib.setXY(instanceId, sampleScaleX, sampleScaleY);
        uvSampleSizeBufferAttrib.needsUpdate = true;
    }

    updateInstanceColor(gameObject: GameObject, instanceId: number,
        r: number, g: number, b: number)
    {
        if (!this.instancedMesh)
        {
            console.error(`InstancedMesh hasn't been loaded yet (objectId = ${gameObject.params.objectId})`);
            return;
        }
        // Colors arrive as sRGB values in range [0,255] (see ColorUtil); convert them into the
        // renderer's working color space, the same treatment three.js gives material colors.
        colorTemp.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
        this.instancedMesh.setColorAt(instanceId, colorTemp);
        this.instancedMesh.instanceColor!.needsUpdate = true;
    }

    updateInstanceEyeColors(gameObject: GameObject, instanceId: number,
        r_pupil: number, g_pupil: number, b_pupil: number,
        r_iris: number, g_iris: number, b_iris: number)
    {
        if (!this.instancedMesh)
        {
            console.error(`InstancedMesh hasn't been loaded yet (objectId = ${gameObject.params.objectId})`);
            return;
        }
        // Colors arrive as sRGB values in range [0,255] (see ColorUtil); convert them into the
        // renderer's working color space, the same treatment three.js gives material colors.
        const pupilColorAttrib = this.getOrCreateInstancedAttribute("pupilColor", 3);
        colorTemp.setRGB(r_pupil / 255, g_pupil / 255, b_pupil / 255, THREE.SRGBColorSpace);
        pupilColorAttrib.setXYZ(instanceId, colorTemp.r, colorTemp.g, colorTemp.b);
        pupilColorAttrib.needsUpdate = true;

        const irisColorAttrib = this.getOrCreateInstancedAttribute("irisColor", 3);
        colorTemp.setRGB(r_iris / 255, g_iris / 255, b_iris / 255, THREE.SRGBColorSpace);
        irisColorAttrib.setXYZ(instanceId, colorTemp.r, colorTemp.g, colorTemp.b);
        irisColorAttrib.needsUpdate = true;
    }

    // Radii are fractions of the square's side length (0.5 = the circle touches the square's
    // edges). They are squared here so the "InstancedEye" fragment shader can compare them
    // directly against the squared UV-space distance from the square's center.
    updateInstanceEyeRadii(gameObject: GameObject, instanceId: number,
        pupilRadius: number, irisRadius: number)
    {
        if (!this.instancedMesh)
        {
            console.error(`InstancedMesh hasn't been loaded yet (objectId = ${gameObject.params.objectId})`);
            return;
        }
        const eyeRadiiSqrAttrib = this.getOrCreateInstancedAttribute("eyeRadiiSqr", 2);
        eyeRadiiSqrAttrib.setXY(instanceId, pupilRadius * pupilRadius, irisRadius * irisRadius);
        eyeRadiiSqrAttrib.needsUpdate = true;
    }

    // Per-instance attributes consumed by specialized instanced materials (e.g. "InstancedEye")
    // are created lazily, so that instanced meshes which never use them don't pay for the buffers.
    private getOrCreateInstancedAttribute(name: string, itemSize: number): THREE.InstancedBufferAttribute
    {
        const geometry = this.instancedMesh!.geometry;
        let attrib = geometry.getAttribute(name) as THREE.InstancedBufferAttribute;
        if (!attrib)
        {
            attrib = new THREE.InstancedBufferAttribute(
                new Float32Array(this.maxNumInstances * itemSize), itemSize);
            geometry.setAttribute(name, attrib);
        }
        return attrib;
    }

    async drawImageAtIndex(textureIndex: number, imageURL: string)
    {
        const instancedTexturePackMaterialParams = this.materialParams as InstancedTexturePackMaterialParams;
        const w = instancedTexturePackMaterialParams.textureWidth;
        const h = instancedTexturePackMaterialParams.textureHeight;
        const cw = instancedTexturePackMaterialParams.textureGridCellWidth;
        const ch = instancedTexturePackMaterialParams.textureGridCellHeight;

        const textureGridCellWidthScale = cw / w;
        const textureGridCellHeightScale = ch / h;
        
        const textureRow = Math.floor(textureIndex * textureGridCellWidthScale);
        const textureCol = textureIndex % (1 / textureGridCellWidthScale);
        const u1 = textureGridCellWidthScale * textureCol;
        const u2 = u1 + textureGridCellWidthScale;
        const v1 = textureGridCellHeightScale * textureRow;
        const v2 = v1 + textureGridCellHeightScale;

        const material = this.instancedMesh!.material as THREE.MeshPhongMaterial;
        const rt = material.map!.renderTarget as THREE.WebGLRenderTarget;
        await TextureUtil.drawImageOnRenderTarget(imageURL, rt, u1, v1, u2, v2);
    }

    private getInstancedMeshId(): string
    {
        if (this.instancedMesh) // If instancedMesh is already loaded, just grab the meshId from its name.
            return this.instancedMesh.name;

        if (!this.materialParams)
            throw new Error("MaterialParams hasn't been set yet.");
        return MeshDataUtil.getInstancedMeshId(this.geometryId, this.materialParams.getMaterialId());
    }

    getInstanceKey(instanceId: number): string
    {
        if (!this.instancedMesh)
            throw new Error("InstancedMesh hasn't been loaded yet.");
        return `${this.getInstancedMeshId()}/${instanceId}`;
    }
}