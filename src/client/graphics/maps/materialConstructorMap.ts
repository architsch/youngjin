import * as THREE from "three";
import TextureFactory from "../factories/textureFactory";
import MaterialParams from "../../../shared/graphics/material/types/materialParams";
import WireframeMaterialParams from "../../../shared/graphics/material/types/wireframeMaterialParams";
import InstancedTexturePackMaterialParams from "../../../shared/graphics/material/types/instancedTexturePackMaterialParams";
import LineBasicMaterialParams from "../../../shared/graphics/material/types/lineBasicMaterialParams";
import TextureMaterialParams from "../../../shared/graphics/material/types/textureMaterialParams";
import SpriteMaterialParams from "../../../shared/graphics/material/types/spriteMaterialParams";
import InstancedColorMaterialParams from "../../../shared/graphics/material/types/instancedColorMaterialParams";
import InstancedEyeMaterialParams from "../../../shared/graphics/material/types/instancedEyeMaterialParams";
import InstancedTinMaterialParams from "../../../shared/graphics/material/types/instancedTinMaterialParams";

export const MaterialConstructorMap: { [materialType: string]:
    (params: MaterialParams) => Promise<THREE.Material> } =
{
    "InstancedTexturePack": async (params: MaterialParams) =>
    {
        return await createInstancedTexturePackMaterial(params as InstancedTexturePackMaterialParams);
    },
    "InstancedColor": async (params: MaterialParams) =>
    {
        return createInstancedColorMaterial(params as InstancedColorMaterialParams);
    },
    "InstancedEye": async (params: MaterialParams) =>
    {
        return createInstancedEyeMaterial(params as InstancedEyeMaterialParams);
    },
    "InstancedTin": async (params: MaterialParams) =>
    {
        return createInstancedTinMaterial(params as InstancedTinMaterialParams);
    },
    "Texture": async (params: MaterialParams) =>
    {
        return await createTextureMaterial(params as TextureMaterialParams);
    },
    "Sprite": async (params: MaterialParams) =>
    {
        const p = params as SpriteMaterialParams;
        const texture = TextureFactory.loadCanvasTexture(p.textureId, p.textureWidth, p.textureHeight, p.draw);
        return new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: p.opacity,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide,
        });
    },
    "Wireframe": async (params: MaterialParams) =>
    {
        const p = params as WireframeMaterialParams;
        const newMaterial = new THREE.MeshBasicMaterial({ color: p.colorHex, wireframe: true, depthTest: false });
        return newMaterial;
    },
    "LineBasic": async (params: MaterialParams) =>
    {
        const p = params as LineBasicMaterialParams;
        const newMaterial = new THREE.LineBasicMaterial({ color: p.colorHex, depthTest: false });
        return newMaterial;
    },
}

async function createInstancedTexturePackMaterial(p: InstancedTexturePackMaterialParams): Promise<THREE.Material>
{
    let texture: THREE.Texture;
    switch (p.textureLoadType)
    {
        case "staticImageFromPath":
            texture = await TextureFactory.loadStaticImageTexture(p.texturePath);
            break;
        case "dynamicEmpty":
            texture = TextureFactory.loadDynamicEmptyTexture(p.texturePath, p.textureWidth, p.textureHeight);
            break;
        default:
            throw new Error(`Unknown texture load type :: "${p.textureLoadType}"`);
    }

    const newMaterial = new THREE.MeshPhongMaterial();
    newMaterial.map = texture;
    newMaterial.transparent = false;
    if (p.polygonOffsetFactor && p.polygonOffsetUnits)
    {
        newMaterial.polygonOffset = true;
        newMaterial.polygonOffsetFactor = p.polygonOffsetFactor;
        newMaterial.polygonOffsetUnits = p.polygonOffsetUnits;
    }

    const pixelBleedingPreventionScales = [
        (p.textureGridCellWidth - 1) / p.textureGridCellWidth,
        (p.textureGridCellHeight - 1) / p.textureGridCellHeight,
    ];
    const textureGridCellScales = [
        p.textureGridCellWidth / p.textureWidth,
        p.textureGridCellHeight / p.textureHeight,
    ];
    const uvScales = [
        textureGridCellScales[0] * pixelBleedingPreventionScales[0],
        textureGridCellScales[1] * pixelBleedingPreventionScales[1],
    ];

    newMaterial.onBeforeCompile = (shader) => {
        shader.vertexShader = `
            attribute vec2 uvStart;
            attribute vec2 uvSampleSize;
            ${shader.vertexShader}
        `;
        shader.vertexShader = shader.vertexShader.replace(
            "#include <uv_vertex>",
            `
            #include <uv_vertex>
            vMapUv = uvStart + vec2(
                uvSampleSize[0] * vMapUv[0] * ${uvScales[0].toFixed(7)},
                uvSampleSize[1] * vMapUv[1] * ${uvScales[1].toFixed(7)}
            );
            `
        );
    };
    return newMaterial;
}

function createInstancedColorMaterial(p: InstancedColorMaterialParams): THREE.Material
{
    const newMaterial = new THREE.MeshPhongMaterial();
    newMaterial.transparent = false;
    // Three.js folds the per-instance color (InstancedMesh.setColorAt) into vColor via the stock
    // color_vertex chunk, but its color_fragment chunk only tints diffuseColor when USE_COLOR is
    // defined (i.e. material.vertexColors). Apply the instance color here so it works on this
    // texture-less material without a per-vertex color attribute. The #ifdef makes this a no-op
    // for instanced meshes that never set an instance color.
    newMaterial.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
            "#include <color_fragment>",
            `
            #include <color_fragment>
            #ifdef USE_INSTANCING_COLOR
                diffuseColor.rgb *= vColor;
            #endif
            `
        );
    };
    return newMaterial;
}

// A 3D value-noise field, used by the "InstancedTin" material to scatter rust and wear over a
// surface without any texture. Trilinearly interpolated and smoothstep-faded per cell, so the
// field is continuous across a part's faces; the fbm variant stacks a few octaves to give the
// patches an irregular, corroded outline rather than uniform blobs.
const TIN_NOISE_GLSL = `
    float tinHash(vec3 p)
    {
        p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
        p += dot(p, p.yzx + 19.19);
        return fract((p.x + p.y) * p.z);
    }
    float tinNoise(vec3 p)
    {
        vec3 cell = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
            mix(mix(tinHash(cell + vec3(0.0, 0.0, 0.0)), tinHash(cell + vec3(1.0, 0.0, 0.0)), f.x),
                mix(tinHash(cell + vec3(0.0, 1.0, 0.0)), tinHash(cell + vec3(1.0, 1.0, 0.0)), f.x), f.y),
            mix(mix(tinHash(cell + vec3(0.0, 0.0, 1.0)), tinHash(cell + vec3(1.0, 0.0, 1.0)), f.x),
                mix(tinHash(cell + vec3(0.0, 1.0, 1.0)), tinHash(cell + vec3(1.0, 1.0, 1.0)), f.x), f.y),
            f.z);
    }
    float tinFbm(vec3 p)
    {
        float sum = 0.5 * tinNoise(p);
        sum += 0.25 * tinNoise(p * 2.03);
        sum += 0.125 * tinNoise(p * 4.01);
        return sum / 0.875;
    }
`;

function createInstancedTinMaterial(p: InstancedTinMaterialParams): THREE.Material
{
    // Renders each instance as a piece of an antique tin toy: the per-instance color is treated as
    // aged lithographed paint over sheet metal rather than as a flat fill. Three signals drive the
    // effect — the fragment's distance to the piece's edges, a coarse noise field, and a fine grain.
    // Paint wears off along the edges and corners the toy would have been handled by (exposing bare
    // tin), rust blooms out of those worn spots and out of the coarse field's peaks, and the grain
    // mottles everything so nothing spreads as a clean-edged blob. Because the sheen is what sells
    // the metal, the material keeps a bright, tight Phong specular: bare tin glints, intact paint
    // stays glossy, and rust goes powdery.
    const newMaterial = new THREE.MeshPhongMaterial();
    newMaterial.transparent = false;
    newMaterial.specular = new THREE.Color(0xb4b4a8); // Warm-grey metal sheen (the default is nearly black).
    newMaterial.shininess = 90;

    newMaterial.onBeforeCompile = (shader) => {
        shader.vertexShader = `
            varying vec3 vTinSurfacePos;
            varying vec3 vTinLocalPos;
        `+ shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
            "#include <begin_vertex>",
            `
            #include <begin_vertex>
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
            `
        );

        shader.fragmentShader = `
            varying vec3 vTinSurfacePos;
            varying vec3 vTinLocalPos;
            // The constants below are linear-space equivalents of the sRGB colors they are named
            // after, since the fragment stage works in the renderer's linear working color space.
            const vec3 TIN_RUST_COLOR = vec3(0.147, 0.033, 0.009); // deep orange-brown corrosion
            const vec3 TIN_BARE_COLOR = vec3(0.342, 0.342, 0.319); // unpainted sheet metal
            const vec3 TIN_PATINA_TINT = vec3(0.88, 0.84, 0.72); // the yellowing of aged paint
            const float TIN_MAX_SHEEN = 0.85; // ceiling the specular highlight approaches but never reaches
            ${TIN_NOISE_GLSL}
        `+ shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
            "#include <color_fragment>",
            `
            #include <color_fragment>
            #ifdef USE_INSTANCING_COLOR
                diffuseColor.rgb *= vColor; // See createInstancedColorMaterial for why this is needed.
            #endif

            // Every geometry this material is used with spans [-0.5, 0.5] on each axis, so the
            // middle of the three per-axis distances only approaches the surface where two axes are
            // extreme at once — that is, along the piece's edges and corners.
            vec3 tinAxisDist = abs(vTinLocalPos) * 2.0;
            float tinFarAxis = max(tinAxisDist.x, max(tinAxisDist.y, tinAxisDist.z));
            float tinNearAxis = min(tinAxisDist.x, min(tinAxisDist.y, tinAxisDist.z));
            float tinEdge = smoothstep(0.72, 1.0,
                tinAxisDist.x + tinAxisDist.y + tinAxisDist.z - tinFarAxis - tinNearAxis);

            float tinPatch = tinFbm(vTinSurfacePos);
            float tinGrain = tinNoise(vTinSurfacePos * 5.0);

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
            `
        );
        // Injected after the normal is resolved rather than at <specularmap_fragment> (where
        // 'specularStrength' is declared), because the sheen below is measured against the shading
        // normal. Both points sit ahead of <lights_phong_fragment>, which is where the stock shader
        // finally reads 'specularStrength', so writing to it here still takes effect.
        shader.fragmentShader = shader.fragmentShader.replace(
            "#include <normal_fragment_maps>",
            `
            #include <normal_fragment_maps>
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
            `
        );
        shader.fragmentShader = shader.fragmentShader.replace(
            "#include <lights_fragment_end>",
            `
            #include <lights_fragment_end>
            // Even with the falloff above, a piece caught close to the lamp can still drive its
            // highlight past the display's white point, where it stops reading as a highlight and
            // becomes a flat, shapeless patch. Compress the sheen asymptotically instead, so a hot
            // spot keeps approaching white without ever arriving and the surface underneath stays
            // legible. This is the job a global tone mapper would do, confined to this material's
            // specular term so that nothing else in the scene shifts.
            reflectedLight.directSpecular /= 1.0 + reflectedLight.directSpecular / TIN_MAX_SHEEN;
            `
        );
    };
    return newMaterial;
}

function createInstancedEyeMaterial(p: InstancedEyeMaterialParams): THREE.Material
{
    // Renders each "Square" instance as an eyeball made of two concentric circles: the pupil
    // (which takes rendering priority) and the iris (hidden wherever the pupil covers it).
    // The per-instance colors and squared radii come from instanced buffer attributes written
    // by InstancedMeshBinding. The squared radii are expressed in the square's UV space, where
    // the distance from the center to an edge is 0.5. Fragments outside both circles are
    // discarded, and the surviving fragments write their circle's color into diffuseColor
    // before the stock lighting chunks run, so lighting still obeys the regular
    // MeshPhongMaterial rules.
    const newMaterial = new THREE.MeshPhongMaterial();
    newMaterial.transparent = false;
    newMaterial.side = THREE.DoubleSide; // The eye is an infinitely thin quad, so keep it visible from both sides.
    newMaterial.onBeforeCompile = (shader) => {
        shader.vertexShader = `
            attribute vec3 pupilColor;
            attribute vec3 irisColor;
            attribute vec2 eyeRadiiSqr;
            varying vec3 vPupilColor;
            varying vec3 vIrisColor;
            varying vec2 vEyeRadiiSqr;
            varying vec2 vEyeUv;
            ${shader.vertexShader}
        `;
        shader.vertexShader = shader.vertexShader.replace(
            "#include <begin_vertex>",
            `
            #include <begin_vertex>
            vPupilColor = pupilColor;
            vIrisColor = irisColor;
            vEyeRadiiSqr = eyeRadiiSqr;
            vEyeUv = uv;
            `
        );
        shader.fragmentShader = `
            varying vec3 vPupilColor;
            varying vec3 vIrisColor;
            varying vec2 vEyeRadiiSqr;
            varying vec2 vEyeUv;
            ${shader.fragmentShader}
        `;
        shader.fragmentShader = shader.fragmentShader.replace(
            "#include <color_fragment>",
            `
            #include <color_fragment>
            vec2 offsetFromEyeCenter = vEyeUv - vec2(0.5, 0.5);
            float eyeDistSqr = dot(offsetFromEyeCenter, offsetFromEyeCenter);
            if (eyeDistSqr < vEyeRadiiSqr[0])
                diffuseColor.rgb = vPupilColor;
            else if (eyeDistSqr < vEyeRadiiSqr[1])
                diffuseColor.rgb = vIrisColor;
            else
                discard;
            `
        );
    };
    return newMaterial;
}

async function createTextureMaterial(p: TextureMaterialParams): Promise<THREE.Material>
{
    const texture: THREE.Texture = await TextureFactory.loadStaticImageTexture(p.texturePath);

    const newMaterial = new THREE.MeshPhongMaterial();
    newMaterial.map = texture;
    newMaterial.transparent = true;
    newMaterial.alphaTest = 0.5;
    if (p.polygonOffsetFactor && p.polygonOffsetUnits)
    {
        newMaterial.polygonOffset = true;
        newMaterial.polygonOffsetFactor = p.polygonOffsetFactor;
        newMaterial.polygonOffsetUnits = p.polygonOffsetUnits;
    }
    return newMaterial;
}