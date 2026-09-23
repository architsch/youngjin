import * as THREE from "three";
import MaterialParams from "../../../../shared/graphics/material/types/materialParams";
import MeshFactory from "../../factories/meshFactory";
import TextureFactory from "../../factories/textureFactory";
import GameObject from "../../../object/types/gameObject";
import InstancedTexturePackMaterialParams from "../../../../shared/graphics/material/types/instancedTexturePackMaterialParams";
import TextureUtil from "../../util/textureUtil";
import MeshDataUtil from "../../../../shared/graphics/mesh/util/meshDataUtil";
import InstancedPartUtil from "../../util/instancedPartUtil";

const matrixTemp = new THREE.Matrix4();
const sphereTemp = new THREE.Sphere();

// Hidden instances are parked far below the room (instances share the mesh's visibility flag).
const HIDDEN_INSTANCE_Y = -9999;
const hiddenInstanceMatrix = new THREE.Matrix4().makeTranslation(0, HIDDEN_INSTANCE_Y, 0);

// Owners per mesh, indexed by instanceId: ids are dense, so an array avoids building a string key per
// lookup (the voxel mesh has an instance per quad).
const ownersByInstancedMeshId: {[instancedMeshId: string]: (GameObject | undefined)[] } = {};

// Beyond this many marked instances, the whole buffer is uploaded (see markInstanceForUpload).
const maxTrackedUpdateRanges = 256;

export default class InstancedMeshBinding
{
    materialParams: MaterialParams;
    geometryId: string;
    maxNumInstances: number;
    createInstanceIdPool: boolean;
    instancedMesh: THREE.InstancedMesh | undefined;

    // Owner transforms held while an instance is hidden (see setInstanceHidden). Undefined when
    // nothing is hidden, so the per-frame path costs one check.
    private ownerMatrixByHiddenInstanceId: Map<number, THREE.Matrix4> | undefined;

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
        // Meshes are registered by name (see MeshFactory).
        const owner = ownersByInstancedMeshId[instancedMeshObj.name]?.[instanceId];
        if (owner == undefined)
        {
            console.error(`No GameObject owns this instance (instancedMeshId = ${instancedMeshObj.name}, instanceId = ${instanceId})`);
            return undefined;
        }
        return owner;
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

    // Swaps the texture pack image in place, keeping the material, compiled shader and buffers.
    // Relies on a stable customMaterialId (see VoxelGameObject). No-op if already current.
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

        // The voxel material was the old image's only user.
        if (oldTexturePath)
            TextureFactory.unload(oldTexturePath);
    }

    reserveInstance(gameObject: GameObject, instanceId: number)
    {
        const owners = this.getOwners();
        if (owners[instanceId] != undefined)
            console.error(`Instance is already reserved (instancedMeshId = ${this.getInstancedMeshId()}, instanceId = ${instanceId})`);
        owners[instanceId] = gameObject;
    }
    unreserveInstance(gameObject: GameObject, instanceId: number)
    {
        // Unhide on return: the next owner controls the transform.
        this.setInstanceHidden(instanceId, false);

        const owners = this.getOwners();
        if (owners[instanceId] == undefined)
            console.error(`Instance is not reserved (instancedMeshId = ${this.getInstancedMeshId()}, instanceId = ${instanceId})`);
        owners[instanceId] = undefined;

        this.updateInstanceTransform(gameObject, instanceId, 0, HIDDEN_INSTANCE_Y, 0, 0, -1, 0);
    }

    // Allocated at full capacity on first use, so it stays a dense array.
    private getOwners(): (GameObject | undefined)[]
    {
        const instancedMeshId = this.getInstancedMeshId();
        let owners = ownersByInstancedMeshId[instancedMeshId];
        if (owners == undefined)
        {
            owners = new Array(this.maxNumInstances).fill(undefined);
            ownersByInstancedMeshId[instancedMeshId] = owners;
        }
        return owners;
    }

    // Hides one instance (or reveals it) without the owner noticing: while hidden it is parked, the
    // owner's latest transform is buffered, and reveal applies it. Used by e.g. the orbit occlusion
    // hider, since mesh visibility would hide every instance.
    setInstanceHidden(instanceId: number, hidden: boolean)
    {
        if (!this.instancedMesh)
        {
            console.error(`InstancedMesh hasn't been loaded yet (instanceId = ${instanceId})`);
            return;
        }
        if (hidden)
        {
            if (this.ownerMatrixByHiddenInstanceId == undefined)
                this.ownerMatrixByHiddenInstanceId = new Map<number, THREE.Matrix4>();
            else if (this.ownerMatrixByHiddenInstanceId.has(instanceId))
                return; // Already hidden.

            const ownerMatrix = new THREE.Matrix4();
            this.instancedMesh.getMatrixAt(instanceId, ownerMatrix);
            this.ownerMatrixByHiddenInstanceId.set(instanceId, ownerMatrix);
            // Hiding only shrinks the mesh's extent, so the cached bounding sphere stays valid.
            this.writeInstanceMatrix(instanceId, hiddenInstanceMatrix);
        }
        else
        {
            const ownerMatrix = this.ownerMatrixByHiddenInstanceId?.get(instanceId);
            if (ownerMatrix == undefined)
                return; // Not hidden.

            this.ownerMatrixByHiddenInstanceId!.delete(instanceId);
            this.writeInstanceMatrix(instanceId, ownerMatrix);
            // The owner may have moved it while hidden.
            this.expandBoundingSphereToInstance(ownerMatrix);
        }
    }

    // Lets line-of-sight tests ignore blocks the orbit camera has hidden.
    instanceIsHidden(instanceId: number): boolean
    {
        return this.ownerMatrixByHiddenInstanceId?.has(instanceId) === true;
    }

    // Grows the cached bounding sphere to include one instance (as computeBoundingSphere would), so
    // raycasts work without a full recompute.
    private expandBoundingSphereToInstance(instanceMatrix: THREE.Matrix4)
    {
        const boundingSphere = this.instancedMesh!.boundingSphere;
        const geometrySphere = this.instancedMesh!.geometry.boundingSphere;
        if (boundingSphere == null || geometrySphere == null)
            return; // Nothing cached to keep valid: the next raycast computes it over every instance.
        sphereTemp.copy(geometrySphere).applyMatrix4(instanceMatrix);
        boundingSphere.union(sphereTemp);
    }

    // Undefined when the mesh has no free instance (see MeshFactory.rentInstanceId).
    rentInstanceFromPool(gameObject: GameObject): number | undefined
    {
        if (!this.instancedMesh)
            throw new Error("InstancedMesh hasn't been loaded yet.");
        if (!this.createInstanceIdPool)
            throw new Error("You cannot rent an instance without an instanceId pool.");

        const instanceId = MeshFactory.rentInstanceId(this.getInstancedMeshId());
        if (instanceId == undefined)
            return undefined;
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
        // Baked under visualObj so cosmetic transforms (e.g. EasingMotion's bounce) apply to the instance.
        InstancedPartUtil.bakePartMatrix(gameObject.visualObj,
            offsetX, offsetY, offsetZ, dirX, dirY, dirZ, xScale, yScale, zScale, matrixTemp);

        // Buffered while hidden (see setInstanceHidden).
        const ownerMatrix = this.ownerMatrixByHiddenInstanceId?.get(instanceId);
        if (ownerMatrix != undefined)
        {
            ownerMatrix.copy(matrixTemp);
        }
        else
        {
            this.writeInstanceMatrix(instanceId, matrixTemp);
            // Force InstancedMesh.raycast to recompute bounds with the new position.
            this.instancedMesh.boundingSphere = null;
        }
    }

    private writeInstanceMatrix(instanceId: number, matrix: THREE.Matrix4)
    {
        this.instancedMesh!.setMatrixAt(instanceId, matrix);
        markInstanceForUpload(this.instancedMesh!.instanceMatrix, instanceId);
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

        const uvStartBufferAttrib = this.instancedMesh.geometry.getAttribute("uvStart") as THREE.InstancedBufferAttribute;
        // (0.5 / cw) = pixel-bleeding prevention shift
        const uStart = textureGridCellWidthScale
            * ((0.5 / cw) + textureIndex % (1 / textureGridCellWidthScale) + sampleOffsetX);
        // (0.5 / ch) = pixel-bleeding prevention shift
        const vStart = textureGridCellHeightScale
            * ((0.5 / ch) + Math.floor(textureIndex * textureGridCellWidthScale) + sampleOffsetY);
        uvStartBufferAttrib.setXY(instanceId, uStart, vStart);
        markInstanceForUpload(uvStartBufferAttrib, instanceId);

        const uvSampleSizeBufferAttrib = this.instancedMesh.geometry.getAttribute("uvSampleSize") as THREE.InstancedBufferAttribute;
        uvSampleSizeBufferAttrib.setXY(instanceId, sampleScaleX, sampleScaleY);
        markInstanceForUpload(uvSampleSizeBufferAttrib, instanceId);
    }

    // As updateInstanceTextureUV, for any rect of texels rather than one whole cell (e.g. a region of
    // cells, or part of one; see TextureAtlasAllocator). In texels from the texture's bottom-left.
    updateInstanceTextureRect(gameObject: GameObject, instanceId: number,
        texelX: number, texelY: number, texelWidth: number, texelHeight: number)
    {
        if (!this.instancedMesh)
        {
            console.error(`InstancedMesh hasn't been loaded yet (objectId = ${gameObject.params.objectId})`);
            return;
        }
        const params = this.materialParams as InstancedTexturePackMaterialParams;

        // Half a texel in on every edge, as for a cell.
        const uvStartBufferAttrib = this.instancedMesh.geometry.getAttribute("uvStart") as THREE.InstancedBufferAttribute;
        uvStartBufferAttrib.setXY(instanceId,
            (texelX + 0.5) / params.textureWidth, (texelY + 0.5) / params.textureHeight);
        markInstanceForUpload(uvStartBufferAttrib, instanceId);

        // The shader spans one cell less a texel per unit of sample size (see getUVScales).
        const uvSampleSizeBufferAttrib = this.instancedMesh.geometry.getAttribute("uvSampleSize") as THREE.InstancedBufferAttribute;
        uvSampleSizeBufferAttrib.setXY(instanceId,
            (texelWidth - 1) / (params.textureGridCellWidth - 1),
            (texelHeight - 1) / (params.textureGridCellHeight - 1));
        markInstanceForUpload(uvSampleSizeBufferAttrib, instanceId);
    }

    updateInstanceColor(gameObject: GameObject, instanceId: number,
        r: number, g: number, b: number)
    {
        if (!this.instancedMesh)
        {
            console.error(`InstancedMesh hasn't been loaded yet (objectId = ${gameObject.params.objectId})`);
            return;
        }
        InstancedPartUtil.setInstanceColor(this.instancedMesh, instanceId, r, g, b);
        markInstanceForUpload(this.instancedMesh.instanceColor!, instanceId);
    }

    // "InstancedWood" moulding: color, band width (world units), and proud/sunk.
    updateInstanceMouldingParams(gameObject: GameObject, instanceId: number,
        r: number, g: number, b: number,
        thickness: number, convex: boolean)
    {
        if (!this.instancedMesh)
        {
            console.error(`InstancedMesh hasn't been loaded yet (objectId = ${gameObject.params.objectId})`);
            return;
        }
        const mouldingColorAttrib = this.getOrCreateInstancedAttribute("mouldingColor", 3);
        const mouldingParamsAttrib = this.getOrCreateInstancedAttribute("mouldingParams", 2);
        InstancedPartUtil.setInstanceMoulding(mouldingColorAttrib, mouldingParamsAttrib, instanceId,
            r, g, b, thickness, convex);
        markInstanceForUpload(mouldingColorAttrib, instanceId);
        markInstanceForUpload(mouldingParamsAttrib, instanceId);
    }

    // Outline strength (0..1); ignored by materials without an outline color. Unchanged values are
    // skipped, since this is swept over whole meshes and marking every instance would re-upload the
    // entire buffer.
    updateInstanceOutline(instanceId: number, strength: number)
    {
        if (!this.instancedMesh)
            return;
        const outlineStrengthAttrib = this.getOrCreateInstancedAttribute("outlineStrength", 1);
        if (outlineStrengthAttrib.getX(instanceId) === strength)
            return;
        outlineStrengthAttrib.setX(instanceId, strength);
        markInstanceForUpload(outlineStrengthAttrib, instanceId);
    }

    // Created lazily so meshes that don't use these attributes don't pay for them.
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

    // Draws a caller-drawn canvas (e.g. text) texel for texel, its bottom-left corner at the given texel (see
    // updateInstanceTextureRect).
    drawCanvasAtTexel(texelX: number, texelY: number, canvas: HTMLCanvasElement)
    {
        const params = this.materialParams as InstancedTexturePackMaterialParams;
        const u1 = texelX / params.textureWidth;
        const v1 = texelY / params.textureHeight;
        TextureUtil.drawCanvasOnRenderTarget(canvas, this.getDynamicRenderTarget(), u1, v1,
            u1 + canvas.width / params.textureWidth, v1 + canvas.height / params.textureHeight);
    }

    // cellAspect is the cell's aspect ratio as shown, when the instance stretches it (see
    // TextureUtil.drawImageOnRenderTarget). The optional source UV rect selects a sub-region (e.g. one
    // atlas cell).
    async drawImageAtIndex(textureIndex: number, imageURL: string, cellAspect?: number,
        widthScale: number = 1, heightScale: number = 1,
        sourceU1: number = 0, sourceV1: number = 0,
        sourceU2: number = 1, sourceV2: number = 1,
        unloadTextureAfterDraw: boolean = true)
    {
        const {u1, v1, u2, v2} = this.getTextureCellUVRect(textureIndex, widthScale, heightScale);
        const regionAspect = cellAspect == undefined ? undefined : cellAspect * widthScale / heightScale;
        await TextureUtil.drawImageOnRenderTarget(imageURL, this.getDynamicRenderTarget(),
            u1, v1, u2, v2, regionAspect, sourceU1, sourceV1, sourceU2, sourceV2, unloadTextureAfterDraw);
    }

    // UV rect of an instance's texture cell, optionally a centered sub-region scaled by the given factors.
    private getTextureCellUVRect(textureIndex: number, widthScale: number = 1, heightScale: number = 1):
        {u1: number, v1: number, u2: number, v2: number}
    {
        const instancedTexturePackMaterialParams = this.materialParams as InstancedTexturePackMaterialParams;
        const textureGridCellWidthScale = instancedTexturePackMaterialParams.textureGridCellWidth
            / instancedTexturePackMaterialParams.textureWidth;
        const textureGridCellHeightScale = instancedTexturePackMaterialParams.textureGridCellHeight
            / instancedTexturePackMaterialParams.textureHeight;

        const textureRow = Math.floor(textureIndex * textureGridCellWidthScale);
        const textureCol = textureIndex % (1 / textureGridCellWidthScale);
        const u1 = textureGridCellWidthScale * textureCol;
        const v1 = textureGridCellHeightScale * textureRow;
        const u2 = u1 + textureGridCellWidthScale;
        const v2 = v1 + textureGridCellHeightScale;

        const widthMargin = textureGridCellWidthScale * (1 - widthScale) * 0.5;
        const heightMargin = textureGridCellHeightScale * (1 - heightScale) * 0.5;
        return {u1: u1 + widthMargin, v1: v1 + heightMargin, u2: u2 - widthMargin, v2: v2 - heightMargin};
    }

    // Only exists for materials whose texture was created empty (see TextureFactory.loadDynamicEmptyTexture).
    private getDynamicRenderTarget(): THREE.WebGLRenderTarget
    {
        const material = this.instancedMesh!.material as THREE.MeshPhongMaterial;
        return material.map!.renderTarget as THREE.WebGLRenderTarget;
    }

    private getInstancedMeshId(): string
    {
        if (this.instancedMesh) // If instancedMesh is already loaded, just grab the meshId from its name.
            return this.instancedMesh.name;

        if (!this.materialParams)
            throw new Error("MaterialParams hasn't been set yet.");
        return MeshDataUtil.getInstancedMeshId(this.geometryId, this.materialParams.getMaterialId());
    }
}

// Marks one instance's slice of an attribute for upload, so a small change doesn't re-send the whole
// buffer. All writers must use this (three.js uploads only listed ranges). Past a threshold the list
// is replaced by one full range, which stops further growth; it is replaced rather than cleared so
// earlier writes aren't dropped.
function markInstanceForUpload(attrib: THREE.BufferAttribute, instanceId: number)
{
    const updateRanges = attrib.updateRanges;
    const wholeBuffer = attrib.array.length;
    const alreadySendingWholeBuffer = (updateRanges.length === 1 && updateRanges[0].count === wholeBuffer);

    if (!alreadySendingWholeBuffer)
    {
        if (updateRanges.length >= maxTrackedUpdateRanges)
        {
            attrib.clearUpdateRanges();
            attrib.addUpdateRange(0, wholeBuffer);
        }
        else
        {
            attrib.addUpdateRange(instanceId * attrib.itemSize, attrib.itemSize);
        }
    }
    attrib.needsUpdate = true;
}
