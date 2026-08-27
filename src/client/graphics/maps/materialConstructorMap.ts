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
import InstancedWoodMaterialParams from "../../../shared/graphics/material/types/instancedWoodMaterialParams";
import VALUE_NOISE_GLSL from "../shaders/valueNoiseGLSL";

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
    "InstancedWood": async (params: MaterialParams) =>
    {
        return createInstancedWoodMaterial(params as InstancedWoodMaterialParams);
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
            varying vec3 vTinPartSize;
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
            // once it is interpolated across a face. The size goes with it so that measure can be
            // taken in world units rather than as a fraction of the part.
            vTinLocalPos = position;
            vTinPartSize = tinPartScale;
            `
        );

        shader.fragmentShader = `
            varying vec3 vTinSurfacePos;
            varying vec3 vTinLocalPos;
            varying vec3 vTinPartSize;
            // The constants below are linear-space equivalents of the sRGB colors they are named
            // after, since the fragment stage works in the renderer's linear working color space.
            const vec3 TIN_RUST_COLOR = vec3(0.147, 0.033, 0.009); // deep orange-brown corrosion
            const vec3 TIN_BARE_COLOR = vec3(0.342, 0.342, 0.319); // unpainted sheet metal
            const vec3 TIN_PATINA_TINT = vec3(0.88, 0.84, 0.72); // the yellowing of aged paint
            const float TIN_MAX_SHEEN = 0.85; // ceiling the specular highlight approaches but never reaches
            // How far in from an edge the paint has been handled off, in world units. A physical
            // width rather than a fraction of the part, so that a small piece is not worn to the
            // same proportion of itself as a large one — the hand that wore it was the same size
            // either way. Capped against the part's own thickness all the same, since a band wider
            // than the piece it runs along would leave nothing unworn.
            const float TIN_WEAR_WIDTH = 0.024;
            const float TIN_MAX_WEAR_FRACTION = 0.3;
            ${VALUE_NOISE_GLSL}
        `+ shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
            "#include <color_fragment>",
            `
            #include <color_fragment>
            #ifdef USE_INSTANCING_COLOR
                diffuseColor.rgb *= vColor; // See createInstancedColorMaterial for why this is needed.
            #endif

            // Every geometry this material is used with spans [-0.5, 0.5] on each axis, so scaling
            // by the part's size gives the world distance from the fragment to each pair of faces.
            // The middle of those three only becomes small where two of them are small at once —
            // that is, along the piece's edges and corners.
            vec3 tinFaceDist = (0.5 - abs(vTinLocalPos)) * vTinPartSize;
            float tinFarFace = max(tinFaceDist.x, max(tinFaceDist.y, tinFaceDist.z));
            float tinNearFace = min(tinFaceDist.x, min(tinFaceDist.y, tinFaceDist.z));
            float tinWearWidth = min(TIN_WEAR_WIDTH, TIN_MAX_WEAR_FRACTION * 0.5
                * min(vTinPartSize.x, min(vTinPartSize.y, vTinPartSize.z)));
            float tinEdge = 1.0 - smoothstep(0.0, tinWearWidth,
                tinFaceDist.x + tinFaceDist.y + tinFaceDist.z - tinFarFace - tinNearFace);

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

function createInstancedWoodMaterial(p: InstancedWoodMaterialParams): THREE.Material
{
    // Renders each instance as a piece of moulded joinery: a panel of aged timber with a moulding
    // carved around its border, out of which whole objects are composed by laying smaller panels
    // over larger ones (see DoorCompositionCodec). Nothing here comes from an image.
    //
    // Three things make that work.
    //
    // The moulding is measured in world units rather than in the quad's own coordinates, so a band
    // stays the same width whether it frames a door slab or a doorknob — a moulding that stretched
    // with its panel would read as a different profile on every part. The instance's world extent
    // is recovered from its transform for this, the same way the tin material recovers its scale.
    //
    // The timber's figure is likewise sampled in world space, along the axes of the quad it is
    // drawn on rather than within the quad. Nothing about it refers to the part's size, so the
    // grain is as fine on a knob as on the slab behind it; and because neighbouring parts of one
    // object sample the same field, the figure runs on through all of them, as if the object had
    // been cut out of a single board.
    //
    // Finally, what makes a moulding visible is its relief and not its color. The band's profile
    // is shaded as if a raking light fell across the object — one flank of a bead lit, the other in
    // shadow, and a sunk region holding its own shadow throughout — and that shading is what tells
    // a carved panel from the field around it. (The scene's only lamp rides the camera, so tilting
    // the shading normal alone would darken both flanks of a bead symmetrically, which reads as a
    // line drawn on a flat surface rather than as something cut into one.) The shading normal is
    // tilted along the profile as well, but only lightly, and for the sake of the specular: it is
    // what gives a moulding a highlight that travels along it as the viewer moves.
    //
    // The per-instance inputs are the surface color (the instance color), the moulding's own color,
    // and the band's width and whether its profile stands proud of the surface or is sunk into it.
    const newMaterial = new THREE.MeshPhongMaterial();
    newMaterial.transparent = false;
    newMaterial.specular = new THREE.Color(0x2e2a24); // Satin wax: present, but far short of the tin's glint.
    newMaterial.shininess = 14;
    // A door hangs flush against the wall it is mounted on, which is close enough to z-fight with.
    newMaterial.polygonOffset = true;
    newMaterial.polygonOffsetFactor = -1;
    newMaterial.polygonOffsetUnits = -1;

    newMaterial.onBeforeCompile = (shader) => {
        shader.vertexShader = `
            attribute vec3 mouldingColor;
            attribute vec2 mouldingParams; // (band width in world units, +1 = proud / -1 = sunk)
            // The direction the mouldings are shaded as though lit from — down and across the
            // object's face, the angle a carving is easiest to read at. Fixed in world space, so
            // that walking around a room does not roll the light over the carving with the viewer.
            const vec3 WOOD_RAKING_LIGHT = vec3(-0.3578, 0.8944, 0.2683);
            // Packed rather than kept apart, to spend as few varying slots as possible:
            // (position within the quad .xy, the quad's world extent .zw), then
            // (moulding color .rgb, band width signed by the profile's direction .a), then
            // (where the fragment sits on the board .xy, the raking light on the quad's axes .zw).
            varying vec4 vWoodQuad;
            varying vec4 vWoodMoulding;
            varying vec4 vWoodBoardRake;
            // The quad's own axes in view space, so the fragment stage can tilt the shading normal
            // toward whichever edge it belongs to. They cannot be recovered from the interpolated
            // normal alone, which says only which way the quad faces and nothing about how it is
            // turned within its own plane.
            varying vec3 vWoodTangentX;
            varying vec3 vWoodTangentY;
        `+ shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
            "#include <begin_vertex>",
            `
            #include <begin_vertex>
            // Resolved against the world rather than the camera, because everything derived below
            // has to stay put on the surface while the viewer moves around it.
            #ifdef USE_INSTANCING
                mat3 woodBasis = mat3(modelMatrix) * mat3(instanceMatrix);
                vec3 woodWorldPos = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
            #else
                mat3 woodBasis = mat3(modelMatrix);
                vec3 woodWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
            #endif
            // The board's own axes: the grain runs along the quad's vertical, and the growth rings
            // are counted across its horizontal.
            vec3 woodAcross = normalize(woodBasis[0]);
            vec3 woodAlong = normalize(woodBasis[1]);

            vWoodQuad = vec4(position.xy, length(woodBasis[0]), length(woodBasis[1]));
            vWoodMoulding = vec4(mouldingColor,
                max(mouldingParams.x, 0.0001) * (mouldingParams.y < 0.0 ? -1.0 : 1.0));
            // World position resolved onto those two axes. This is what makes the figure independent
            // of the part's size and continuous from one part to the next: two quads lying in the
            // same plane get the same coordinates wherever they overlap, however differently they
            // are scaled.
            vWoodBoardRake = vec4(
                dot(woodWorldPos, woodAcross), dot(woodWorldPos, woodAlong),
                dot(WOOD_RAKING_LIGHT, woodAcross), dot(WOOD_RAKING_LIGHT, woodAlong));
            vWoodTangentX = mat3(viewMatrix) * woodAcross;
            vWoodTangentY = mat3(viewMatrix) * woodAlong;
            `
        );

        shader.fragmentShader = `
            varying vec4 vWoodQuad;
            varying vec4 vWoodMoulding;
            varying vec4 vWoodBoardRake;
            varying vec3 vWoodTangentX;
            varying vec3 vWoodTangentY;
            const float WOOD_PI = 3.14159265;

            // ── How fine the timber is ───────────────────────────────────────────────────────────
            // Growth rings per world unit, measured across the grain: the one number to turn to
            // change the scale of the whole surface pattern, since everything below — how far the
            // figure sweeps, how wide a season's dark band runs, how big a knot grows — is measured
            // in ring-widths and follows from it. Larger is finer.
            const float WOOD_GRAIN_SCALE = 46.0;
            // How far the grain's figure may darken or lighten the timber, and how much of the
            // color's original saturation an aged finish leaves behind. The colors reaching this
            // material come from a general-purpose palette and are far more vivid than anything a
            // door was ever finished in; left flat and unbroken they read as moulded plastic. (The
            // tin material ages its own colors for the same reason.)
            const float WOOD_FIGURE_CONTRAST = 0.40;
            const vec3 WOOD_PATINA_TINT = vec3(0.94, 0.86, 0.72);
            const float WOOD_SATURATION = 0.42;

            // ── How the figure runs ──────────────────────────────────────────────────────────────
            // Growth rings are circles laid down about the trunk's pith, and a sawn board is a plane
            // cutting through them: what its face shows is entirely a matter of how that plane ran
            // through the log. The same result is had far more cheaply by bending the coordinate the
            // rings are counted along, and two fields do the bending.
            //
            // The arch field is the one that matters. It is deliberately steep enough that the ring
            // coordinate folds back on itself in places, and a folded coordinate is what turns a
            // stripe into a closed loop — the nested arches ("cathedrals") a flatsawn board shows
            // where the saw ran near the pith. Sampling it several times more slowly along the grain
            // than across it is what draws those loops out into pointed arches instead of blobs, and
            // its steepness elsewhere is what keeps the rings from ever running evenly spaced.
            //
            // The sweep field is far broader and never folds. It leans and bows the whole figure, so
            // that no board runs square to its own edges, and doubles as the slow tonal banding a
            // board carries. The wander field is a fine irregularity on top of both.
            const float WOOD_ARCH_FREQ = 0.055;
            const float WOOD_ARCH_ALONG = 0.30; // how much more slowly the arch field runs along the grain
            const float WOOD_ARCH_AMOUNT = 15.0;
            const float WOOD_SWEEP_FREQ = 0.013;
            const float WOOD_SWEEP_AMOUNT = 11.0;
            const float WOOD_WANDER_AMOUNT = 3.0;
            // A season's growth closes in a thin dark band of dense latewood, and that band is what
            // the eye actually reads a ring by. How wide it runs and how dark it comes out are drawn
            // from each ring on its own, which is what keeps a stack of them from reading as a ruled
            // grating, and the width is thinned and swelled along the ring's own length besides — a
            // grain line of one thickness end to end is a drawn one. The band is never allowed to
            // reach half a ring across, so one ring's can never run into the next's; the mean is
            // what the figure is measured against, so the rings darken and the board does not.
            const float WOOD_LATEWOOD_MIN = 0.10;
            const float WOOD_LATEWOOD_MAX = 0.36;
            const float WOOD_LATEWOOD_LIMIT = 0.45;
            const float WOOD_LATEWOOD_MEAN = 0.15;

            // ── Knots ────────────────────────────────────────────────────────────────────────────
            // Where a branch left the trunk. Sparse on purpose: a knot is an event on a board rather
            // than a pattern across it, and a face covered in them stops reading as joinery. Most of
            // the cells one could fall in carry none at all.
            const float WOOD_KNOT_SPACING = 50.0;
            const float WOOD_KNOT_DENSITY = 0.50;
            // A branch is cut through at an angle, so a knot shows on the face as an ellipse drawn
            // out along the grain rather than as a circle — and a ragged one, since neither the
            // branch nor the rings inside it were ever truly round. Without that raggedness a knot
            // comes out as an archery target sitting on the timber rather than as part of it.
            const float WOOD_KNOT_ELONGATION = 2.2;
            const float WOOD_KNOT_WOBBLE = 0.34;
            // How far the grain is pushed aside as it grows past the branch and closes up again
            // beyond it, how many rings the branch shows of its own, and how much darker its denser
            // timber is.
            const float WOOD_KNOT_FLOW = 2.6;
            const float WOOD_KNOT_RINGS = 2.2;
            // How narrow each of those rings is drawn. A raised cosine spends half its period above
            // half height, which lays the knot's rings down as bands as broad as the gaps between
            // them; raising it to a power pulls each one in toward a line without putting a corner
            // anywhere in the profile for the edges to catch on.
            const float WOOD_KNOT_RING_SHARPNESS = 3.5;
            // How much darker the branch's own denser timber is: the number to turn if the knots
            // read too heavily or too faintly, 1.0 being no darker than the board around them.
            const float WOOD_KNOT_SHADE = 0.66;

            // ── How deep the mouldings are cut ───────────────────────────────────────────────────
            // How far the moulding rises out of (or sinks into) the surface, as a fraction of the
            // band's own width. Expressing it that way is what keeps the profile's steepness — and
            // so its shading — identical on a wide frame and on a narrow one.
            const float WOOD_RELIEF = 0.42;
            // How hard the raking light falls across the profile's flanks, and how much shadow a
            // sunk region holds on top of that. Between them these are the whole of what
            // distinguishes a moulding from the field it is cut out of.
            const float WOOD_CARVE_CONTRAST = 0.30;
            const float WOOD_CAVITY_CONTRAST = 0.14;
            // The darkest a moulding's own shading may leave the timber. The scene is lit by a
            // single lamp on a low ambient, so a flank turned away from the raking light is already
            // in shadow before this shading is applied at all; without a floor the two compound
            // into a black outline, which is the drawn-on line the relief exists to avoid.
            const float WOOD_MIN_CARVE_SHADE = 0.55;
            // How much of the profile's slope the shading normal is allowed to take on. The normal
            // is tilted only so that a moulding catches a highlight that travels along it as the
            // viewer moves; the shading itself is the baked term above. Tilting it by the full slope
            // would turn a bead's far flank nearly edge-on to the lamp and darken it a second time,
            // on top of the shading that already accounts for it.
            const float WOOD_SPECULAR_TILT = 0.35;

            ${VALUE_NOISE_GLSL}
            // Turns a color picked off that palette into a finish timber could plausibly carry.
            vec3 woodAge(vec3 color)
            {
                vec3 aged = color * WOOD_PATINA_TINT;
                return mix(vec3(dot(aged, vec3(0.2126, 0.7152, 0.0722))), aged, WOOD_SATURATION);
            }
            // Where a fragment sits within the moulding: 0 hard against the nearest edge, 1 at the
            // band's inner boundary and beyond. Taking the nearer of the two axes is also what
            // mitres the corners, since the two bands meet along the diagonal where their distances
            // are equal.
            float woodBandCoord(vec2 edgeDist, float bandWidth)
            {
                return clamp(min(edgeDist.x, edgeDist.y) / bandWidth, 0.0, 1.0);
            }
        `+ shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
            "#include <color_fragment>",
            `
            #include <color_fragment>
            #ifdef USE_INSTANCING_COLOR
                diffuseColor.rgb *= vColor; // See createInstancedColorMaterial for why this is needed.
            #endif

            vec2 woodEdgeDist = (0.5 - abs(vWoodQuad.xy)) * vWoodQuad.zw;
            float woodBandWidth = abs(vWoodMoulding.a);
            float woodBand = woodBandCoord(woodEdgeDist, woodBandWidth);
            float woodProfileSign = (vWoodMoulding.a < 0.0) ? -1.0 : 1.0;
            // The moulding's profile across the band, and the slope of it. Both are level where the
            // band meets the surface on either side, so a part is flush with its neighbours and only
            // the band itself stands out of (or is sunk into) the face.
            float woodHeight = WOOD_RELIEF * 0.5
                * (1.0 - cos(2.0 * WOOD_PI * woodBand)) * woodProfileSign;
            float woodSlope = WOOD_RELIEF * WOOD_PI
                * sin(2.0 * WOOD_PI * woodBand) * woodProfileSign;
            // Which edge this fragment belongs to, and so which way the profile runs. Only one axis
            // is ever in play — the same nearer-of-the-two that mitres the corners.
            vec2 woodOutward = (woodEdgeDist.x < woodEdgeDist.y)
                ? vec2(vWoodQuad.x < 0.0 ? -1.0 : 1.0, 0.0)
                : vec2(0.0, vWoodQuad.y < 0.0 ? -1.0 : 1.0);

            // Where this fragment sits on the board, counted in ring-widths.
            vec2 woodBoard = vWoodBoardRake.xy * WOOD_GRAIN_SCALE;

            // The knots come first, because the grain has to be sampled where the branch pushed it
            // to rather than where the fragment is: a knot the rings run straight through is a stain,
            // not a knot. Their displacement is accumulated rather than applied as it is found, so
            // that two knots close enough to overlap deflect the grain by the same amount whichever
            // order the cells happen to be visited in.
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
                    // Pushed outward, strongest at the rim and falling away as the square of the
                    // distance — which is how the rings crowd around a branch and close up again a
                    // little way past it. Drawn out along the grain, because that is the direction
                    // the fibres had to part in, so what the deflection leaves is the long teardrop
                    // above and below a knot rather than a bulge all round it.
                    woodKnotPush += (toKnot / knotDist) * vec2(1.0, WOOD_KNOT_ELONGATION)
                        * knotRadius * WOOD_KNOT_FLOW
                        * knotRadius * knotRadius / (knotDist * knotDist + knotRadius * knotRadius);
                    // Measured on an ellipse whose own radius wanders with the bearing, which is
                    // what keeps both the knot's outline and its rings off true.
                    vec2 knotRel = toKnot * vec2(1.0, 1.0 / WOOD_KNOT_ELONGATION);
                    float knotBearing = atan(knotRel.y, knotRel.x);
                    float knotWobble = 1.0 + WOOD_KNOT_WOBBLE * (2.0 * valueNoise(vec3(
                        1.7 * cos(knotBearing), 1.7 * sin(knotBearing), cell.x + cell.y)) - 1.0);
                    float knotEllipse = length(knotRel) / (knotRadius * knotWobble);
                    float knotCore = 1.0 - smoothstep(0.45, 1.0, knotEllipse);
                    woodKnotCore = max(woodKnotCore, knotCore);
                    // The branch has growth rings of its own, tighter than the trunk's and centered
                    // on itself, and as crooked as everything else about it.
                    woodKnotRing = max(woodKnotRing, knotCore * pow(0.5 - 0.5 * cos(
                        2.0 * WOOD_PI * WOOD_KNOT_RINGS * knotEllipse
                        + 4.0 * valueNoise(vec3(knotRel * 0.3, 5.0))),
                        WOOD_KNOT_RING_SHARPNESS));
                }
            }
            vec2 woodGrain = woodBoard + woodKnotPush;

            // The coordinate the rings are counted along, bent by the two fields described above.
            float woodArch = valueNoise(vec3(woodGrain.x * WOOD_ARCH_FREQ,
                woodGrain.y * WOOD_ARCH_FREQ * WOOD_ARCH_ALONG, 0.0));
            float woodSweep = valueNoiseFbm(vec3(woodGrain.x * WOOD_SWEEP_FREQ,
                woodGrain.y * WOOD_SWEEP_FREQ * 0.35, 4.0));
            float woodWander = valueNoiseFbm(vec3(woodGrain.x * 0.10, woodGrain.y * 0.022, 8.0));
            float woodRingCoord = woodGrain.x
                + WOOD_ARCH_AMOUNT * (woodArch - 0.5)
                + WOOD_SWEEP_AMOUNT * (woodSweep - 0.5)
                + WOOD_WANDER_AMOUNT * (woodWander - 0.5);

            // The dark band closing each ring. Its width and its depth are drawn from the ring's own
            // index, so consecutive rings differ in both; the band is centered on the boundary and
            // can never reach half a ring across, so one ring's band never runs into the next's.
            float woodRingIndex = floor(woodRingCoord + 0.5);
            float woodLatewood = min(WOOD_LATEWOOD_LIMIT,
                mix(WOOD_LATEWOOD_MIN, WOOD_LATEWOOD_MAX,
                    valueNoiseHash(vec3(woodRingIndex, 0.0, 0.0)))
                * (0.55 + 0.85 * valueNoise(vec3(woodRingIndex * 0.7, woodGrain.y * 0.03, 21.0))));
            float woodRing = (1.0 - smoothstep(0.0, woodLatewood, abs(woodRingCoord - woodRingIndex)))
                * mix(0.35, 1.0, valueNoiseHash(vec3(woodRingIndex, 3.0, 0.0)))
                // The trunk's rings stop at a branch rather than running through it, and the branch
                // shows its own instead. Letting both be drawn over the same fragments does not
                // merely double the pattern: the deflection crowds the trunk's rings hardest exactly
                // where the knot is darkest, so the two darkenings multiply and the knot comes out
                // near black however light its own shade is set.
                * (1.0 - 0.85 * woodKnotCore);
            // Rings this fine still alias into a shimmering moiré once a pixel spans an appreciable
            // fraction of one, so their contrast is faded out as that point is approached and the
            // timber settles to its average tone at a distance instead. Where the figure folds into
            // an arch the coordinate barely changes across the screen, so the arches stay crisp at
            // the distances the straight grain between them has already given up.
            float woodRingFade = 1.0 - smoothstep(0.25, 0.85, fwidth(woodRingCoord));
            float woodFleck = valueNoise(vec3(woodGrain * vec2(0.6, 0.25), 7.0));
            // The broad tonal banding a board carries, sampled against the ring coordinate rather
            // than against the board: the timber laid down over a run of good years is lighter than
            // what lies either side of it, and the boundary between them follows the figure, because
            // that is the order it grew in. Banding that ignored the figure and ran straight up the
            // board would read as a stain on the finish instead.
            float woodTone = valueNoise(vec3(woodRingCoord * 0.10, woodGrain.y * 0.005, 12.0));
            float woodFigure =
                (1.0 - WOOD_FIGURE_CONTRAST * (woodRing - WOOD_LATEWOOD_MEAN) * woodRingFade)
                * (0.84 + 0.32 * woodTone) * (0.94 + 0.12 * woodFleck)
                // The branch's timber is darker than the trunk's throughout, and darker again along
                // its own rings. Graded rather than stamped on, so a knot fades into the board at
                // its edge instead of ending at one.
                * mix(1.0, WOOD_KNOT_SHADE, woodKnotCore * mix(0.35, 1.0, woodKnotRing));

            // The carving, which is what a moulding is actually seen by. The raking light lights the
            // flank turned toward it and shades the one turned away, so a bead reads as standing
            // proud and a groove as cut in; the cavity term is the shadow a sunk region holds
            // throughout, which is what keeps the two apart when a flank happens to face edge-on to
            // the light.
            float woodCarve = WOOD_CARVE_CONTRAST * woodSlope * dot(woodOutward, vWoodBoardRake.zw)
                + WOOD_CAVITY_CONTRAST * woodHeight;

            // The moulding is milled out of the same board, so it carries the same grain, and its
            // color is blended in over the width of the band rather than at a boundary — a hard
            // edge between two colors is exactly the drawn-on line the relief above exists to avoid.
            vec3 woodTimber = mix(woodAge(diffuseColor.rgb), woodAge(vWoodMoulding.rgb),
                1.0 - smoothstep(0.55, 1.0, woodBand));
            diffuseColor.rgb = woodTimber * woodFigure
                * max(1.0 + woodCarve, WOOD_MIN_CARVE_SHADE);
            `
        );
        // Injected after the normal is resolved, for the same reason the tin material injects there:
        // this is the last point ahead of <lights_phong_fragment>, which is what finally reads the
        // normal being modified here.
        shader.fragmentShader = shader.fragmentShader.replace(
            "#include <normal_fragment_maps>",
            `
            #include <normal_fragment_maps>
            // Tilting the flat normal by the profile's gradient costs the geometry nothing and gives
            // the moulding a highlight that travels along it as the viewer moves — which the baked
            // shading above, being fixed to the object, cannot do on its own.
            normal = normalize(normal + WOOD_SPECULAR_TILT * woodSlope *
                (woodOutward.x * vWoodTangentX + woodOutward.y * vWoodTangentY));

            // The scene's lamp rides the camera, which pins every surface turned toward the viewer
            // at the peak of the specular lobe at once (see createInstancedTinMaterial for why).
            // On waxed timber that flares whole panels flat white, so the sheen is pulled back
            // toward the grazing angles where a satin finish actually shows one. The mouldings keep
            // theirs regardless, their tilted normals having taken them off the head-on case, and
            // the pore fleck breaks it up so that nothing shines as an unbroken sheet.
            specularStrength *= (0.70 + 0.30 * woodFleck)
                * mix(0.12, 1.0, 1.0 - saturate(dot(normal, normalize(vViewPosition))));
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