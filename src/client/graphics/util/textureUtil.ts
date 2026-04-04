import * as THREE from "three";
import TextureFactory from "../factories/textureFactory";
import GraphicsManager from "../graphicsManager";

const TextureUtil =
{
    drawImageOnRenderTarget: async (textureURL: string, renderTarget: THREE.WebGLRenderTarget,
        targetU1: number, targetV1: number, targetU2: number, targetV2: number): Promise<void> =>
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
        // Render the background
        //------------------------------------------------------------

        let x1 = -1 + 2 * targetU1;
        let x2 = -1 + 2 * targetU2;
        let y1 = -1 + 2 * targetV1;
        let y2 = -1 + 2 * targetV2;
        setQuadPositions(x1, y1, x2, y2);
        renderToTarget(renderer, renderTarget, targetTexWidth, targetTexHeight);

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
        
        // As = Aspect Ratio of the Source Texture
        const As = (texture.image?.width && texture.image?.height)
            ? texture.image.width / texture.image.height
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
        renderToTarget(renderer, renderTarget, targetTexWidth, targetTexHeight);

        if (textureURL.length > 0)
            TextureFactory.unload(textureURL);
    }
}

// 1x1 dark gray placeholder texture for when no image is available
const placeholderData = new Uint8Array([40, 40, 40, 255]);
const placeholderTexture = new THREE.DataTexture(placeholderData, 1, 1, THREE.RGBAFormat);
placeholderTexture.needsUpdate = true;

const material = new THREE.RawShaderMaterial({
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