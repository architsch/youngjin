import * as THREE from "three";

// The uniforms a mirror's glass reads (see mirrorShader): its reflection, which MirrorReflectionUtil sets as it draws
// one, and its surface, which MirrorGameObject sets from the mirror's own. They live here rather than there to avoid an
// import cycle through MaterialFactory.

// Uniform holders are never replaced (three.js re-reads "value" each frame).
const mirrorMapUniform: {value: THREE.Texture | null} = {value: null};
const mirrorTextureMatrixUniform = {value: new THREE.Matrix4()};
// The texture coordinates the reflection was drawn within: from the middle of its first texel to the middle of its
// last, so that filtering never reads what lies outside it.
const mirrorUVBoundsUniform = {value: new THREE.Vector4(0, 0, 1, 1)};
// 0 until a reflection is drawn for the glass, which shows a plain color meanwhile.
const mirrorReflectionShownUniform = {value: 0};
// The surface laid over the reflection: its color (linear), and how opaque it is (0 for a plain mirror).
const mirrorSurfaceColorUniform = {value: new THREE.Color(0, 0, 0)};
const mirrorSurfaceOpacityUniform = {value: 0};

const MirrorMaterialUtil =
{
    bindUniforms: (shader: THREE.WebGLProgramParametersWithUniforms) =>
    {
        shader.uniforms.mirrorMap = mirrorMapUniform;
        shader.uniforms.mirrorTextureMatrix = mirrorTextureMatrixUniform;
        shader.uniforms.mirrorUVBounds = mirrorUVBoundsUniform;
        shader.uniforms.mirrorReflectionShown = mirrorReflectionShownUniform;
        shader.uniforms.mirrorSurfaceColor = mirrorSurfaceColorUniform;
        shader.uniforms.mirrorSurfaceOpacity = mirrorSurfaceOpacityUniform;
    },
    // The glass's surface (see MirrorObjectTypeConfig): a palette color, as sRGB bytes, and its opacity as a share.
    setSurface: (r: number, g: number, b: number, opacity: number) =>
    {
        mirrorSurfaceColorUniform.value.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
        mirrorSurfaceOpacityUniform.value = opacity;
    },
    // Whether the surface hides the reflection altogether, which then needn't be drawn.
    isSurfaceOpaque: (): boolean =>
    {
        return mirrorSurfaceOpacityUniform.value >= 1;
    },
    // What the glass shows: the texture a reflection was drawn into, where it drew each point of the room (see
    // MirrorProjectionUtil.getTextureMatrix), and the part of the texture it drew.
    setReflection: (texture: THREE.Texture, textureMatrix: THREE.Matrix4, uvBounds: THREE.Vector4) =>
    {
        mirrorMapUniform.value = texture;
        mirrorTextureMatrixUniform.value.copy(textureMatrix);
        mirrorUVBoundsUniform.value.copy(uvBounds);
        mirrorReflectionShownUniform.value = 1;
    },
    // Until a reflection is drawn for a new glass.
    clearReflection: () =>
    {
        mirrorMapUniform.value = null;
        mirrorReflectionShownUniform.value = 0;
    },
}

export default MirrorMaterialUtil;
