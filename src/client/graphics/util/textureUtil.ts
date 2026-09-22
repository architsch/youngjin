import * as THREE from "three";
import TextureFactory from "../factories/textureFactory";
import GraphicsManager from "../graphicsManager";

// Draws images or canvases onto dynamic textures (see TextureFactory.loadDynamicEmptyTexture) via one
// shared quad pass. Regions are in texture coordinates (V up).
const TextureUtil =
{
    // Draws an image fitted (aspect preserved) into a region, leaving the rest of the region transparent;
    // an empty URL paints the placeholder color. regionAspect is the region's aspect ratio as shown, for a
    // region stretched where it is shown (e.g. a texture cell on a quad of another shape). The optional
    // source UV rect selects a sub-region (e.g. one atlas cell).
    drawImageOnRenderTarget: async (textureURL: string, renderTarget: THREE.WebGLRenderTarget,
        targetU1: number, targetV1: number, targetU2: number, targetV2: number,
        regionAspect?: number,
        sourceU1: number = 0, sourceV1: number = 0,
        sourceU2: number = 1, sourceV2: number = 1,
        unloadTextureAfterDraw: boolean = true): Promise<void> =>
    {
        // Load the texture

        const texture = textureURL.length > 0
            ? (await TextureFactory.loadSourceImageTexture(textureURL))
            : placeholderTexture;

        // Fit the texture inside the target region (see @docs/geometry/texture.md).

        let u1 = targetU1;
        let u2 = targetU2;
        let v1 = targetV1;
        let v2 = targetV2;

        // As = Aspect Ratio of the Source Texture (its sampled sub-region, to be precise)
        const As = (texture.image?.width && texture.image?.height)
            ? (texture.image.width * (sourceU2 - sourceU1)) / (texture.image.height * (sourceV2 - sourceV1))
            : 1.0;

        // At = Aspect Ratio of the Target Region (as shown)
        const At = regionAspect ?? (u2 - u1) / (v2 - v1);

        if (As < At)
        {
            const du = (u2 - u1) * As / (2 * At);
            const uAvg = (u1 + u2) / 2;
            u1 = uAvg - du;
            u2 = uAvg + du;
        }
        else if (As > At)
        {
            const dv = (v2 - v1) * At / (2 * As);
            const vAvg = (v1 + v2) / 2;
            v1 = vAvg - dv;
            v2 = vAvg + dv;
        }

        // Render the texture. The region is cleared only now that the texture has loaded, so a redraw never
        // leaves it empty for a while.

        drawSourceTexture(transparentTexture, renderTarget, targetU1, targetV1, targetU2, targetV2, 0, 0, 1, 1);
        drawSourceTexture(texture, renderTarget, u1, v1, u2, v2, sourceU1, sourceV1, sourceU2, sourceV2);

        if (unloadTextureAfterDraw && textureURL.length > 0)
            TextureFactory.unload(textureURL);
    },
    // Draws a canvas covering the region as-is. No letterboxing (the caller shaped it) and no clear
    // needed, since the draw replaces rather than blends.
    drawCanvasOnRenderTarget: (canvas: HTMLCanvasElement, renderTarget: THREE.WebGLRenderTarget,
        targetU1: number, targetV1: number, targetU2: number, targetV2: number): void =>
    {
        const texture = TextureFactory.createSourceCanvasTexture(canvas);
        drawSourceTexture(texture, renderTarget, targetU1, targetV1, targetU2, targetV2, 0, 0, 1, 1);

        // The pixels are in the render target now; nothing reads this copy of them again.
        texture.dispose();
    },
}

// 1x1 dark gray placeholder texture for when no image is available
const placeholderData = new Uint8Array([40, 40, 40, 255]);
const placeholderTexture = new THREE.DataTexture(placeholderData, 1, 1, THREE.RGBAFormat);
placeholderTexture.needsUpdate = true;

const transparentData = new Uint8Array([0, 0, 0, 0]);
const transparentTexture = new THREE.DataTexture(transparentData, 1, 1, THREE.RGBAFormat);
transparentTexture.needsUpdate = true;

// Replaces the target region instead of blending, so transparent canvases don't mix with old contents.
const material = new THREE.RawShaderMaterial({
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
    gl_FragColor = texture2D(sourceTexture, vUv);
}
`,
});

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

const mesh = new THREE.Mesh(geometry, material);
mesh.position.set(0, 0, 0);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
camera.position.set(0, 0, 1);

function drawSourceTexture(texture: THREE.Texture, renderTarget: THREE.WebGLRenderTarget,
    targetU1: number, targetV1: number, targetU2: number, targetV2: number,
    sourceU1: number, sourceV1: number, sourceU2: number, sourceV2: number)
{
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
