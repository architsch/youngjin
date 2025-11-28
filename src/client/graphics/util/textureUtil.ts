import * as THREE from "three";
import TextureFactory from "../factories/textureFactory";
import GraphicsManager from "../graphicsManager";

const vec2Temp = new THREE.Vector2();
const vec4Temp = new THREE.Vector4();

const TextureUtil =
{
    drawTextureOnRenderTarget: async (textureURL: string, renderTarget: THREE.WebGLRenderTarget,
        targetU1: number, targetV1: number, targetU2: number, targetV2: number): Promise<void> =>
    {
        const texture = await TextureFactory.loadStaticImageTexture(textureURL);
        material.uniforms.sourceTexture.value = texture;
        material.uniforms.sourceTexture.value.needsUpdate = true;

        const renderer = GraphicsManager.getGameRenderer();
        const targetTexWidth = renderTarget.texture.width;
        const targetTexHeight = renderTarget.texture.height;
        const w = targetTexWidth * (targetU2 - targetU1);
        const h = targetTexHeight * (targetV2 - targetV1);
        const x = targetTexWidth * targetU1;
        const y = targetTexHeight * targetV1;

        renderer.getViewport(vec4Temp);
        renderer.getSize(vec2Temp);
        const pr = renderer.getPixelRatio();

        renderer.setViewport(x, y, w, h);
        renderer.setSize(w, h);
        renderer.setPixelRatio(1);

        renderer.setRenderTarget(renderTarget);
        renderer.render(mesh, camera);
        renderer.setRenderTarget(null);

        renderer.setPixelRatio(pr);
        renderer.setSize(vec2Temp.x, vec2Temp.y);
        renderer.setViewport(vec4Temp);

        TextureFactory.unload(textureURL);
    }
}

const material = new THREE.RawShaderMaterial({
    uniforms: {
        sourceTexture: { value: null }
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

export default TextureUtil;