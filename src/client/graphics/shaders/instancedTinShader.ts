import * as THREE from "three";
import VALUE_NOISE_GLSL from "./valueNoiseGLSL";
import ValueNoiseTextureUtil from "../util/valueNoiseTextureUtil";
import INSTANCE_COLOR_FRAGMENT_GLSL from "./instanceColorGLSL";

// Renders each instance as a piece of an antique tin toy: the per-instance color is treated as aged
// lithographed paint over sheet metal rather than as a flat fill. Three signals drive the effect —
// the fragment's distance to the piece's edges, a coarse noise field, and a fine grain. Paint wears
// off along the edges and corners the toy would have been handled by (exposing bare tin), rust blooms
// out of those worn spots and out of the coarse field's peaks, and the grain mottles everything so
// nothing spreads as a clean-edged blob. Because the sheen is what sells the metal, the material
// keeps a bright, tight Phong specular: bare tin glints, intact paint stays glossy, and rust goes
// powdery.

const VERTEX_PARS_GLSL = `
    varying vec3 vTinSurfacePos;
    varying vec3 vTinLocalPos;
`;

const VERTEX_GLSL = `
    // Sample the surface pattern in the part's own object space, scaled up into world
    // units. Being object-space, the pattern stays welded to the part as the object moves;
    // being scaled, its density stays constant instead of stretching with the part's
    // dimensions. The scale doubles as a cheap per-part seed, so that a body assembled out
    // of similar boxes doesn't repeat the same blemishes on every one of them.
    #ifdef USE_INSTANCING
        vec3 tinPartScale = vec3(
            length(instanceMatrix[0].xyz),
            length(instanceMatrix[1].xyz),
            length(instanceMatrix[2].xyz));
    #else
        vec3 tinPartScale = vec3(1.0);
    #endif
    vTinSurfacePos = position * tinPartScale * 16.0 + tinPartScale * 41.0;
    // Handed to the fragment stage rather than reduced here, because every vertex of a
    // primitive sits on one of its corners — the edge measure below is only meaningful
    // once it is interpolated across a face.
    vTinLocalPos = position;
`;

const FRAGMENT_PARS_GLSL = `
    varying vec3 vTinSurfacePos;
    varying vec3 vTinLocalPos;
    // The constants below are linear-space equivalents of the sRGB colors they are named
    // after, since the fragment stage works in the renderer's linear working color space.
    const vec3 TIN_RUST_COLOR = vec3(0.147, 0.033, 0.009); // deep orange-brown corrosion
    const vec3 TIN_BARE_COLOR = vec3(0.342, 0.342, 0.319); // unpainted sheet metal
    const vec3 TIN_PATINA_TINT = vec3(0.88, 0.84, 0.72); // the yellowing of aged paint
    const float TIN_MAX_SHEEN = 0.85; // ceiling the specular highlight approaches but never reaches
    ${VALUE_NOISE_GLSL}
`;

const COLOR_FRAGMENT_GLSL = `
    ${INSTANCE_COLOR_FRAGMENT_GLSL}

    // Every geometry this material is used with spans [-0.5, 0.5] on each axis, so the
    // middle of the three per-axis distances only approaches the surface where two axes are
    // extreme at once — that is, along the piece's edges and corners.
    //
    // Measured as a fraction of the part rather than in world units. Wear that is a fixed
    // physical width is the truer account of a hand rubbing a toy, and it is the wrong one
    // here: the parts are small and vary by an order of magnitude in size, so a fixed band
    // is a hairline on the large ones and swallows the small ones, and the character stops
    // reading as one aged object. A proportional band ages every part alike.
    vec3 tinAxisDist = abs(vTinLocalPos) * 2.0;
    float tinFarAxis = max(tinAxisDist.x, max(tinAxisDist.y, tinAxisDist.z));
    float tinNearAxis = min(tinAxisDist.x, min(tinAxisDist.y, tinAxisDist.z));
    float tinEdge = smoothstep(0.72, 1.0,
        tinAxisDist.x + tinAxisDist.y + tinAxisDist.z - tinFarAxis - tinNearAxis);

    float tinPatch = valueNoiseFbm(vTinSurfacePos);
    float tinGrain = valueNoise(vTinSurfacePos * 5.0);

    // The paint goes first along the edges the toy gets handled by; the grain keeps that
    // from running as a clean stripe down every one of them.
    float tinWearAmount = tinEdge * (0.35 + 0.65 * tinGrain);
    // Rust blooms out of the coarse field's peaks, and creeps in where the paint is thin.
    float tinRustAmount = clamp(
        smoothstep(0.56, 0.76, tinPatch) + 0.5 * tinWearAmount * smoothstep(0.40, 0.62, tinPatch),
        0.0, 1.0) * (0.6 + 0.4 * tinGrain);

    // Age the instance's color into lithographed paint: warm it, knock its saturation back,
    // and let the grain mottle it, so a flat fill stops reading as moulded plastic.
    vec3 tinPaint = diffuseColor.rgb * TIN_PATINA_TINT;
    tinPaint = mix(vec3(dot(tinPaint, vec3(0.2126, 0.7152, 0.0722))), tinPaint, 0.82);
    tinPaint *= 0.80 + 0.20 * tinGrain;

    diffuseColor.rgb = mix(tinPaint, TIN_BARE_COLOR * (0.85 + 0.3 * tinGrain), tinWearAmount);
    diffuseColor.rgb = mix(diffuseColor.rgb, TIN_RUST_COLOR * (0.75 + 0.5 * tinGrain), tinRustAmount);
`;

const NORMAL_FRAGMENT_GLSL = `
    // The scene's lamp rides on the camera, which collapses Blinn-Phong's half-vector onto
    // the view direction: every surface turned toward the viewer sits at the peak of the
    // specular lobe at once, so whole faces flare to the lamp's color instead of catching a
    // highlight somewhere across them. The same degeneracy flattens the response that makes
    // metal read as metal — real reflectance is weakest looking straight down the normal and
    // climbs steeply toward the silhouette, but with the light and the eye in one place the
    // angle of incidence stays near zero however the surface is turned, so that climb never
    // happens. Reinstate it explicitly from the view angle: the head-on case drops back out
    // of the clipping range, while grazing surfaces keep a strong glint. Little is lost, as
    // a broad even sheen was never the part that read as metal.
    float tinFacing = saturate(dot(normal, normalize(vViewPosition)));
    // Bare tin holds a far stronger head-on reflection than the paint around it, so worn
    // spots stay bright flecks rather than being flattened along with everything else.
    float tinHeadOnSheen = mix(0.12, 0.42, tinWearAmount * (1.0 - tinRustAmount));
    // A gentler exponent than Schlick's fifth power, which hugs its floor until a surface is
    // nearly edge-on — on forms this blocky that would pin the sheen to a thin outline
    // around each piece instead of letting it shade across the piece's face.
    float tinSheen = mix(pow(1.0 - tinFacing, 3.0), 1.0, tinHeadOnSheen);

    // Bare tin is the shiniest thing on the toy, rust is powdery and barely reflects, and
    // intact paint keeps its gloss unevenly. ('tinRustAmount' and friends are declared by
    // the injection above — every stock chunk is inlined into the same main() block, so
    // they are still in scope here.)
    specularStrength = tinSheen * (
        specularStrength * mix(1.0, 0.10, tinRustAmount) * (0.75 + 0.25 * tinGrain)
        + 0.6 * tinWearAmount * (1.0 - tinRustAmount));
`;

const LIGHTS_END_GLSL = `
    // Even with the falloff above, a piece caught close to the lamp can still drive its
    // highlight past the display's white point, where it stops reading as a highlight and
    // becomes a flat, shapeless patch. Compress the sheen asymptotically instead, so a hot
    // spot keeps approaching white without ever arriving and the surface underneath stays
    // legible. This is the job a global tone mapper would do, confined to this material's
    // specular term so that nothing else in the scene shifts.
    reflectedLight.directSpecular /= 1.0 + reflectedLight.directSpecular / TIN_MAX_SHEEN;
`;

export default function installInstancedTinShader(shader: THREE.WebGLProgramParametersWithUniforms)
{
    // The corrosion and the grain are read out of the shared noise field, so the material has to be
    // handed it (see ValueNoiseTextureUtil).
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
    // Injected after the normal is resolved rather than at <specularmap_fragment> (where
    // 'specularStrength' is declared), because the sheen above is measured against the shading
    // normal. Both points sit ahead of <lights_phong_fragment>, which is where the stock shader
    // finally reads 'specularStrength', so writing to it here still takes effect.
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

// What the material itself must be set to for the shader above to read as metal. Kept beside the
// shader rather than in the material's constructor, since the sheen and the code that shapes it are
// one description of one surface.
export function applyInstancedTinMaterialProperties(material: THREE.MeshPhongMaterial)
{
    material.transparent = false;
    material.specular = new THREE.Color(0xb4b4a8); // Warm-grey metal sheen (the default is nearly black).
    material.shininess = 90;
}
