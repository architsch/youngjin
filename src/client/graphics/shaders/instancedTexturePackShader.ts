import * as THREE from "three";
import installInstanceOutlineShader from "./instanceOutlineShader";

// Points every instance of a mesh at its own cell of one shared texture pack, so that a whole room's
// worth of differently textured quads is drawn in a single call. Each instance carries where its cell
// starts and how much of it to sample; this turns that into the stock chunks' own UV.

const VERTEX_PARS_GLSL = `
    attribute vec2 uvStart;
    attribute vec2 uvSampleSize;
`;

// The only part of this shader that varies from one texture pack to the next, so it is the only part
// built per material rather than once for all of them.
function vertexGLSL(uScale: number, vScale: number): string
{
    return `
        vMapUv = uvStart + vec2(
            uvSampleSize[0] * vMapUv[0] * ${uScale.toFixed(7)},
            uvSampleSize[1] * vMapUv[1] * ${vScale.toFixed(7)}
        );
    `;
}

export default function installInstancedTexturePackShader(
    shader: THREE.WebGLProgramParametersWithUniforms,
    uvScales: readonly [number, number], outlineColorHex: string | undefined)
{
    shader.vertexShader = VERTEX_PARS_GLSL + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
        "#include <uv_vertex>",
        `
        #include <uv_vertex>
        ${vertexGLSL(uvScales[0], uvScales[1])}
        `
    );
    if (outlineColorHex)
        installInstanceOutlineShader(shader, outlineColorHex);
}

// How far into a cell the sampling window may run, per axis: the cell's own share of the whole
// texture, pulled in by half a texel at each edge so that filtering never reaches into the cell next
// door. Worked out here rather than in the material, since it is what the shader above is written
// against.
export function getUVScales(textureWidth: number, textureHeight: number,
    cellWidth: number, cellHeight: number): [number, number]
{
    return [
        (cellWidth / textureWidth) * ((cellWidth - 1) / cellWidth),
        (cellHeight / textureHeight) * ((cellHeight - 1) / cellHeight),
    ];
}
