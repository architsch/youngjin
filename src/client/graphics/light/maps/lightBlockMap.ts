import * as THREE from "three";
import Voxel from "../../../../shared/voxel/types/voxel";
import Vec3 from "../../../../shared/math/types/vec3";
import { COLLISION_LAYER_HEIGHT, NUM_COLLISION_LAYERS, NUM_VOXEL_BLOCKS, NUM_VOXEL_COLS,
    NUM_VOXEL_ROWS, VOXEL_CELL_SIZE } from "../../../../shared/system/sharedConstants";
import NumUtil from "../../../../shared/math/util/numUtil";
import Vector3DUtil from "../../../../shared/math/util/vector3DUtil";
import { LIGHT_BLOCK_MAP_MAX_BRIGHTNESS, LIGHT_REGION_SIZE_XZ } from "../../../system/clientConstants";
import LightBlockPropagationUtil, { getLightLuminance, LightPropagationScratch }
    from "../util/lightBlockPropagationUtil";
import LightBlockMapMaterialUtil from "../util/lightBlockMapMaterialUtil";
import LightBlockSmoothingUtil from "../util/lightBlockSmoothingUtil";
import LightBlockDilationUtil from "../util/lightBlockDilationUtil";
import LightRegionUtil from "../util/lightRegionUtil";
import LightSource from "../types/lightSource";

// All lights except the head light, stored as data and delivered to shaders as 3D textures over the
// room's blocks. Real THREE lights would recompile every shader when added and shine through walls (see
// @docs/graphics/lighting.md).
export default class LightBlockMap
{
    // Unbounded float accumulation (lamps can overlap); exposed into bytes in uploadTextures.
    private blockLightBuffer = new Float32Array(NUM_VOXEL_BLOCKS * 3);
    private blockFluxBuffer = new Float32Array(NUM_VOXEL_BLOCKS * 3);
    private openBlocks = new Uint8Array(NUM_VOXEL_BLOCKS);

    private scratch = new LightPropagationScratch();

    // The same light a region at a time (see LightRegionUtil), and the brightest light near each region
    // (see LightBlockDilationUtil); read by getNearbyLightAt only, which needs it no finer.
    private regionLightBuffer = new Float32Array(LightRegionUtil.numRegions * 3);
    private openRegions = new Uint8Array(LightRegionUtil.numRegions);
    private nearbyLightBuffer = new Float32Array(LightRegionUtil.numRegions * 3);

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

    // Whether the last recomputation had any lamp to work from. With none before and none now, the map is
    // dark already, whatever was done to the blocks (see update).
    private wasLit = false;

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

    // Both of a light's points (see LightSource).
    setLightSourcePosition(objectId: string, worldPos: Vec3, outletPos: Vec3)
    {
        const lightSource = this.lightSourceByObjectId[objectId];
        if (lightSource == undefined)
            return;
        if (Vector3DUtil.equal(lightSource.worldPos, worldPos) &&
            Vector3DUtil.equal(lightSource.outletPos, outletPos))
            return;
        lightSource.worldPos = {x: worldPos.x, y: worldPos.y, z: worldPos.z};
        lightSource.outletPos = {x: outletPos.x, y: outletPos.y, z: outletPos.z};
        this.needsRecomputation = true;
    }

    // Lamp light near a point (linear space), used by the head light to yield to the room. Trilinearly
    // interpolated so the head light doesn't step as the player crosses regions.
    getNearbyLightAt(worldPos: Vec3, outLight: THREE.Color): THREE.Color
    {
        if (readOpenCells(this.nearbyLightBuffer, this.openRegions, LightRegionUtil.numCols, LightRegionUtil.numRows,
            worldPos.x / LIGHT_REGION_SIZE_XZ, worldPos.y / COLLISION_LAYER_HEIGHT,
            worldPos.z / LIGHT_REGION_SIZE_XZ, outLight))
        {
            return outLight;
        }
        // No open region around, as in the air between two thin walls: the light standing at the point
        // itself then, which the blocks know.
        readOpenCells(this.blockLightBuffer, this.openBlocks, NUM_VOXEL_COLS, NUM_VOXEL_ROWS,
            worldPos.x / VOXEL_CELL_SIZE, worldPos.y / COLLISION_LAYER_HEIGHT,
            worldPos.z / VOXEL_CELL_SIZE, outLight);
        return outLight;
    }

    update()
    {
        if (!this.needsRecomputation)
            return;
        this.needsRecomputation = false;

        // Nothing reads openness where there is no light, so a lampless room's block edits cost nothing.
        const isLit = this.numLightSources > 0;
        if (!isLit && !this.wasLit)
            return;
        this.wasLit = isLit;

        this.blockLightBuffer.fill(0);
        this.blockFluxBuffer.fill(0);

        // Always refreshed, so getNearbyLightAt never answers from a room that was left.
        LightBlockPropagationUtil.markOpen(this.voxels, this.openBlocks);

        if (this.voxels != undefined)
        {
            for (const objectId in this.lightSourceByObjectId)
            {
                LightBlockPropagationUtil.accumulate(this.openBlocks,
                    this.lightSourceByObjectId[objectId],
                    this.blockLightBuffer, this.blockFluxBuffer, this.scratch);
            }

            LightBlockSmoothingUtil.smooth(this.blockLightBuffer, this.blockFluxBuffer,
                this.openBlocks);
        }

        LightRegionUtil.averageOverRegions(this.blockLightBuffer, this.openBlocks,
            this.regionLightBuffer, this.openRegions);
        LightBlockDilationUtil.dilate(this.regionLightBuffer, this.nearbyLightBuffer,
            this.openRegions);

        this.uploadTextures();
    }

    // Exposes the accumulated light through the byte range the textures hold.
    private uploadTextures()
    {
        for (let blockIndex = 0; blockIndex < NUM_VOXEL_BLOCKS; ++blockIndex)
        {
            const sourceIndex = blockIndex * 3;
            const targetIndex = blockIndex * 4;

            // Openness, so the shader can renormalize filtered reads that include solid (lightless)
            // blocks; otherwise objects between block centres get darkened.
            this.colorBuffer[targetIndex + 3] = (this.openBlocks[blockIndex] !== 0) ? 255 : 0;

            const lightR = this.blockLightBuffer[sourceIndex];
            const lightG = this.blockLightBuffer[sourceIndex + 1];
            const lightB = this.blockLightBuffer[sourceIndex + 2];
            // Most of a room is usually dark, and dark needs no arithmetic.
            if (lightR === 0 && lightG === 0 && lightB === 0)
            {
                this.colorBuffer[targetIndex    ] = 0;
                this.colorBuffer[targetIndex + 1] = 0;
                this.colorBuffer[targetIndex + 2] = 0;
                this.fluxBuffer[targetIndex    ] = FLUX_ZERO_BYTE;
                this.fluxBuffer[targetIndex + 1] = FLUX_ZERO_BYTE;
                this.fluxBuffer[targetIndex + 2] = FLUX_ZERO_BYTE;
                this.fluxBuffer[targetIndex + 3] = 0;
                continue;
            }

            // Stores sqrt (squared back in the shader) to spend byte precision on dark falloff.
            // Clamped so overexposure saturates instead of wrapping modulo 256.
            this.colorBuffer[targetIndex    ] = toExposedByte(lightR);
            this.colorBuffer[targetIndex + 1] = toExposedByte(lightG);
            this.colorBuffer[targetIndex + 2] = toExposedByte(lightB);

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
            this.fluxBuffer[targetIndex + 3] =
                Math.min(1, fluxLength / getLightLuminance(lightR, lightG, lightB)) * 255;
        }
        this.colorTexture.needsUpdate = true;
        this.fluxTexture.needsUpdate = true;
    }
}

// What a direction of zero length encodes to, given that the encoding maps [-1,1] onto [0,255].
const FLUX_ZERO_BYTE = 128;

function toExposedByte(light: number): number
{
    return Math.sqrt(Math.min(1, light / LIGHT_BLOCK_MAP_MAX_BRIGHTNESS)) * 255;
}

// Reads a field of 3 entries per cell at a point given in cells (centres sit at half-integers), from the
// open cells around it: closed ones are excluded (not counted as dark), so standing at a wall doesn't
// bring the head light back. Clamped because the camera may be outside the room. False, and black, where
// no cell around is open. The grid is the regions' or the blocks': both are indexed layer fastest, then
// column, then row.
function readOpenCells(field: Float32Array, isOpen: Uint8Array, numCols: number, numRows: number,
    x: number, y: number, z: number, outLight: THREE.Color): boolean
{
    const col = x - 0.5, row = z - 0.5, layer = y - 0.5;
    const col0 = Math.floor(col), row0 = Math.floor(row), layer0 = Math.floor(layer);
    const colFraction = col - col0, rowFraction = row - row0, layerFraction = layer - layer0;

    let sumR = 0, sumG = 0, sumB = 0, sumWeight = 0;
    for (let rowStep = 0; rowStep < 2; ++rowStep)
    {
        const rowWeight = rowStep === 0 ? 1 - rowFraction : rowFraction;
        const clampedRow = NumUtil.clampInRange(row0 + rowStep, 0, numRows - 1);
        for (let colStep = 0; colStep < 2; ++colStep)
        {
            const colWeight = colStep === 0 ? 1 - colFraction : colFraction;
            const clampedCol = NumUtil.clampInRange(col0 + colStep, 0, numCols - 1);
            for (let layerStep = 0; layerStep < 2; ++layerStep)
            {
                const layerWeight = layerStep === 0 ? 1 - layerFraction : layerFraction;
                const cellIndex = (clampedRow * numCols + clampedCol) * NUM_COLLISION_LAYERS +
                    NumUtil.clampInRange(layer0 + layerStep, 0, NUM_COLLISION_LAYERS - 1);
                if (isOpen[cellIndex] === 0)
                    continue;

                const weight = rowWeight * colWeight * layerWeight;
                const at = cellIndex * 3;
                sumR += field[at] * weight;
                sumG += field[at + 1] * weight;
                sumB += field[at + 2] * weight;
                sumWeight += weight;
            }
        }
    }

    const normalize = (sumWeight > 0) ? 1 / sumWeight : 0;
    outLight.setRGB(sumR * normalize, sumG * normalize, sumB * normalize, THREE.LinearSRGBColorSpace);
    return sumWeight > 0;
}

function createBlockTexture(buffer: Uint8Array): THREE.Data3DTexture
{
    // Axes follow the block index layout (layer, column, row), since the first dimension varies fastest;
    // shaders swizzle world positions accordingly (see lightBlockMapGLSL).
    const texture = new THREE.Data3DTexture(buffer, NUM_COLLISION_LAYERS, NUM_VOXEL_COLS, NUM_VOXEL_ROWS);
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
