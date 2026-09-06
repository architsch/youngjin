import * as THREE from "three";
import Voxel from "../../../shared/voxel/types/voxel";
import Vec3 from "../../../shared/math/types/vec3";
import { COLLISION_LAYER_HEIGHT, NUM_COLLISION_LAYERS, NUM_VOXEL_BLOCKS, NUM_VOXEL_COLS,
    NUM_VOXEL_ROWS } from "../../../shared/system/sharedConstants";
import NumUtil from "../../../shared/math/util/numUtil";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import { LIGHT_BLOCK_MAP_MAX_BRIGHTNESS } from "../../system/clientConstants";
import LightBlockPropagationUtil, { LightPropagationScratch } from "./lightBlockPropagationUtil";
import LightBlockMapMaterialUtil from "./lightBlockMapMaterialUtil";
import LightBlockSmoothingUtil from "./lightBlockSmoothingUtil";
import LightSource from "./lightSource";

// Every light in the room except the one the camera carries, held as data rather than as
// THREE.PointLight objects and delivered to the shaders as a pair of 3D textures covering the room's
// own voxel-block grid.
//
// Why not real lights: three.js compiles the number of point lights into every shader as a #define,
// so installing one would recompile every material in the scene mid-frame — and a real point light
// shines straight through walls, which in a room people build enclosures in looks more broken than
// the dark it was meant to fix. Sampling a grid costs one texture fetch per fragment whether the room
// holds three lamps or three hundred, and walls occlude light for free because the fill that builds
// the grid stops at solid blocks.
//
// What is given up is specular: a lamp produces no glint, only diffuse light. That suits the
// materials here, which are written around the single head-mounted lamp being the only thing that
// glints.
export default class LightBlockMap
{
    // Where light is accumulated, three entries per block. Kept apart from the textures' own storage
    // because what accumulates has no upper bound — several lamps can meet in one place — while the
    // textures hold bytes. The exposure step in uploadTextures is where the two meet.
    private blockLightBuffer = new Float32Array(NUM_VOXEL_BLOCKS * 3);
    private blockFluxBuffer = new Float32Array(NUM_VOXEL_BLOCKS * 3);

    private scratch = new LightPropagationScratch();

    // What the smoothing pass sweeps through, and which blocks it is allowed to sweep across.
    private smoothingScratch = new Float32Array(NUM_VOXEL_BLOCKS * 3);
    private openBlocks = new Uint8Array(NUM_VOXEL_BLOCKS);

    // Four channels rather than three because three.js derives no sized internal format for an RGB
    // byte 3D texture, so RGB is not a usable combination. The color texture spends the fourth
    // channel it is therefore obliged to carry on saying whether the block is open room or solid
    // block, which is what lets a filtered read be renormalized (see uploadTextures); the flux
    // texture has nothing to put there and leaves it at full.
    private colorBuffer = new Uint8Array(NUM_VOXEL_BLOCKS * 4);
    private fluxBuffer = new Uint8Array(NUM_VOXEL_BLOCKS * 4);
    private colorTexture: THREE.Data3DTexture;
    private fluxTexture: THREE.Data3DTexture;

    private lightSourceByObjectId: { [objectId: string]: LightSource } = {};

    // The voxels light is propagated through. Held rather than looked up so that this class does not
    // have to reach back into App for the current room, which would close an import cycle
    // (app -> graphicsManager -> lightBlockMap -> app).
    private voxels: Voxel[] | undefined;

    // Set whenever anything propagation depends on changes, and consumed once per frame, so that
    // dragging a lamp across the room costs one recomputation per frame rather than one per
    // transform update.
    private needsRecomputation = true;

    constructor()
    {
        // Nothing has been propagated yet, so the flux buffer starts out saying "no direction"
        // rather than "straight down the negative axes", which is what a buffer of zeroes decodes to.
        this.fluxBuffer.fill(FLUX_ZERO_BYTE);
        for (let blockIndex = 0; blockIndex < NUM_VOXEL_BLOCKS; ++blockIndex)
            this.fluxBuffer[blockIndex * 4 + 3] = 255;

        this.colorTexture = createBlockTexture(this.colorBuffer);
        this.fluxTexture = createBlockTexture(this.fluxBuffer);

        LightBlockMapMaterialUtil.setTextures(this.colorTexture, this.fluxTexture);
    }

    requestRecomputation()
    {
        this.needsRecomputation = true;
    }

    // Called when a room is loaded, and with no voxels when one is unloaded. This object outlives
    // every room it is used for (GraphicsManager keeps it for the app's whole lifetime), so the
    // previous room's lamps have to be dropped explicitly or they would go on lighting the next one.
    resetForRoom(voxels: Voxel[] | undefined)
    {
        this.voxels = voxels;
        this.lightSourceByObjectId = {};
        this.needsRecomputation = true;
    }

    addLightSource(objectId: string, lightSource: LightSource)
    {
        this.lightSourceByObjectId[objectId] = lightSource;
        this.needsRecomputation = true;
    }

    removeLightSource(objectId: string)
    {
        if (this.lightSourceByObjectId[objectId] == undefined)
            return;
        delete this.lightSourceByObjectId[objectId];
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

    // What light the room's own lamps put on a given point, in the linear space they accumulate in.
    // Read once a frame by whatever needs to know how well lit the player already is — the lamp the
    // camera carries stands down where the room lights itself, and takes on its color, so that a
    // room somebody has lit is seen by its own light rather than washed flat by a white one held an
    // arm's length away (see GraphicsManager).
    //
    // Sampled the way the shader samples it, smoothly between block centres rather than block by
    // block. A value that stepped as the player crossed from one block to the next would be a step
    // in how bright his own lamp is, which is a far more noticeable thing than the step itself.
    getLightAt(worldPos: Vec3, outLight: THREE.Color): THREE.Color
    {
        // Block centres sit at half-integers, so a position drops half a block to land on the
        // lattice the interpolation runs over.
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
                    // A solid block holds no light because there is nowhere in it for light to be,
                    // which is not the same as its surroundings being dark. Left out and the weights
                    // renormalized without it, so that standing against a wall does not read as
                    // standing in the dark — and hand the player's own lamp back at full strength
                    // exactly where he has walked up to look at something closely.
                    if (this.openBlocks[blockIndex] === 0)
                        continue;

                    const weight = rowWeight * colWeight * layerWeight;
                    const at = blockIndex * 3;
                    sumR += this.blockLightBuffer[at] * weight;
                    sumG += this.blockLightBuffer[at + 1] * weight;
                    sumB += this.blockLightBuffer[at + 2] * weight;
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

    // Coordinates outside the grid are clamped to its edge rather than refused, since this is asked
    // about wherever the camera happens to be and a camera can sit outside the room.
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

        // Marked whether or not there is anything to propagate, because getLightAt reads it too and
        // must never be answering from the shape of a room that has since been left.
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

        this.uploadTextures();
    }

    // Exposes the accumulated light through the byte range the textures hold.
    private uploadTextures()
    {
        for (let blockIndex = 0; blockIndex < NUM_VOXEL_BLOCKS; ++blockIndex)
        {
            const sourceIndex = blockIndex * 3;
            const targetIndex = blockIndex * 4;

            // The square root is stored and the shader squares it back. A byte spends half its steps
            // on the brightest half of the range, which is the half a dark room never visits, so the
            // dark falloff around a lamp bands visibly when stored directly; storing the root spends
            // those steps where the eye is actually looking, for one multiply in the shader.
            //
            // Clamping is what makes the brightest places flatten to white rather than wrap round to
            // black, since a typed array of bytes takes an out-of-range number modulo 256.
            for (let channel = 0; channel < 3; ++channel)
            {
                const exposed = Math.min(1,
                    this.blockLightBuffer[sourceIndex + channel] / LIGHT_BLOCK_MAP_MAX_BRIGHTNESS);
                this.colorBuffer[targetIndex + channel] = Math.sqrt(exposed) * 255;
            }

            // How much of this block is room rather than wall, which the shader divides back out of
            // whatever the filter mixed together.
            //
            // A solid block holds no light — the fill cannot enter one — so a sample taken anywhere
            // but exactly at an open block's centre is pulled toward black by however many solid
            // blocks the filter happened to reach. A wall's own face never notices, because the
            // half-block push along its normal lands its sample precisely on a block centre by
            // construction; anything standing *in* the room lands between centres and is darkened
            // for no reason but where it happens to be. Recording openness here is what lets that
            // be undone, and costs a channel that had nothing else to carry.
            this.colorBuffer[targetIndex + 3] = (this.openBlocks[blockIndex] !== 0) ? 255 : 0;

            // Only the direction survives; how much arrived is already in the color texture. A block
            // no light reached has no direction, and is written as the value that decodes to a zero
            // vector so the shader can tell the two apart.
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
        }
        this.colorTexture.needsUpdate = true;
        this.fluxTexture.needsUpdate = true;
    }
}

// What a direction of zero length encodes to, given that the encoding maps [-1,1] onto [0,255].
const FLUX_ZERO_BYTE = 128;

function createBlockTexture(buffer: Uint8Array): THREE.Data3DTexture
{
    // The dimensions follow the block index's layout rather than the world's axis order: a
    // Data3DTexture reads its data with the first dimension varying fastest, and the fastest-varying
    // part of a voxel-block index is the collision layer. So the texture's axes are
    // (collision layer, col, row), and a shader sampling it has to swizzle a world position into that
    // order — see LightBlockMapMaterialUtil.
    const texture = new THREE.Data3DTexture(buffer, NUM_COLLISION_LAYERS, NUM_VOXEL_COLS,
        NUM_VOXEL_ROWS);
    texture.format = THREE.RGBAFormat;
    texture.type = THREE.UnsignedByteType;
    // Interpolating between blocks is what turns a grid of cells into a smooth wash of light.
    // Data3DTexture defaults both filters to NearestFilter, so both have to be set.
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    // Sampling just outside the room (a surface on the boundary wall, pushed half a block outward)
    // should read the edge block rather than wrap round to the far side of the room.
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.wrapR = THREE.ClampToEdgeWrapping;
    // Color space left at its default (none): these buffers hold linear-space light, and marking
    // them as sRGB would have three.js convert them a second time on the way into the shader.
    texture.needsUpdate = true;
    return texture;
}
