import { COLLISION_LAYER_HEIGHT, MAX_ROOM_Y, NUM_VOXEL_COLS, NUM_VOXEL_ROWS }
    from "../../../shared/system/sharedConstants";
import { LIGHT_BLOCK_MAP_AMBIENT_SHARE, LIGHT_BLOCK_MAP_MAX_BRIGHTNESS }
    from "../../system/clientConstants";

// Reads the room's light block map (see LightBlockMap) — the two 3D textures holding how much light
// stands in each voxel block and which way it came from — and folds the result into a lit material's
// indirect diffuse.
//
// The names are prefixed rather than plain, because this source is concatenated into three.js's own
// shader source and must not collide with anything the stock chunks declare.

// Half a voxel block, per axis. The sample point is pushed this far along the surface's own normal:
// the textures are filtered, so a point taken exactly on a surface interpolates between the block in
// front of it and the block behind it — and for a one-block-thick wall the block behind is the dark
// side of it, which would let a lit room bleed light onto its own back wall.
const HALF_BLOCK_GLSL =
    `vec3(0.5, ${(0.5 * COLLISION_LAYER_HEIGHT).toFixed(4)}, 0.5)`;

// The declarations and the sampling function, shared by both stages that need them.
export const LIGHT_BLOCK_MAP_PARS_GLSL = `
    varying vec3 vLightBlockMapWorldPos;
    varying vec3 vLightBlockMapWorldNormal;
`;

export const LIGHT_BLOCK_MAP_FRAGMENT_PARS_GLSL = `
    ${LIGHT_BLOCK_MAP_PARS_GLSL}
    uniform sampler3D lightBlockMapColor;
    uniform sampler3D lightBlockMapFlux;

    // A world position, as a coordinate in the block textures. The textures' axes follow the voxel
    // block index's own layout rather than the world's axis order — (collision layer, col, row) —
    // so the position is swizzled on the way in. See LightBlockMap.
    vec3 lightBlockMapWorldToUVW(vec3 worldPos)
    {
        return vec3(
            worldPos.y * ${(1 / MAX_ROOM_Y).toFixed(8)},
            worldPos.x * ${(1 / NUM_VOXEL_COLS).toFixed(8)},
            worldPos.z * ${(1 / NUM_VOXEL_ROWS).toFixed(8)});
    }

    // What the room's own lamps are doing at this fragment: how much light stands here, which way it
    // is coming from, how squarely the surface meets it, and how much of it is coming from that way
    // at all rather than from every side at once.
    //
    // "viewSpaceNormal" is the fragment's final normal — the one the bump work has already perturbed
    // — which is why the direction light arrives from is brought into view space to meet it rather
    // than the other way round. That is what lets the tin's sheen and the wood's carving react to
    // which side of them a lamp stands on.
    //
    // The direction comes back pointing *toward* the light, which is the convention three.js's own
    // lights use, so it can be handed straight to a BRDF.
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

        // The alpha channel says how much of what was filtered together was open room rather than
        // solid block, and dividing it back out is what makes this reading independent of where the
        // sample happened to fall. Solid blocks hold no light, so without it every sample taken
        // between block centres is dragged toward black by whatever wall the filter reached — which
        // a wall's own face never suffers, its sample landing on a centre by construction, and which
        // anything standing in the room suffers constantly. A sample with no open block near it at
        // all is inside a wall, and has nothing to report.
        if (texel.a < 0.004)
            return vec3(0.0);

        // The texture holds the square root of the brightness, so that a byte spends its steps on
        // the dark half of the range the eye is actually looking at (see LightBlockMap).
        vec3 lit = texel.rgb / texel.a;
        lit = lit * lit * ${LIGHT_BLOCK_MAP_MAX_BRIGHTNESS.toFixed(4)};

        vec4 fluxTexel = texture(lightBlockMapFlux, uvw);
        vec3 flux = fluxTexel.rgb * 2.0 - 1.0;
        float fluxLength = length(flux);
        // Light travels *along* the flux direction, so a surface faces the light when its normal
        // opposes it. A block no light reached stores a zero vector, which has no direction to face.
        if (fluxLength > 0.001)
        {
            lightDir = -(mat3(viewMatrix) * (flux / fluxLength));
            facing = max(0.0, dot(viewSpaceNormal, lightDir));
        }
        // How much of that light is travelling that way rather than standing here from every side
        // (see LightBlockMap). Renormalized by openness for the same reason the light itself is:
        // a solid block records no direction, and would otherwise drag every sample near a wall
        // toward "from everywhere".
        directionalShare = clamp(fluxTexel.a / texel.a, 0.0, 1.0);
        return lit;
    }
`;

// Carries the fragment's world position and world normal down from the vertex stage. Written to sit
// after "#include <project_vertex>", where the instance transform has already been applied to
// "transformed" — the same reconstruction three.js's own worldpos_vertex chunk performs.
//
// The normal is carried through the plain matrix rather than through its inverse transpose, which a
// non-uniformly scaled instance would need. That is deliberate: this normal only pushes the sample
// point off the surface it sits on, where being a fraction of a degree out changes nothing, and the
// quads it is carried for are axis-aligned anyway. The normal that actually shades the fragment is
// three.js's own, taken in the fragment stage.
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

// Folded into "irradiance", which is where three.js already adds a light map's contribution, and
// under the same guard the stock chunk uses — outside it the variable does not exist.
//
// The specular half is what makes a material that is *about* its sheen keep working under a room's
// own lamps. Without it the block map delivers diffuse only, and a material whose whole read is the
// glint — the tin — arrives dark and flat beside a wall lit by the same lamp: for the wall, diffuse
// is very nearly all there is, while for the tin it is the half that was deliberately aged down.
// That was tolerable while the head lamp was the only light in the game, and stopped being tolerable
// the moment a room could light itself and the head lamp learned to stand out of the way.
//
// It is added as *direct* specular rather than indirect on purpose. The light being described has a
// direction — which is the whole point of the flux texture — so it belongs with the terms that have
// one, and it then passes through whatever a material does to its own highlights downstream, which
// for the tin is the compression that keeps a lamp at arm's length from flattening it into a white
// patch. Everything here is the arithmetic three.js's own RE_Direct_BlinnPhong performs, on a light
// read out of a texture rather than off a uniform.
//
// The facing term is applied only to the share of the light that actually has a direction. Light
// whose directions cancelled — two lamps meeting, or the block a lamp itself stands in — arrived
// from every side and reaches the surface whichever way it is turned. Charging it the facing test
// anyway is what would let installing a lamp make a wall *darker* than the one lamp beside it had
// left it: the room gains light, the recorded direction swings off the wall's normal, and more is
// lost to the cosine than was gained. Where one lamp is doing the lighting the share is the whole
// of it and this is exactly the term it always was.
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

        // Guarded on the material actually being a Blinn-Phong one, since that is what declares the
        // specular terms below. Every lit material in the game is; the guard is here so that the day
        // one of them is not, this fails to compile in nobody's frame rather than in everyone's.
        //
        // A highlight is the one thing that genuinely needs the light to be coming from somewhere,
        // so here the share scales the term rather than sparing it: light arriving from every side
        // glints off nothing.
        #if defined( PHONG )
            reflectedLight.directSpecular += lightBlockMapLit * lightBlockMapDirectionalShare *
                lightBlockMapFacing *
                BRDF_BlinnPhong(lightBlockMapDir, geometryViewDir, normal,
                    material.specularColor, material.specularShininess) *
                material.specularStrength;
        #endif
    #endif
`;
