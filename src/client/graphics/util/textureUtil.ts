import * as THREE from "three";
import TextureFactory from "../factories/textureFactory";
import GraphicsManager from "../graphicsManager";

// Draws pictures onto dynamic textures (see TextureFactory.loadDynamicEmptyTexture), whatever the
// pictures started out as — an image asset or a canvas the caller painted. Either one becomes a source
// texture set up the same way (see TextureFactory), and every source texture is drawn by the same quad
// through the same pass (see drawSourceTexture).
//
// Every region below is given in texture coordinates, whose V counts up from the bottom: of the render
// target, and of the source image as well.
const TextureUtil =
{
    // Draws an image asset over the given region of a render target, fitted inside it with its
    // aspect ratio kept. An empty URL paints the placeholder color instead.
    //
    // The optional source UV rect restricts sampling to a sub-region of the source texture
    // (e.g. a single cell of an atlas image); by default the full texture is drawn.
    drawImageOnRenderTarget: async (textureURL: string, renderTarget: THREE.WebGLRenderTarget,
        targetU1: number, targetV1: number, targetU2: number, targetV2: number,
        sourceU1: number = 0, sourceV1: number = 0,
        sourceU2: number = 1, sourceV2: number = 1,
        unloadTextureAfterDraw: boolean = true): Promise<void> =>
    {
        //------------------------------------------------------------
        // Load the texture
        //------------------------------------------------------------

        const texture = textureURL.length > 0
            ? (await TextureFactory.loadSourceImageTexture(textureURL))
            : placeholderTexture;

        //------------------------------------------------------------
        // Fit the texture inside the target region based on the aspect ratios.
        //------------------------------------------------------------

        // NOTE:
        // See the section called "Fitting a Texture inside a Rectangular Region"
        // in @docs/geometry/texture.md for technical details.

        let u1 = targetU1;
        let u2 = targetU2;
        let v1 = targetV1;
        let v2 = targetV2;

        // As = Aspect Ratio of the Source Texture (its sampled sub-region, to be precise)
        const As = (texture.image?.width && texture.image?.height)
            ? (texture.image.width * (sourceU2 - sourceU1)) / (texture.image.height * (sourceV2 - sourceV1))
            : 1.0;

        // At = Aspect Ratio of the Target Region
        const At = (u2 - u1) / (v2 - v1);

        if (As < At)
        {
            const du = As * (v2 - v1) / 2;
            const uAvg = (u1 + u2) / 2;
            u1 = uAvg - du;
            u2 = uAvg + du;
        }
        else if (As > At)
        {
            const dv = (u2 - u1) / (2 * As);
            const vAvg = (v1 + v2) / 2;
            v1 = vAvg - dv;
            v2 = vAvg + dv;
        }

        //------------------------------------------------------------
        // Render the texture
        //------------------------------------------------------------

        drawSourceTexture(texture, renderTarget, u1, v1, u2, v2, sourceU1, sourceV1, sourceU2, sourceV2);

        if (unloadTextureAfterDraw && textureURL.length > 0)
            TextureFactory.unload(textureURL);
    },
    // Draws a 2D canvas over the given region of a render target, exactly as it stands.
    //
    // Unlike an image, a canvas is drawn by the caller at whatever shape the region is, so there is
    // no aspect ratio to reconcile and nothing to letterbox — the canvas simply covers the region.
    // That is also what makes clearing unnecessary: the draw does not blend (see the material
    // below), so what the canvas holds replaces what was there, alpha and all, and a region that was
    // showing something else comes out showing only this.
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

// The source replaces whatever the target region held rather than being blended over it. For an
// opaque image the two are the same thing; for a canvas carrying transparency they are not, and
// blending would leave the region holding some mixture of the old contents and the new.
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

// Draws the given region of a source texture over the given region of a render target — the one step
// that every picture this module draws ends in.
function drawSourceTexture(texture: THREE.Texture, renderTarget: THREE.WebGLRenderTarget,
    targetU1: number, targetV1: number, targetU2: number, targetV2: number,
    sourceU1: number, sourceV1: number, sourceU2: number, sourceV2: number)
{
    // Assigning the texture is all it takes. One that has never been drawn was flagged for upload when
    // it was created, and flagging one that has been would upload the whole of it again — which, for
    // a texture kept loaded to be drawn from many times (a picture frame atlas), would be every time.
    material.uniforms.sourceTexture.value = texture;

    setQuadPositions(-1 + 2 * targetU1, -1 + 2 * targetV1, -1 + 2 * targetU2, -1 + 2 * targetV2);
    // A source texture is uploaded the right way up (see TextureFactory), so its image's top row lies
    // at the bottom of texture coordinates. Mirroring V is what turns it upright again.
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

// Renders the quad into the render target, over whatever the target already holds (the rest of its
// cells, above all).
//
// Nothing about the renderer's own canvas is touched to do it. A bound render target brings its own
// viewport, spanning the whole target, so neither the renderer's pixel ratio nor its viewport has any
// say in this pass — and changing the pixel ratio is far from free, since three.js resizes the canvas
// to apply it, which reallocates the whole drawing buffer.
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
