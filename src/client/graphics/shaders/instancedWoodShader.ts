import * as THREE from "three";
import VALUE_NOISE_GLSL from "./valueNoiseGLSL";
import ValueNoiseTextureUtil from "../util/valueNoiseTextureUtil";
import INSTANCE_COLOR_FRAGMENT_GLSL from "./instanceColorGLSL";

// Procedural moulded timber: an aged wood panel with a carved moulding band (see
// DoorCompositionCodec). Band width and grain are measured in world units along the quad's axes, so
// bands match across parts of any size and the grain continues across neighbouring parts. Relief is
// shaded with a fixed world-space raking light, because the camera-mounted head light can't reveal it.
// Per-instance inputs: surface color, moulding color, band width, proud/sunk.

const VERTEX_PARS_GLSL = `
    attribute vec3 mouldingColor;
    attribute vec2 mouldingParams; // (band width in world units, +1 = proud / -1 = sunk)
    // Fixed in world space so the carving shading doesn't roll with the viewer.
    const vec3 WOOD_RAKING_LIGHT = vec3(-0.3578, 0.8944, 0.2683);
    // Packed to save varyings:
    // (quad-local position .xy, quad world extent .zw),
    // (moulding color .rgb, signed band width .a),
    // (board position .xy, raking light on quad axes .zw).
    varying vec4 vWoodQuad;
    varying vec4 vWoodMoulding;
    varying vec4 vWoodBoardRake;
    // Quad axes in view space, for tilting the normal toward the nearest edge.
    varying vec3 vWoodTangentX;
    varying vec3 vWoodTangentY;
`;

const VERTEX_GLSL = `
    #ifdef USE_INSTANCING
        mat3 woodBasis = mat3(modelMatrix) * mat3(instanceMatrix);
        vec3 woodWorldPos = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
    #else
        mat3 woodBasis = mat3(modelMatrix);
        vec3 woodWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    #endif
    // Grain runs along the quad's vertical; rings are counted across its horizontal.
    vec3 woodAcross = normalize(woodBasis[0]);
    vec3 woodAlong = normalize(woodBasis[1]);

    vWoodQuad = vec4(position.xy, length(woodBasis[0]), length(woodBasis[1]));
    vWoodMoulding = vec4(mouldingColor,
        max(mouldingParams.x, 0.0001) * (mouldingParams.y < 0.0 ? -1.0 : 1.0));
    // World position on the board axes: coplanar quads share coordinates regardless of scale.
    vWoodBoardRake = vec4(
        dot(woodWorldPos, woodAcross), dot(woodWorldPos, woodAlong),
        dot(WOOD_RAKING_LIGHT, woodAcross), dot(WOOD_RAKING_LIGHT, woodAlong));
    vWoodTangentX = mat3(viewMatrix) * woodAcross;
    vWoodTangentY = mat3(viewMatrix) * woodAlong;
`;

const FRAGMENT_PARS_GLSL = `
    varying vec4 vWoodQuad;
    varying vec4 vWoodMoulding;
    varying vec4 vWoodBoardRake;
    varying vec3 vWoodTangentX;
    varying vec3 vWoodTangentY;
    const float WOOD_PI = 3.14159265;

    // Growth rings per world unit (larger = finer). All other figure sizes are in ring-widths.
    const float WOOD_GRAIN_SCALE = 46.0;
    // Aging: palette colors are too vivid for timber and read as plastic otherwise.
    const float WOOD_FIGURE_CONTRAST = 0.40;
    const vec3 WOOD_PATINA_TINT = vec3(0.94, 0.86, 0.72);
    const float WOOD_SATURATION = 0.42;

    // The ring coordinate is warped instead of simulating a saw cut through a log. The arch field is
    // steep enough to fold the coordinate (closed loops = flatsawn arches) and is stretched along the
    // grain; the sweep field bows the whole figure; the wander field adds fine irregularity.
    const float WOOD_ARCH_FREQ = 0.055;
    const float WOOD_ARCH_ALONG = 0.30; // how much more slowly the arch field runs along the grain
    const float WOOD_ARCH_AMOUNT = 15.0;
    const float WOOD_SWEEP_FREQ = 0.013;
    const float WOOD_SWEEP_AMOUNT = 11.0;
    const float WOOD_WANDER_AMOUNT = 3.0;
    // Dark latewood band per ring, with width and darkness randomized per ring and along it. Capped
    // below half a ring so bands never merge; the mean keeps overall board tone unchanged.
    const float WOOD_LATEWOOD_MIN = 0.10;
    const float WOOD_LATEWOOD_MAX = 0.36;
    const float WOOD_LATEWOOD_LIMIT = 0.45;
    const float WOOD_LATEWOOD_MEAN = 0.15;

    // Knots: sparse, elongated along the grain, and ragged (a perfect ellipse looks like a target).
    const float WOOD_KNOT_SPACING = 50.0;
    const float WOOD_KNOT_DENSITY = 0.50;
    const float WOOD_KNOT_ELONGATION = 2.2;
    const float WOOD_KNOT_WOBBLE = 0.34;
    // Grain deflection, ring count, and ring sharpness (power of a raised cosine) of a knot.
    const float WOOD_KNOT_FLOW = 2.6;
    const float WOOD_KNOT_RINGS = 2.2;
    const float WOOD_KNOT_RING_SHARPNESS = 3.5;
    // Knot darkness (1.0 = same as the board).
    const float WOOD_KNOT_SHADE = 0.66;

    // Relief height as a fraction of band width, so profile steepness matches on any band.
    const float WOOD_RELIEF = 0.42;
    const float WOOD_CARVE_CONTRAST = 0.30;
    const float WOOD_CAVITY_CONTRAST = 0.14;
    // Floor on carving shade, which would otherwise compound with scene shadow into a black outline.
    const float WOOD_MIN_CARVE_SHADE = 0.55;
    // Partial normal tilt, only for a traveling specular highlight (the shading is baked above).
    const float WOOD_SPECULAR_TILT = 0.35;

    ${VALUE_NOISE_GLSL}
    vec3 woodAge(vec3 color)
    {
        vec3 aged = color * WOOD_PATINA_TINT;
        return mix(vec3(dot(aged, vec3(0.2126, 0.7152, 0.0722))), aged, WOOD_SATURATION);
    }
`;

const COLOR_FRAGMENT_GLSL = `
    ${INSTANCE_COLOR_FRAGMENT_GLSL}

    vec2 woodEdgeDist = (0.5 - abs(vWoodQuad.xy)) * vWoodQuad.zw;
    float woodBandWidth = abs(vWoodMoulding.a);
    // 0 at the nearest edge, 1 at the band's inner boundary. Using the nearer axis mitres corners.
    float woodBandCoord = min(woodEdgeDist.x, woodEdgeDist.y) / woodBandWidth;
    float woodBand = clamp(woodBandCoord, 0.0, 1.0);
    float woodProfileSign = (vWoodMoulding.a < 0.0) ? -1.0 : 1.0;
    // Profile height and slope; level at both band boundaries so parts sit flush.
    float woodHeight = WOOD_RELIEF * 0.5
        * (1.0 - cos(2.0 * WOOD_PI * woodBand)) * woodProfileSign;
    float woodSlope = WOOD_RELIEF * WOOD_PI
        * sin(2.0 * WOOD_PI * woodBand) * woodProfileSign;
    // Outward direction of the nearest edge.
    vec2 woodOutward = (woodEdgeDist.x < woodEdgeDist.y)
        ? vec2(vWoodQuad.x < 0.0 ? -1.0 : 1.0, 0.0)
        : vec2(0.0, vWoodQuad.y < 0.0 ? -1.0 : 1.0);

    // Board position in ring-widths.
    vec2 woodBoard = vWoodBoardRake.xy * WOOD_GRAIN_SCALE;

    // Knots first: the grain is sampled at the deflected position. Push is accumulated so overlapping
    // knots are order-independent.
    vec2 woodKnotPush = vec2(0.0);
    float woodKnotCore = 0.0;
    float woodKnotRing = 0.0;
    vec2 woodKnotCell = floor(woodBoard / WOOD_KNOT_SPACING);
    for (int j = -1; j <= 1; j++)
    {
        for (int i = -1; i <= 1; i++)
        {
            vec2 cell = woodKnotCell + vec2(float(i), float(j));
            float knotSeed = valueNoiseHash(vec3(cell, 13.0));
            if (knotSeed > WOOD_KNOT_DENSITY)
                continue;
            vec2 knotCenter = (cell + vec2(valueNoiseHash(vec3(cell, 29.0)),
                valueNoiseHash(vec3(cell, 47.0)))) * WOOD_KNOT_SPACING;
            float knotRadius = WOOD_KNOT_SPACING
                * mix(0.07, 0.15, knotSeed / WOOD_KNOT_DENSITY);
            vec2 toKnot = woodBoard - knotCenter;
            float knotDist = length(toKnot) + 0.001;
            // Outward push, strongest at the rim with inverse-square falloff, stretched along the
            // grain (teardrop shape).
            woodKnotPush += (toKnot / knotDist) * vec2(1.0, WOOD_KNOT_ELONGATION)
                * knotRadius * WOOD_KNOT_FLOW
                * knotRadius * knotRadius / (knotDist * knotDist + knotRadius * knotRadius);
            // Ellipse with a bearing-dependent radius, so outline and rings are irregular.
            vec2 knotRel = toKnot * vec2(1.0, 1.0 / WOOD_KNOT_ELONGATION);
            float knotBearing = atan(knotRel.y, knotRel.x);
            float knotWobble = 1.0 + WOOD_KNOT_WOBBLE * (2.0 * valueNoise(vec3(
                1.7 * cos(knotBearing), 1.7 * sin(knotBearing), cell.x + cell.y)) - 1.0);
            float knotEllipse = length(knotRel) / (knotRadius * knotWobble);
            float knotCore = 1.0 - smoothstep(0.45, 1.0, knotEllipse);
            woodKnotCore = max(woodKnotCore, knotCore);
            woodKnotRing = max(woodKnotRing, knotCore * pow(0.5 - 0.5 * cos(
                2.0 * WOOD_PI * WOOD_KNOT_RINGS * knotEllipse
                + 4.0 * valueNoise(vec3(knotRel * 0.3, 5.0))),
                WOOD_KNOT_RING_SHARPNESS));
        }
    }
    vec2 woodGrain = woodBoard + woodKnotPush;

    float woodArch = valueNoise(vec3(woodGrain.x * WOOD_ARCH_FREQ,
        woodGrain.y * WOOD_ARCH_FREQ * WOOD_ARCH_ALONG, 0.0));
    float woodSweep = valueNoiseFbm(vec3(woodGrain.x * WOOD_SWEEP_FREQ,
        woodGrain.y * WOOD_SWEEP_FREQ * 0.35, 4.0));
    float woodWander = valueNoiseFbm(vec3(woodGrain.x * 0.10, woodGrain.y * 0.022, 8.0));
    float woodRingCoord = woodGrain.x
        + WOOD_ARCH_AMOUNT * (woodArch - 0.5)
        + WOOD_SWEEP_AMOUNT * (woodSweep - 0.5)
        + WOOD_WANDER_AMOUNT * (woodWander - 0.5);

    float woodRingIndex = floor(woodRingCoord + 0.5);
    float woodLatewood = min(WOOD_LATEWOOD_LIMIT,
        mix(WOOD_LATEWOOD_MIN, WOOD_LATEWOOD_MAX,
            valueNoiseHash(vec3(woodRingIndex, 0.0, 0.0)))
        * (0.55 + 0.85 * valueNoise(vec3(woodRingIndex * 0.7, woodGrain.y * 0.03, 21.0))));
    float woodRing = (1.0 - smoothstep(0.0, woodLatewood, abs(woodRingCoord - woodRingIndex)))
        * mix(0.35, 1.0, valueNoiseHash(vec3(woodRingIndex, 3.0, 0.0)))
        // Trunk rings stop at a knot; otherwise the crowded rings and knot shade compound to black.
        * (1.0 - 0.85 * woodKnotCore);
    // Fade ring contrast as rings approach pixel size, to avoid moiré.
    float woodRingFade = 1.0 - smoothstep(0.25, 0.85, fwidth(woodRingCoord));
    float woodFleck = valueNoise(vec3(woodGrain * vec2(0.6, 0.25), 7.0));
    // Tonal banding follows the ring coordinate (growth order); banding along the board reads as a stain.
    float woodTone = valueNoise(vec3(woodRingCoord * 0.10, woodGrain.y * 0.005, 12.0));
    float woodFigure =
        (1.0 - WOOD_FIGURE_CONTRAST * (woodRing - WOOD_LATEWOOD_MEAN) * woodRingFade)
        * (0.84 + 0.32 * woodTone) * (0.94 + 0.12 * woodFleck)
        * mix(1.0, WOOD_KNOT_SHADE, woodKnotCore * mix(0.35, 1.0, woodKnotRing));

    // Raking light on the profile flanks, plus cavity shadow in sunk regions.
    float woodCarve = WOOD_CARVE_CONTRAST * woodSlope * dot(woodOutward, vWoodBoardRake.zw)
        + WOOD_CAVITY_CONTRAST * woodHeight;

    // Hard color edge at the band's inner boundary, anti-aliased over one pixel (a gradient reads as a
    // blurry line). Takes the unclamped coordinate, whose derivative clamping would zero past the boundary.
    float woodColorEdge = max(fwidth(woodBandCoord), 0.0005);
    vec3 woodTimber = woodAge(mix(vWoodMoulding.rgb, diffuseColor.rgb,
        smoothstep(1.0 - 0.5 * woodColorEdge, 1.0 + 0.5 * woodColorEdge, woodBandCoord)));
    diffuseColor.rgb = woodTimber * woodFigure
        * max(1.0 + woodCarve, WOOD_MIN_CARVE_SHADE);
`;

const NORMAL_FRAGMENT_GLSL = `
    // Tilt by the profile gradient for a highlight that travels with the viewer.
    normal = normalize(normal + WOOD_SPECULAR_TILT * woodSlope *
        (woodOutward.x * vWoodTangentX + woodOutward.y * vWoodTangentY));

    // The camera-mounted light flares whole facing panels (see the tin shader), so pull the sheen
    // back toward grazing angles and break it up with the pore fleck.
    specularStrength *= (0.70 + 0.30 * woodFleck)
        * mix(0.12, 1.0, 1.0 - saturate(dot(normal, normalize(vViewPosition))));
`;

export default function installInstancedWoodShader(shader: THREE.WebGLProgramParametersWithUniforms)
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
    // After the normal is resolved and before <lights_phong_fragment> reads it.
    shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_maps>",
        `
        #include <normal_fragment_maps>
        ${NORMAL_FRAGMENT_GLSL}
        `
    );
}

export function applyInstancedWoodMaterialProperties(material: THREE.MeshPhongMaterial)
{
    material.transparent = false;
    material.specular = new THREE.Color(0x2e2a24); // Satin wax: present, but far short of the tin's glint.
    material.shininess = 14;
    // Doors sit flush against their wall.
    material.polygonOffset = true;
    material.polygonOffsetFactor = -1;
    material.polygonOffsetUnits = -1;
}
