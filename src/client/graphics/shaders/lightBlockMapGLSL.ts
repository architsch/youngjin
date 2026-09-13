import { COLLISION_LAYER_HEIGHT, MAX_ROOM_Y, NUM_VOXEL_COLS, NUM_VOXEL_ROWS }
    from "../../../shared/system/sharedConstants";
import { LIGHT_BLOCK_MAP_AMBIENT_SHARE, LIGHT_BLOCK_MAP_MAX_BRIGHTNESS }
    from "../../system/clientConstants";

// Samples the light block map (see LightBlockMap) and adds it to a lit material's lighting. Names
// are prefixed to avoid colliding with three.js chunks.

// Samples are pushed half a block along the normal so a one-block wall doesn't bleed light from its
// lit side onto its dark side.
const HALF_BLOCK_GLSL =
    `vec3(0.5, ${(0.5 * COLLISION_LAYER_HEIGHT).toFixed(4)}, 0.5)`;

export const LIGHT_BLOCK_MAP_PARS_GLSL = `
    varying vec3 vLightBlockMapWorldPos;
    varying vec3 vLightBlockMapWorldNormal;
`;

export const LIGHT_BLOCK_MAP_FRAGMENT_PARS_GLSL = `
    ${LIGHT_BLOCK_MAP_PARS_GLSL}
    uniform sampler3D lightBlockMapColor;
    uniform sampler3D lightBlockMapFlux;

    // Texture axes are (layer, col, row), following the block index layout.
    vec3 lightBlockMapWorldToUVW(vec3 worldPos)
    {
        return vec3(
            worldPos.y * ${(1 / MAX_ROOM_Y).toFixed(8)},
            worldPos.x * ${(1 / NUM_VOXEL_COLS).toFixed(8)},
            worldPos.z * ${(1 / NUM_VOXEL_ROWS).toFixed(8)});
    }

    // Returns lamp light at this fragment, plus the direction toward the light (view space, the
    // three.js convention), the facing cosine against the final perturbed normal, and the share of
    // the light that is directional.
    vec3 readLightBlockMap(vec3 viewSpaceNormal, out vec3 lightDir, out float facing,
        out float directionalShare)
    {
        lightDir = vec3(0.0);
        facing = 0.0;
        directionalShare = 0.0;

        vec3 samplePos = vLightBlockMapWorldPos +
            vLightBlockMapWorldNormal * ${HALF_BLOCK_GLSL};
        vec3 uvw = lightBlockMapWorldToUVW(samplePos);

        vec4 texel = texture(lightBlockMapColor, uvw);

        // Alpha = filtered openness. Dividing it out stops nearby solid (lightless) blocks from
        // darkening samples; ~0 means the sample is inside a wall.
        if (texel.a < 0.004)
            return vec3(0.0);

        // Stored as sqrt(brightness).
        vec3 lit = texel.rgb / texel.a;
        lit = lit * lit * ${LIGHT_BLOCK_MAP_MAX_BRIGHTNESS.toFixed(4)};

        vec4 fluxTexel = texture(lightBlockMapFlux, uvw);
        vec3 flux = fluxTexel.rgb * 2.0 - 1.0;
        float fluxLength = length(flux);
        // Flux points along travel, so the light direction is its negation. Zero = no light.
        if (fluxLength > 0.001)
        {
            lightDir = -(mat3(viewMatrix) * (flux / fluxLength));
            facing = max(0.0, dot(viewSpaceNormal, lightDir));
        }
        // Renormalized by openness like the color.
        directionalShare = clamp(fluxTexel.a / texel.a, 0.0, 1.0);
        return lit;
    }
`;

// Placed after <project_vertex>. The normal skips the inverse transpose: it only offsets the sample
// point, and the quads are axis-aligned. Shading uses three.js's own normal.
export const LIGHT_BLOCK_MAP_VERTEX_GLSL = `
    vec4 lightBlockMapWorldPos4 = vec4(transformed, 1.0);
    vec3 lightBlockMapNormal = objectNormal;
    #ifdef USE_BATCHING
        lightBlockMapWorldPos4 = batchingMatrix * lightBlockMapWorldPos4;
        lightBlockMapNormal = mat3(batchingMatrix) * lightBlockMapNormal;
    #endif
    #ifdef USE_INSTANCING
        lightBlockMapWorldPos4 = instanceMatrix * lightBlockMapWorldPos4;
        lightBlockMapNormal = mat3(instanceMatrix) * lightBlockMapNormal;
    #endif
    vLightBlockMapWorldPos = (modelMatrix * lightBlockMapWorldPos4).xyz;
    vLightBlockMapWorldNormal = normalize(mat3(modelMatrix) * lightBlockMapNormal);
`;

// Diffuse is added to irradiance (where three.js adds light maps). Specular is added as direct
// specular (the light has a direction), so materials like tin keep their sheen and pass through
// their own highlight compression; the math mirrors RE_Direct_BlinnPhong. The facing test applies
// only to the directional share, so adding a lamp can never darken a surface.
export const LIGHT_BLOCK_MAP_FRAGMENT_GLSL = `
    #if defined( RE_IndirectDiffuse )
        vec3 lightBlockMapDir;
        float lightBlockMapFacing;
        float lightBlockMapDirectionalShare;
        vec3 lightBlockMapLit = readLightBlockMap(normal, lightBlockMapDir, lightBlockMapFacing,
            lightBlockMapDirectionalShare);

        const float lightBlockMapAmbientShare = ${LIGHT_BLOCK_MAP_AMBIENT_SHARE.toFixed(4)};
        float lightBlockMapReach = 1.0 -
            lightBlockMapDirectionalShare * (1.0 - lightBlockMapFacing);
        irradiance += lightBlockMapLit *
            (lightBlockMapAmbientShare + (1.0 - lightBlockMapAmbientShare) * lightBlockMapReach);

        // PHONG guard: the specular terms only exist on Blinn-Phong materials. Non-directional light
        // produces no highlight, so the share scales this term.
        #if defined( PHONG )
            reflectedLight.directSpecular += lightBlockMapLit * lightBlockMapDirectionalShare *
                lightBlockMapFacing *
                BRDF_BlinnPhong(lightBlockMapDir, geometryViewDir, normal,
                    material.specularColor, material.specularShininess) *
                material.specularStrength;
        #endif
    #endif
`;
