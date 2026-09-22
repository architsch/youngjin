import * as THREE from "three";
import installInstanceOutlineShader from "./instanceOutlineShader";
import INSTANCE_COLOR_FRAGMENT_GLSL from "./instanceColorGLSL";

// Maps each instance to its own cell of a shared texture pack atlas, so a room's quads draw in one call.

// A coverage-only texture's one channel is the texel's opacity (see
// InstancedTexturePackMaterialParams.coverageOnly).
const COVERAGE_MAP_FRAGMENT_GLSL = `
    #ifdef USE_MAP
        diffuseColor.a *= texture2D(map, vMapUv).r;
    #endif
`;

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
    uvScales: readonly [number, number], outlineColorHex: string | undefined, coverageOnly: boolean)
{
    if (coverageOnly)
    {
        shader.fragmentShader = shader.fragmentShader.replace(
            "#include <map_fragment>", COVERAGE_MAP_FRAGMENT_GLSL);
        shader.fragmentShader = shader.fragmentShader.replace(
            "#include <color_fragment>",
            `
            #include <color_fragment>
            ${INSTANCE_COLOR_FRAGMENT_GLSL}
            `
        );
    }
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
