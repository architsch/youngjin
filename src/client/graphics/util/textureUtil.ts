import * as THREE from "three";
import TextureFactory from "../factories/textureFactory";
import GraphicsManager from "../graphicsManager";
import NumUtil from "../../../shared/math/util/numUtil";

const texelsTemp = new Uint8Array(2 * 2 * 4);

// Draws images or canvases onto dynamic textures (see TextureFactory.loadDynamicEmptyTexture) via one
// shared quad pass, and reads their opacity back. Regions are in texture coordinates (V up).
const TextureUtil =
{
    // Draws an image stretched over a region (its caller shaped the region; see TextureAtlasLayoutUtil); an
    // empty URL paints the placeholder color. The image is loaded for the draw and let go after it. Skipped
    // if shouldDraw says no once it has loaded (e.g. the region has changed hands meanwhile).
    drawImageOnRenderTarget: async (textureURL: string, renderTarget: THREE.WebGLRenderTarget,
        targetU1: number, targetV1: number, targetU2: number, targetV2: number,
        shouldDraw?: () => boolean): Promise<void> =>
    {
        if (textureURL.length == 0)
        {
            if (shouldDraw?.() !== false)
                drawSourceTexture(placeholderTexture, renderTarget, targetU1, targetV1, targetU2, targetV2, 0, 0, 1, 1);
            return;
        }
        const texture = await acquireSourceTexture(textureURL);
        try
        {
            if (shouldDraw?.() !== false)
                drawSourceTexture(texture, renderTarget, targetU1, targetV1, targetU2, targetV2, 0, 0, 1, 1);
        }
        finally
        {
            releaseSourceTexture(textureURL, true);
        }
    },
    // Draws a canvas covering the region as-is. No letterboxing (the caller shaped it) and no clear
    // needed, since the draw replaces rather than blends.
    drawCanvasOnRenderTarget: (canvas: HTMLCanvasElement, renderTarget: THREE.WebGLRenderTarget,
        targetU1: number, targetV1: number, targetU2: number, targetV2: number): void =>
    {
        drawSourceTexture(getCanvasTexture(canvas), renderTarget,
            targetU1, targetV1, targetU2, targetV2, 0, 0, 1, 1);
    },
    // The opacity (0 to 1) a linearly filtered sample of a dynamic texture has at a point, in texels from its
    // bottom-left corner. Read back from the GPU, which waits for every draw issued before it: for a one-off
    // question (a click), never per frame. Opaque where there is nothing to read (no alpha channel, or a
    // read that fails, e.g. on a lost context).
    readAlphaOnRenderTarget: (renderTarget: THREE.WebGLRenderTarget, texelX: number, texelY: number): number =>
    {
        if (renderTarget.texture.format !== THREE.RGBAFormat)
            return 1;

        // The four texels the filter blends, whose centres lie half a texel in from their corners.
        const x0 = NumUtil.clampInRange(Math.floor(texelX - 0.5), 0, renderTarget.width - 2);
        const y0 = NumUtil.clampInRange(Math.floor(texelY - 0.5), 0, renderTarget.height - 2);
        const weightX = NumUtil.clampInRange(texelX - 0.5 - x0, 0, 1);
        const weightY = NumUtil.clampInRange(texelY - 0.5 - y0, 0, 1);

        texelsTemp.fill(255);
        GraphicsManager.getGameRenderer().readRenderTargetPixels(renderTarget, x0, y0, 2, 2, texelsTemp);
        const lower = texelsTemp[3] * (1 - weightX) + texelsTemp[7] * weightX;
        const upper = texelsTemp[11] * (1 - weightX) + texelsTemp[15] * weightX;
        return (lower * (1 - weightY) + upper * weightY) / 255;
    },
}

// Kept while callers pass the same canvas (e.g. LabelText's shared one), so a redraw re-uploads into
// one GPU texture instead of allocating a new one. That storage is fixed-size, hence the size check.
let canvasTexture: THREE.Texture | undefined;
let canvasTextureWidth = 0;
let canvasTextureHeight = 0;

function getCanvasTexture(canvas: HTMLCanvasElement): THREE.Texture
{
    if (canvasTexture != undefined && canvasTexture.image === canvas
        && canvasTextureWidth === canvas.width && canvasTextureHeight === canvas.height)
    {
        canvasTexture.needsUpdate = true; // The canvas has been redrawn since the last upload.
        return canvasTexture;
    }
    canvasTexture?.dispose();
    canvasTexture = TextureFactory.createSourceCanvasTexture(canvas);
    canvasTextureWidth = canvas.width;
    canvasTextureHeight = canvas.height;
    return canvasTexture;
}

// Source images held by draws in flight, so draws of one image at once share it and the last lets it go (the
// factory caches one texture per path).
const sourceTextureUses = new Map<string, {texture: Promise<THREE.Texture>, numUsers: number}>();

async function acquireSourceTexture(textureURL: string): Promise<THREE.Texture>
{
    let use = sourceTextureUses.get(textureURL);
    if (use == undefined)
    {
        use = {texture: TextureFactory.loadSourceImageTexture(textureURL), numUsers: 0};
        sourceTextureUses.set(textureURL, use);
    }
    ++use.numUsers;
    try
    {
        return await use.texture;
    }
    catch (err)
    {
        releaseSourceTexture(textureURL, false);
        throw err;
    }
}

function releaseSourceTexture(textureURL: string, loaded: boolean): void
{
    const use = sourceTextureUses.get(textureURL);
    if (use == undefined || --use.numUsers > 0)
        return;
    sourceTextureUses.delete(textureURL);
    if (loaded)
        TextureFactory.unload(textureURL);
}

// 1x1 dark gray placeholder texture for when no image is available
const placeholderData = new Uint8Array([40, 40, 40, 255]);
const placeholderTexture = new THREE.DataTexture(placeholderData, 1, 1, THREE.RGBAFormat);
placeholderTexture.needsUpdate = true;

// Replaces the target region instead of blending, so transparent canvases don't mix with old contents.
function createCopyMaterial(fragColorGLSL: string): THREE.RawShaderMaterial
{
    return new THREE.RawShaderMaterial({
        blending: THREE.NoBlending,
        uniforms: {
            sourceTexture: { value: placeholderTexture },
        },
        vertexShader: `
attribute vec3 position;
attribute vec2 uv;

varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
}
`,
        fragmentShader: `
precision highp float;

uniform sampler2D sourceTexture;

varying vec2 vUv;

void main() {
    gl_FragColor = ${fragColorGLSL};
}
`,
    });
}

const colorCopyMaterial = createCopyMaterial("texture2D(sourceTexture, vUv)");
// A single-channel target keeps only the source's coverage.
const coverageCopyMaterial = createCopyMaterial("vec4(texture2D(sourceTexture, vUv).a)");

const geometry = new THREE.BufferGeometry();

const positions = new Float32Array([
    -1.0, +1.0, 0.0,
    -1.0, -1.0, 0.0,
    +1.0, -1.0, 0.0,
    +1.0, -1.0, 0.0,
    +1.0, +1.0, 0.0,
    -1.0, +1.0, 0.0,
]);
const positionAttrib = new THREE.BufferAttribute(positions, 3, false);
geometry.setAttribute("position", positionAttrib);

const uvs = new Float32Array([
    0, 1,
    0, 0,
    1, 0,
    1, 0,
    1, 1,
    0, 1,
]);
const uvAttrib = new THREE.BufferAttribute(uvs, 2, false);
geometry.setAttribute("uv", uvAttrib);

const mesh = new THREE.Mesh(geometry, colorCopyMaterial);
mesh.position.set(0, 0, 0);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
camera.position.set(0, 0, 1);

function drawSourceTexture(texture: THREE.Texture, renderTarget: THREE.WebGLRenderTarget,
    targetU1: number, targetV1: number, targetU2: number, targetV2: number,
    sourceU1: number, sourceV1: number, sourceU2: number, sourceV2: number)
{
    const material = (renderTarget.texture.format === THREE.RedFormat)
        ? coverageCopyMaterial : colorCopyMaterial;
    mesh.material = material;
    // Don't set needsUpdate: new textures are already flagged, and re-flagging re-uploads (costly for
    // atlases drawn from repeatedly).
    material.uniforms.sourceTexture.value = texture;

    setQuadPositions(-1 + 2 * targetU1, -1 + 2 * targetV1, -1 + 2 * targetU2, -1 + 2 * targetV2);
    // Source textures aren't flipped on upload (see TextureFactory), so mirror V.
    setQuadUVs(sourceU1, 1 - sourceV1, sourceU2, 1 - sourceV2);
    renderToTarget(renderTarget);

    // Not left holding the texture, whose owner may dispose of it the moment this returns.
    material.uniforms.sourceTexture.value = placeholderTexture;
}

function setQuadPositions(x1: number, y1: number, x2: number, y2: number)
{
    positionAttrib.setXYZ(0, x1, y2, 0);
    positionAttrib.setXYZ(1, x1, y1, 0);
    positionAttrib.setXYZ(2, x2, y1, 0);
    positionAttrib.setXYZ(3, x2, y1, 0);
    positionAttrib.setXYZ(4, x2, y2, 0);
    positionAttrib.setXYZ(5, x1, y2, 0);
    positionAttrib.needsUpdate = true;
}

function setQuadUVs(u1: number, v1: number, u2: number, v2: number)
{
    uvAttrib.setXY(0, u1, v2);
    uvAttrib.setXY(1, u1, v1);
    uvAttrib.setXY(2, u2, v1);
    uvAttrib.setXY(3, u2, v1);
    uvAttrib.setXY(4, u2, v2);
    uvAttrib.setXY(5, u1, v2);
    uvAttrib.needsUpdate = true;
}

// Render targets bring their own viewport, so the renderer's pixel ratio (costly to change) is
// left untouched.
function renderToTarget(renderTarget: THREE.WebGLRenderTarget)
{
    const renderer = GraphicsManager.getGameRenderer();
    const prevRenderTarget = renderer.getRenderTarget();
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;

    renderer.setRenderTarget(renderTarget);
    renderer.render(mesh, camera);
    renderer.setRenderTarget(prevRenderTarget);

    renderer.autoClear = autoClear;
}

export default TextureUtil;
