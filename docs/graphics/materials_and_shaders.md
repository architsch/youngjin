# Materials and Shaders

Reference: @src/client/graphics/maps/materialConstructorMap.ts , @src/client/graphics/factories/materialFactory.ts , @src/client/graphics/shaders/ , @src/client/graphics/util/valueNoiseTextureUtil.ts , @src/client/graphics/util/shaderPrecompileUtil.ts

Almost nothing is textured. Surfaces such as the moulded timber of doors and canvas frames and the aged tin of players are procedural shader code.

## Structure
- Each surface has its own module under `src/client/graphics/shaders` containing its GLSL and the splices into three.js shader chunks. `MaterialConstructorMap` only pairs a material type with a `THREE.Material` and a shader.
- The map also decides, by wrapping, whether a material receives the **lamp light field** (not lamps' own faces) and whether it gets the **room's fog** (not gizmos).
- Surfaces **extend stock three.js materials** rather than replacing them, so lighting, fog, tone mapping and color conversion stay consistent. This matters where effects must match, such as wall fog and sky fog. All splices are inlined into one `main()`, so earlier declarations stay in scope for later splices.
- three.js's program cache cannot see splices, so **every cached material gets its own cache key** (its material factory id). Without that, different surfaces would share one shader.

## Shared noise
Wood grain, tin corrosion, clouds, ground and smoke all read **one value-noise field**, baked once at load into a repeating 3D texture by `ValueNoiseTextureUtil`. Its channels hold independent fields, so one fetch can return a vector. This is much cheaper than computing noise per fragment on mobile. Octaves use non-commensurate ratios, so the tiling does not show.

## Precompiling
Shader compilation stalls the first frame that uses a material, so `GraphicsManager` compiles during the loading screen in two passes:
1. the loaded scene;
2. a warm-up scene (`ShaderPrecompileUtil`) with stand-in meshes for every material that could appear later, compiled against the real scene so the programs match.

Shaders cannot ship precompiled. WebGL has no program-binary API, and the final source depends on runtime state (light count, fog, instancing). Browsers do cache compiled programs by source text, so the GLSL is assembled deterministically from constants to keep repeat visits fast.
