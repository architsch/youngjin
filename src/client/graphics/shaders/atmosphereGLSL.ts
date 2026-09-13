import VALUE_NOISE_GLSL from "./valueNoiseGLSL";
import Vec3 from "../../../shared/math/types/vec3";

// Room atmosphere GLSL. Two fields: the sky is read by view *direction* (it's at infinity, so weather
// stays put as the player walks); fog/smoke is read by world *position* (a volume the player stands
// in). They meet seamlessly because the sky is fogged by the room's air up to where the view ray
// leaves the room (see the sky shader and @docs/graphics/lighting.md).

// Domain warp strength: shears noise masses along their gradient, turning mottle into cloud shapes.
const ATMOSPHERE_WARP = 0.9;

// Threshold that cuts the field into cloud vs. clear. Fixed; only the edge width is a room setting.
const ATMOSPHERE_COVERAGE_LEVEL = 0.52;

// How much lighter the air is toward the horizon.
const ATMOSPHERE_HORIZON_DEPTH = 0.16;

// Clouds fade out over this band below the horizon (cloud below the horizon would read as a stain on
// the ground), roughly matching the band where land fades in.
const ATMOSPHERE_CLOUD_FLOOR = 0.18;

// Cloud drift direction per unit of speed (see AtmosphereMaterialUtil). Not normalized.
export const ATMOSPHERE_CLOUD_DRIFT: Vec3 = { x: 1, y: 0.4, z: -0.7 };

// Room settings are uniforms, not constants: constants would recompile every material on every
// slider change.
export const ATMOSPHERE_PARS_GLSL = `
    // (scale, strength, edge width)
    uniform vec3 atmosphereClouds;
    // Drift in noise units, accumulated and wrapped on the CPU (see AtmosphereMaterialUtil).
    uniform vec3 atmosphereCloudDrift;
    uniform vec3 atmosphereCloudColor;
    ${VALUE_NOISE_GLSL}

    const float ATMOSPHERE_WARP = ${ATMOSPHERE_WARP.toFixed(4)};
    const float ATMOSPHERE_COVERAGE_LEVEL = ${ATMOSPHERE_COVERAGE_LEVEL.toFixed(4)};
    const float ATMOSPHERE_HORIZON_DEPTH = ${ATMOSPHERE_HORIZON_DEPTH.toFixed(4)};
    const float ATMOSPHERE_CLOUD_FLOOR = ${ATMOSPHERE_CLOUD_FLOOR.toFixed(4)};

    // Cloud amount (0..1) in a direction.
    float atmosphereCloudAmount(vec3 dir)
    {
        // Drift is applied before scaling, making speed angular and independent of cloud scale.
        vec3 p = dir * atmosphereClouds.x + atmosphereCloudDrift;

        vec3 warp = valueNoiseWarp(p);
        float field = valueNoiseFbm(p + warp * ATMOSPHERE_WARP);

        // Edge width never below one pixel's change, to avoid shimmering.
        float edge = max(atmosphereClouds.z, fwidth(field));
        return smoothstep(ATMOSPHERE_COVERAGE_LEVEL - edge, ATMOSPHERE_COVERAGE_LEVEL + edge, field);
    }

    // Sky color: a blend from the clear sky color toward the cloud color (a shade of the sky alone
    // would be invisible against dark skies).
    vec3 atmosphereColor(vec3 clearColor, vec3 viewDir)
    {
        vec3 dir = normalize(viewDir);

        float presence = smoothstep(-ATMOSPHERE_CLOUD_FLOOR, 0.0, dir.y);

        // The expensive field is skipped when strength is zero (the default for most rooms, so the
        // whole frame takes one branch) or below the cloud band. fwidth on the branch boundary is
        // harmless because strength is zero there.
        vec3 sky = clearColor;
        float cloudStrength = atmosphereClouds.y * presence;
        if (cloudStrength > 0.0)
            sky = mix(clearColor, atmosphereCloudColor, atmosphereCloudAmount(dir) * cloudStrength);

        float horizon = smoothstep(-0.25, 0.6, dir.y);
        return sky * (1.0 - ATMOSPHERE_HORIZON_DEPTH * (horizon - 0.5));
    }
`;

// Gentler warp than clouds: land must stay a surface that can't fold over itself.
const ATMOSPHERE_GROUND_WARP = 0.7;

// Height threshold between low and peak colors. Set above the (crest-lifted) field's middle so the low
// color dominates and peaks are the accent.
const ATMOSPHERE_GROUND_LEVEL = 0.685;

// Ridge accent strength; too high and the whole surface becomes crest/crease ripples.
const ATMOSPHERE_GROUND_CREST = 0.14;

// Haze rate, in units of the ground plane's drop below the eye. Land fades fully into the air at the
// horizon, so ground and sky meet in the same color with no visible cut.
const ATMOSPHERE_GROUND_HAZE = 0.12;

// Guards the division for near-level rays.
const ATMOSPHERE_GROUND_MIN_DIP = 0.002;

// Extra slope width per feature width of distance, which smooths far land that would otherwise crawl.
const ATMOSPHERE_GROUND_SPREAD = 0.008;

// Below this land presence the shift is under one 8-bit step, so the field is skipped.
const ATMOSPHERE_GROUND_MIN_PRESENCE = 0.002;

// Land below the horizon, drawn by the sky only (fog must not fade walls into hillsides). Sampled by
// direction like clouds; the room is too small for parallax to matter.
export const ATMOSPHERE_GROUND_PARS_GLSL = `
    uniform vec3 atmosphereGroundColor;
    uniform vec3 atmospherePeakColor;
    // (scale, solidity, slope width)
    uniform vec3 atmosphereGroundShape;

    const float ATMOSPHERE_GROUND_WARP = ${ATMOSPHERE_GROUND_WARP.toFixed(4)};
    const float ATMOSPHERE_GROUND_LEVEL = ${ATMOSPHERE_GROUND_LEVEL.toFixed(4)};
    const float ATMOSPHERE_GROUND_CREST = ${ATMOSPHERE_GROUND_CREST.toFixed(4)};
    const float ATMOSPHERE_GROUND_HAZE = ${ATMOSPHERE_GROUND_HAZE.toFixed(4)};
    const float ATMOSPHERE_GROUND_MIN_DIP = ${ATMOSPHERE_GROUND_MIN_DIP.toFixed(4)};
    const float ATMOSPHERE_GROUND_SPREAD = ${ATMOSPHERE_GROUND_SPREAD.toFixed(4)};
    const float ATMOSPHERE_GROUND_MIN_PRESENCE = ${ATMOSPHERE_GROUND_MIN_PRESENCE.toFixed(4)};

    // Warped fBm plus a folded "crest" term that lays ridgelines along mid-height contours.
    float atmosphereGroundHeight(vec2 p)
    {
        vec2 warp = valueNoiseWarp(vec3(p, 0.0)).xy;
        float field = valueNoiseFbm(vec3(p + warp * ATMOSPHERE_GROUND_WARP, 0.0));
        float crest = 1.0 - abs(field * 2.0 - 1.0);
        return field + ATMOSPHERE_GROUND_CREST * crest * crest;
    }

    vec3 atmosphereGround(vec3 air, vec3 dir)
    {
        if (dir.y >= 0.0)
            return air;

        // Intersect a plane one unit below the eye (a plane, not the dome, gives ground perspective).
        // The drop is folded into the haze constant; room scale applies only to the sample point.
        vec2 groundRay = dir.xz / max(-dir.y, ATMOSPHERE_GROUND_MIN_DIP);
        float groundRange = length(groundRay);

        // Computed first so the field is skipped where land has hazed away. Solidity divides the
        // haze rate (never lifts the floor), so land still reaches zero exactly at the horizon.
        float landPresence = exp(-groundRange * ATMOSPHERE_GROUND_HAZE / atmosphereGroundShape.y);
        if (landPresence < ATMOSPHERE_GROUND_MIN_PRESENCE)
            return air;

        vec2 groundPoint = groundRay * atmosphereGroundShape.x;

        float height = atmosphereGroundHeight(groundPoint);
        float slope = atmosphereGroundShape.z + length(groundPoint) * ATMOSPHERE_GROUND_SPREAD;
        vec3 land = mix(atmosphereGroundColor, atmospherePeakColor,
            smoothstep(ATMOSPHERE_GROUND_LEVEL - slope, ATMOSPHERE_GROUND_LEVEL + slope, height));

        return mix(air, land, landPresence);
    }
`;

// Gentler than clouds; the uncut smoke field shows hard shear as creases.
const ATMOSPHERE_SMOKE_WARP = 0.6;

// The shearing field moves at this fraction of the smoke's speed, so masses deform instead of
// scrolling rigidly. Applied on the CPU (see AtmosphereMaterialUtil).
export const ATMOSPHERE_SMOKE_CHURN = 0.35;

// Thinning ramp: no hard cut (an edge in the air reads as a crease). Inset from the field's range
// because fBm crowds around its middle.
const ATMOSPHERE_SMOKE_LOW = 0.30;
const ATMOSPHERE_SMOKE_HIGH = 0.72;

// The fog's smoke field (independent of the clouds).
export const ATMOSPHERE_SMOKE_PARS_GLSL = `
    // (scale, strength)
    uniform vec2 atmosphereSmoke;
    // Running totals wrapped on the CPU. Separate uniforms, since a lag computed here would jump
    // whenever the travel wrapped.
    uniform vec3 atmosphereSmokeTravel;
    uniform vec3 atmosphereSmokeChurn;
    ${VALUE_NOISE_GLSL}

    const float ATMOSPHERE_SMOKE_WARP = ${ATMOSPHERE_SMOKE_WARP.toFixed(4)};
    const float ATMOSPHERE_SMOKE_LOW = ${ATMOSPHERE_SMOKE_LOW.toFixed(4)};
    const float ATMOSPHERE_SMOKE_HIGH = ${ATMOSPHERE_SMOKE_HIGH.toFixed(4)};

    // Air thinning (0..1) at a world position. Travel is in world units, so speed is independent
    // of scale.
    float atmosphereSmokeThinning(vec3 worldPos)
    {
        vec3 p = worldPos * atmosphereSmoke.x - atmosphereSmokeTravel;

        // Offset to decorrelate the shearing field from the smoke.
        vec3 q = worldPos * atmosphereSmoke.x - atmosphereSmokeChurn + 13.7;
        vec3 warp = valueNoiseWarp(q);

        float field = valueNoiseFbm(p + warp * ATMOSPHERE_SMOKE_WARP);
        return smoothstep(ATMOSPHERE_SMOKE_LOW, ATMOSPHERE_SMOKE_HIGH, field);
    }
`;

// World position from the vertex stage (cheaper than reconstructing it per fragment).
export const ATMOSPHERE_FOG_VERTEX_PARS_GLSL = `
    #ifdef USE_FOG
        varying vec3 vAtmosphereWorldPos;
    #endif
`;

// Same transform order as three.js's projection, so instanced meshes land correctly.
export const ATMOSPHERE_FOG_VERTEX_GLSL = `
    #ifdef USE_FOG
        vec4 atmosphereWorld = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
            atmosphereWorld = instanceMatrix * atmosphereWorld;
        #endif
        vAtmosphereWorldPos = (modelMatrix * atmosphereWorld).xyz;
    #endif
`;

export const ATMOSPHERE_FOG_FRAGMENT_PARS_GLSL = `
    #ifdef USE_FOG
        varying vec3 vAtmosphereWorldPos;
    #endif
    ${ATMOSPHERE_SMOKE_PARS_GLSL}
`;

// Replaces three.js's fog chunk (distance math verbatim) so smoke can scale fog *coverage*; the color
// is the plain fog color. The field only runs when strength > 0 (uniform, whole-frame branch) and the
// fragment is actually fogged (usually false for nearby surfaces).
export const ATMOSPHERE_FOG_FRAGMENT_GLSL = `
    #ifdef USE_FOG
        #ifdef FOG_EXP2
            float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
        #else
            float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
        #endif
        if (atmosphereSmoke.y > 0.0 && fogFactor > 0.0)
        {
            fogFactor *= 1.0 -
                atmosphereSmoke.y * atmosphereSmokeThinning(vAtmosphereWorldPos);
        }
        gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
    #endif
`;
