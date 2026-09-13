# Instanced Mesh Composition System

Reference: @src/client/graphics/types/mesh/instancedMeshBinding.ts , @src/client/object/components/instancedMeshGraphics.ts , @src/client/object/components/instancedMeshComposer.ts , @src/client/object/components/helpers/mesh/instancedMeshComposition.ts , @src/shared/graphics/mesh/composition/types/compositionCodec/instancedMeshCompositionCodec.ts , @src/shared/graphics/mesh/composition/types/compositionBuilder/instancedMeshCompositionBuilder.ts

A `GameObject` can render itself as a set of simple parts borrowed from shared instanced meshes. The parts are described by its `InstancedMeshComposition` metadata string. Players, doors and lamps use this system.

![InstancedMeshComposition System Overview](figures/mesh_composition_1.jpg)

## Pieces
- Each `InstancedMesh` is one geometry + material pair (`GeometryConstructorMap`, `MaterialConstructorMap`).
- `InstancedMeshBinding` tracks the instances an object has rented from one mesh. `InstancedMeshGraphics` routes calls to the right binding.
- `InstancedMeshComposer` decodes the metadata into `InstancedMeshCompositionPart[]` through `InstancedMeshComposition`, then rents, transforms and returns instances to match.
- An `InstancedMeshCompositionCodec` (selected by a prefix on the string) encodes and decodes the metadata. It uses `InstancedMeshCompositionBuilder` helpers to place parts.

## Indexed compositions
Metadata is stored and sent once per object, so a spelled-out composition is expensive. `IndexedCompositionCodec` is a **router**: the object stores only an index into `PreEncodedCompositionStringMap`, and the entry at that index (which carries its own codec prefix) is decoded by its own codec.
- The table is generated at build time by `PreEncodedCompositionBuilder` (during SSG) from authored asset data, so a new variant is a data edit rather than new code.
- Fields that cannot be known ahead of time are left indeterminate, and the object fills them in after decoding (e.g. a lamp's face color comes from its light).
- Indexed appearances are read-only, so user-editable appearances cannot use them.

## Hiding instances
All instances of a mesh share one draw call, so a single instance is hidden by **parking it far outside the room**. Returned instances are parked the same way. Another system, such as the orbit occlusion hider, can temporarily hide an instance: `InstancedMeshBinding` buffers the owner's transforms while it is hidden and applies the latest one when it is shown again. Returning a hidden instance clears its hidden state.
