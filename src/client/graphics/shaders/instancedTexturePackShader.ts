import * as THREE from "three";
import installInstanceOutlineShader from "./instanceOutlineShader";

// Maps each instance to its own cell of a shared texture pack atlas, so a room's quads draw in one call.

const VERTEX_PARS_GLSL = `
    attribute vec2 uvStart;
    attribute vec2 uvSampleSize;
`;

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

// A cell's share of the texture, inset by half a texel per edge so filtering never reads the neighbour.
export function getUVScales(textureWidth: number, textureHeight: number,
    cellWidth: number, cellHeight: number): [number, number]
{
    return [
        (cellWidth / textureWidth) * ((cellWidth - 1) / cellWidth),
        (cellHeight / textureHeight) * ((cellHeight - 1) / cellHeight),
    ];
}
