import * as THREE from "three";
import Voxel from "../../../../shared/voxel/types/voxel";
import Vec3 from "../../../../shared/math/types/vec3";
import { COLLISION_LAYER_HEIGHT, NUM_COLLISION_LAYERS, NUM_VOXEL_BLOCKS, NUM_VOXEL_COLS,
    NUM_VOXEL_ROWS } from "../../../../shared/system/sharedConstants";
import NumUtil from "../../../../shared/math/util/numUtil";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import { LIGHT_BLOCK_MAP_MAX_BRIGHTNESS } from "../../../system/clientConstants";
import LightBlockPropagationUtil, { getLightLuminance, LightPropagationScratch }
    from "../util/lightBlockPropagationUtil";
import LightBlockMapMaterialUtil from "../util/lightBlockMapMaterialUtil";
import LightBlockSmoothingUtil from "../util/lightBlockSmoothingUtil";
import LightBlockDilationUtil from "../util/lightBlockDilationUtil";
import LightSource from "../types/lightSource";

// All lights except the head light, stored as data and delivered to shaders as 3D textures over the
// voxel-block grid. Real THREE lights would recompile every shader when added and shine through walls
// (see @docs/graphics/lighting.md).
export default class LightBlockMap
{
    // Unbounded float accumulation (lamps can overlap); exposed into bytes in uploadTextures.
    private blockLightBuffer = new Float32Array(NUM_VOXEL_BLOCKS * 3);
    private blockFluxBuffer = new Float32Array(NUM_VOXEL_BLOCKS * 3);

    private scratch = new LightPropagationScratch();

    private smoothingScratch = new Float32Array(NUM_VOXEL_BLOCKS * 3);
    private openBlocks = new Uint8Array(NUM_VOXEL_BLOCKS);

    // Brightest light near each block (see LightBlockDilationUtil); read by getNearbyLightAt only.
    private nearbyLightBuffer = new Float32Array(NUM_VOXEL_BLOCKS * 3);

    // RGBA because three.js has no sized format for RGB byte 3D textures. Alpha holds openness (color)
    // and the directional share of the light (flux).
    private colorBuffer = new Uint8Array(NUM_VOXEL_BLOCKS * 4);
    private fluxBuffer = new Uint8Array(NUM_VOXEL_BLOCKS * 4);
    private colorTexture: THREE.Data3DTexture;
    private fluxTexture: THREE.Data3DTexture;

    private lightSourceByObjectId: { [objectId: string]: LightSource } = {};

    // Counted rather than derived, since it is read every frame (see hasLightSources).
    private numLightSources = 0;

    // Held here rather than read from App, which would create an import cycle.
    private voxels: Voxel[] | undefined;

    // Consumed once per frame, so many transform updates cost one recomputation.
    private needsRecomputation = true;

    constructor()
    {
        // Zero bytes would decode to a direction; start at "no direction" with no directional share.
        this.fluxBuffer.fill(FLUX_ZERO_BYTE);
        for (let blockIndex = 0; blockIndex < NUM_VOXEL_BLOCKS; ++blockIndex)
            this.fluxBuffer[blockIndex * 4 + 3] = 0;

        this.colorTexture = createBlockTexture(this.colorBuffer);
        this.fluxTexture = createBlockTexture(this.fluxBuffer);

        LightBlockMapMaterialUtil.setTextures(this.colorTexture, this.fluxTexture);
    }

    requestRecomputation()
    {
        this.needsRecomputation = true;
    }

    // This object outlives rooms, so the previous room's lamps must be dropped explicitly.
    resetForRoom(voxels: Voxel[] | undefined)
    {
        this.voxels = voxels;
        this.lightSourceByObjectId = {};
        this.numLightSources = 0;
        this.needsRecomputation = true;
    }

    // Whether the room has any lamp at all. The fog's lamp tint costs nothing when it has none (see
    // AtmosphereMaterialUtil).
    hasLightSources(): boolean
    {
        return this.numLightSources > 0;
    }

    addLightSource(objectId: string, lightSource: LightSource)
    {
        if (this.lightSourceByObjectId[objectId] == undefined)
            ++this.numLightSources;
        this.lightSourceByObjectId[objectId] = lightSource;
        this.needsRecomputation = true;
    }

    removeLightSource(objectId: string)
    {
        if (this.lightSourceByObjectId[objectId] == undefined)
            return;
        delete this.lightSourceByObjectId[objectId];
        --this.numLightSources;
        this.needsRecomputation = true;
    }

    setLightSourcePosition(objectId: string, worldPos: Vec3)
    {
        const lightSource = this.lightSourceByObjectId[objectId];
        if (lightSource == undefined)
            return;
        if (lightSource.worldPos.x == worldPos.x && lightSource.worldPos.y == worldPos.y &&
            lightSource.worldPos.z == worldPos.z)
            return;
        lightSource.worldPos = {x: worldPos.x, y: worldPos.y, z: worldPos.z};
        this.needsRecomputation = true;
    }

    // Lamp light near a point (linear space), used by the head light to yield to the room. Trilinearly
    // interpolated so the head light doesn't step as the player crosses blocks.
    getNearbyLightAt(worldPos: Vec3, outLight: THREE.Color): THREE.Color
    {
        // Block centres sit at half-integers.
        const col = worldPos.x - 0.5;
        const row = worldPos.z - 0.5;
        const layer = worldPos.y / COLLISION_LAYER_HEIGHT - 0.5;

        const col0 = Math.floor(col), row0 = Math.floor(row), layer0 = Math.floor(layer);
        const colFraction = col - col0, rowFraction = row - row0, layerFraction = layer - layer0;

        let sumR = 0, sumG = 0, sumB = 0, sumWeight = 0;
        for (let rowStep = 0; rowStep < 2; ++rowStep)
        {
            const rowWeight = rowStep === 0 ? 1 - rowFraction : rowFraction;
            for (let colStep = 0; colStep < 2; ++colStep)
            {
                const colWeight = colStep === 0 ? 1 - colFraction : colFraction;
                for (let layerStep = 0; layerStep < 2; ++layerStep)
                {
                    const layerWeight = layerStep === 0 ? 1 - layerFraction : layerFraction;
                    const blockIndex = this.clampedBlockIndex(
                        row0 + rowStep, col0 + colStep, layer0 + layerStep);
                    // Solid blocks are excluded (not counted as dark), so standing at a wall doesn't
                    // bring the head light back.
                    if (this.openBlocks[blockIndex] === 0)
                        continue;

                    const weight = rowWeight * colWeight * layerWeight;
                    const at = blockIndex * 3;
                    sumR += this.nearbyLightBuffer[at] * weight;
                    sumG += this.nearbyLightBuffer[at + 1] * weight;
                    sumB += this.nearbyLightBuffer[at + 2] * weight;
                    sumWeight += weight;
                }
            }
        }

        if (sumWeight <= 0)
            return outLight.setRGB(0, 0, 0, THREE.LinearSRGBColorSpace);
        const normalize = 1 / sumWeight;
        return outLight.setRGB(sumR * normalize, sumG * normalize, sumB * normalize,
            THREE.LinearSRGBColorSpace);
    }

    // Clamped because the camera may be outside the room.
    private clampedBlockIndex(row: number, col: number, collisionLayer: number): number
    {
        return VoxelQueryUtil.getVoxelBlockIndex(
            NumUtil.clampInRange(row, 0, NUM_VOXEL_ROWS - 1),
            NumUtil.clampInRange(col, 0, NUM_VOXEL_COLS - 1),
            NumUtil.clampInRange(collisionLayer, 0, NUM_COLLISION_LAYERS - 1));
    }

    update()
    {
        if (!this.needsRecomputation)
            return;
        this.needsRecomputation = false;

        this.blockLightBuffer.fill(0);
        this.blockFluxBuffer.fill(0);

        // Always refreshed, so getNearbyLightAt never answers from a room that was left.
        LightBlockSmoothingUtil.markOpenBlocks(this.voxels, this.openBlocks);

        if (this.voxels != undefined)
        {
            for (const objectId in this.lightSourceByObjectId)
            {
                LightBlockPropagationUtil.accumulate(this.voxels,
                    this.lightSourceByObjectId[objectId],
                    this.blockLightBuffer, this.blockFluxBuffer, this.scratch);
            }

            LightBlockSmoothingUtil.smooth(this.blockLightBuffer, this.smoothingScratch,
                this.openBlocks);
            LightBlockSmoothingUtil.smooth(this.blockFluxBuffer, this.smoothingScratch,
                this.openBlocks);
        }

        LightBlockDilationUtil.dilate(this.blockLightBuffer, this.nearbyLightBuffer,
            this.openBlocks);

        this.uploadTextures();
    }

    // Exposes the accumulated light through the byte range the textures hold.
    private uploadTextures()
    {
        for (let blockIndex = 0; blockIndex < NUM_VOXEL_BLOCKS; ++blockIndex)
        {
            const sourceIndex = blockIndex * 3;
            const targetIndex = blockIndex * 4;

            // Stores sqrt (squared back in the shader) to spend byte precision on dark falloff.
            // Clamped so overexposure saturates instead of wrapping modulo 256.
            for (let channel = 0; channel < 3; ++channel)
            {
                const exposed = Math.min(1,
                    this.blockLightBuffer[sourceIndex + channel] / LIGHT_BLOCK_MAP_MAX_BRIGHTNESS);
                this.colorBuffer[targetIndex + channel] = Math.sqrt(exposed) * 255;
            }

            // Openness, so the shader can renormalize filtered reads that include solid (lightless)
            // blocks; otherwise objects between block centres get darkened.
            this.colorBuffer[targetIndex + 3] = (this.openBlocks[blockIndex] !== 0) ? 255 : 0;

            // Direction only (magnitude lives in the color texture); zero vector for no light.
            const fluxX = this.blockFluxBuffer[sourceIndex];
            const fluxY = this.blockFluxBuffer[sourceIndex + 1];
            const fluxZ = this.blockFluxBuffer[sourceIndex + 2];
            const fluxLength = Math.sqrt(fluxX*fluxX + fluxY*fluxY + fluxZ*fluxZ);
            if (fluxLength > 0)
            {
                const toByte = 127.5 / fluxLength;
                this.fluxBuffer[targetIndex    ] = 127.5 + fluxX * toByte;
                this.fluxBuffer[targetIndex + 1] = 127.5 + fluxY * toByte;
                this.fluxBuffer[targetIndex + 2] = 127.5 + fluxZ * toByte;
            }
            else
            {
                this.fluxBuffer[targetIndex    ] = FLUX_ZERO_BYTE;
                this.fluxBuffer[targetIndex + 1] = FLUX_ZERO_BYTE;
                this.fluxBuffer[targetIndex + 2] = FLUX_ZERO_BYTE;
            }

            // Share of the light that has a net direction (opposing lamps cancel). Only this share is
            // subject to the facing test, so adding a lamp never darkens a surface. <= 1 because both
            // fields accumulate in step; 0 for solid blocks so it renormalizes like color.
            const luminance = getLightLuminance(this.blockLightBuffer[sourceIndex],
                this.blockLightBuffer[sourceIndex + 1], this.blockLightBuffer[sourceIndex + 2]);
            this.fluxBuffer[targetIndex + 3] = (luminance > 0)
                ? Math.min(1, fluxLength / luminance) * 255
                : 0;
        }
        this.colorTexture.needsUpdate = true;
        this.fluxTexture.needsUpdate = true;
    }
}

// What a direction of zero length encodes to, given that the encoding maps [-1,1] onto [0,255].
const FLUX_ZERO_BYTE = 128;

function createBlockTexture(buffer: Uint8Array): THREE.Data3DTexture
{
    // Axes follow the block index layout (layer, col, row), since the first dimension varies fastest;
    // shaders swizzle world positions accordingly (see LightBlockMapMaterialUtil).
    const texture = new THREE.Data3DTexture(buffer, NUM_COLLISION_LAYERS, NUM_VOXEL_COLS,
        NUM_VOXEL_ROWS);
    texture.format = THREE.RGBAFormat;
    texture.type = THREE.UnsignedByteType;
    // Data3DTexture defaults to NearestFilter.
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    // Samples pushed outside the boundary wall must read the edge, not wrap around.
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.wrapR = THREE.ClampToEdgeWrapping;
    // Linear-space data: leave color space unset to avoid a double conversion.
    texture.needsUpdate = true;
    return texture;
}
