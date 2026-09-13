import * as THREE from "three";
import VALUE_NOISE_GLSL from "./valueNoiseGLSL";
import ValueNoiseTextureUtil from "../util/valueNoiseTextureUtil";
import INSTANCE_COLOR_FRAGMENT_GLSL from "./instanceColorGLSL";

// Procedural antique tin toy: the instance color becomes aged paint over sheet metal. Paint wears off
// edges and corners (bare tin), rust blooms from worn spots and coarse-noise peaks, and fine grain
// mottles everything. A tight Phong specular sells the metal.

const VERTEX_PARS_GLSL = `
    varying vec3 vTinSurfacePos;
    varying vec3 vTinLocalPos;
`;

const VERTEX_GLSL = `
    // Object-space pattern scaled to world density; the scale doubles as a per-part seed.
    #ifdef USE_INSTANCING
        vec3 tinPartScale = vec3(
            length(instanceMatrix[0].xyz),
            length(instanceMatrix[1].xyz),
            length(instanceMatrix[2].xyz));
    #else
        vec3 tinPartScale = vec3(1.0);
    #endif
    vTinSurfacePos = position * tinPartScale * 16.0 + tinPartScale * 41.0;
    // Edge distance is only meaningful after interpolation (every vertex is a corner).
    vTinLocalPos = position;
`;

const FRAGMENT_PARS_GLSL = `
    varying vec3 vTinSurfacePos;
    varying vec3 vTinLocalPos;
    // Linear-space colors.
    const vec3 TIN_RUST_COLOR = vec3(0.147, 0.033, 0.009); // deep orange-brown corrosion
    const vec3 TIN_BARE_COLOR = vec3(0.342, 0.342, 0.319); // unpainted sheet metal
    const vec3 TIN_PATINA_TINT = vec3(0.88, 0.84, 0.72); // the yellowing of aged paint
    const float TIN_MAX_SHEEN = 0.85; // ceiling the specular highlight approaches but never reaches
    ${VALUE_NOISE_GLSL}
`;

const COLOR_FRAGMENT_GLSL = `
    ${INSTANCE_COLOR_FRAGMENT_GLSL}

    // Geometry spans [-0.5, 0.5]; the middle per-axis distance nears 1 only on edges and corners.
    // Proportional to the part (not world units) so parts of very different sizes age alike.
    vec3 tinAxisDist = abs(vTinLocalPos) * 2.0;
    float tinFarAxis = max(tinAxisDist.x, max(tinAxisDist.y, tinAxisDist.z));
    float tinNearAxis = min(tinAxisDist.x, min(tinAxisDist.y, tinAxisDist.z));
    float tinEdge = smoothstep(0.72, 1.0,
        tinAxisDist.x + tinAxisDist.y + tinAxisDist.z - tinFarAxis - tinNearAxis);

    float tinPatch = valueNoiseFbm(vTinSurfacePos);
    float tinGrain = valueNoise(vTinSurfacePos * 5.0);

    float tinWearAmount = tinEdge * (0.35 + 0.65 * tinGrain);
    float tinRustAmount = clamp(
        smoothstep(0.56, 0.76, tinPatch) + 0.5 * tinWearAmount * smoothstep(0.40, 0.62, tinPatch),
        0.0, 1.0) * (0.6 + 0.4 * tinGrain);

    // Aged paint: warmed, desaturated, mottled.
    vec3 tinPaint = diffuseColor.rgb * TIN_PATINA_TINT;
    tinPaint = mix(vec3(dot(tinPaint, vec3(0.2126, 0.7152, 0.0722))), tinPaint, 0.82);
    tinPaint *= 0.80 + 0.20 * tinGrain;

    diffuseColor.rgb = mix(tinPaint, TIN_BARE_COLOR * (0.85 + 0.3 * tinGrain), tinWearAmount);
    diffuseColor.rgb = mix(diffuseColor.rgb, TIN_RUST_COLOR * (0.75 + 0.5 * tinGrain), tinRustAmount);
`;

const NORMAL_FRAGMENT_GLSL = `
    // With the light at the camera, every facing surface sits at the specular peak and flares, and
    // the Fresnel rise toward grazing angles never happens. Reinstate it from the view angle.
    float tinFacing = saturate(dot(normal, normalize(vViewPosition)));
    // Bare tin keeps a stronger head-on reflection than paint.
    float tinHeadOnSheen = mix(0.12, 0.42, tinWearAmount * (1.0 - tinRustAmount));
    // Gentler than Schlick's 5th power, which would pin the sheen to silhouettes on blocky forms.
    float tinSheen = mix(pow(1.0 - tinFacing, 3.0), 1.0, tinHeadOnSheen);

    // Bare tin shiniest, rust powdery, paint uneven. (Variables from earlier injections are still
    // in scope: all chunks inline into one main().)
    specularStrength = tinSheen * (
        specularStrength * mix(1.0, 0.10, tinRustAmount) * (0.75 + 0.25 * tinGrain)
        + 0.6 * tinWearAmount * (1.0 - tinRustAmount));
`;

const LIGHTS_END_GLSL = `
    // Asymptotic specular compression so hot spots never clip into flat white (a local tone map).
    reflectedLight.directSpecular /= 1.0 + reflectedLight.directSpecular / TIN_MAX_SHEEN;
`;

export default function installInstancedTinShader(shader: THREE.WebGLProgramParametersWithUniforms)
{
    ValueNoiseTextureUtil.bindUniform(shader);

    shader.vertexShader = VERTEX_PARS_GLSL + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `
        #include <begin_vertex>
        ${VERTEX_GLSL}
        `
    );

    shader.fragmentShader = FRAGMENT_PARS_GLSL + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `
        #include <color_fragment>
        ${COLOR_FRAGMENT_GLSL}
        `
    );
    // After the normal is resolved (the sheen needs it) and before <lights_phong_fragment> reads
    // specularStrength.
    shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_maps>",
        `
        #include <normal_fragment_maps>
        ${NORMAL_FRAGMENT_GLSL}
        `
    );
    shader.fragmentShader = shader.fragmentShader.replace(
        "#include <lights_fragment_end>",
        `
        #include <lights_fragment_end>
        ${LIGHTS_END_GLSL}
        `
    );
}

export function applyInstancedTinMaterialProperties(material: THREE.MeshPhongMaterial)
{
    material.transparent = false;
    material.specular = new THREE.Color(0xb4b4a8); // Warm-grey metal sheen (the default is nearly black).
    material.shininess = 90;
}
