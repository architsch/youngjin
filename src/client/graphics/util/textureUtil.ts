import * as THREE from "three";
import TextureFactory from "../factories/textureFactory";
import GraphicsManager from "../graphicsManager";

const TextureUtil =
{
    // The optional source UV rect restricts sampling to a sub-region of the source texture
    // (e.g. a single cell of an atlas image); by default the full texture is drawn.
    drawImageOnRenderTarget: async (textureURL: string, renderTarget: THREE.WebGLRenderTarget,
        targetU1: number, targetV1: number, targetU2: number, targetV2: number,
        sourceU1: number = 0, sourceV1: number = 0,
        sourceU2: number = 1, sourceV2: number = 1,
        unloadTextureAfterDraw: boolean = true): Promise<void> =>
    {
        const renderer = GraphicsManager.getGameRenderer();

        const targetTexWidth = renderTarget.width;
        const targetTexHeight = renderTarget.height;

        //------------------------------------------------------------
        // Load the background texture
        //------------------------------------------------------------

        material.uniforms.sourceTexture.value = placeholderTexture;
        material.uniforms.sourceTexture.value.needsUpdate = true;

        //------------------------------------------------------------
        // Load the texture
        //------------------------------------------------------------

        const texture = textureURL.length > 0
            ? (await TextureFactory.loadStaticImageTexture(textureURL))
            : placeholderTexture;
        material.uniforms.sourceTexture.value = texture;
        material.uniforms.sourceTexture.value.needsUpdate = true;

        //------------------------------------------------------------
        // Fit the texture inside the target region based on the aspect ratios.
        //------------------------------------------------------------

        // NOTE:
        // See the section called "Fitting a Texture inside a Rectangular Region"
        // in @docs/geometry/texture.md for technical details.
        
        let x1 = -1 + 2 * targetU1;
        let x2 = -1 + 2 * targetU2;
        let y1 = -1 + 2 * targetV1;
        let y2 = -1 + 2 * targetV2;

        // As = Aspect Ratio of the Source Texture (its sampled sub-region, to be precise)
        const As = (texture.image?.width && texture.image?.height)
            ? (texture.image.width * (sourceU2 - sourceU1)) / (texture.image.height * (sourceV2 - sourceV1))
            : 1.0;

        // At = Aspect Ratio of the Target Region
        const At = (x2 - x1) / (y2 - y1);

        if (As < At)
        {
            const dx = As * (y2 - y1) / 2;
            const xAvg = (x1 + x2) / 2;
            x1 = xAvg - dx;
            x2 = xAvg + dx;
        }
        else if (As > At)
        {
            const dy = (x2 - x1) / (2 * As);
            const yAvg = (y1 + y2) / 2;
            y1 = yAvg - dy;
            y2 = yAvg + dy;
        }

        //------------------------------------------------------------
        // Render the texture
        //------------------------------------------------------------

        setQuadPositions(x1, y1, x2, y2);
        setQuadUVs(sourceU1, sourceV1, sourceU2, sourceV2);
        renderToTarget(renderer, renderTarget, targetTexWidth, targetTexHeight);

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
        const renderer = GraphicsManager.getGameRenderer();

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        material.uniforms.sourceTexture.value = texture;
        material.uniforms.sourceTexture.value.needsUpdate = true;

        setQuadPositions(-1 + 2 * targetU1, -1 + 2 * targetV1,
            -1 + 2 * targetU2, -1 + 2 * targetV2);
        setQuadUVs(0, 0, 1, 1);
        renderToTarget(renderer, renderTarget, renderTarget.width, renderTarget.height);

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
        sourceTexture: { value: null },
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

const savedViewport = new THREE.Vector4();

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

function renderToTarget(renderer: THREE.WebGLRenderer, renderTarget: THREE.WebGLRenderTarget,
    targetTexWidth: number, targetTexHeight: number)
{
    const pr = renderer.getPixelRatio();
    renderer.getViewport(savedViewport);
    const autoClear = renderer.autoClear;

    renderer.setPixelRatio(1);
    renderer.setViewport(0, 0, targetTexWidth, targetTexHeight);
    renderer.autoClear = false;

    renderer.setRenderTarget(renderTarget);
    renderer.render(mesh, camera);
    renderer.setRenderTarget(null);

    renderer.setPixelRatio(pr);
    renderer.setViewport(savedViewport);
    renderer.autoClear = autoClear;
}

export default TextureUtil;