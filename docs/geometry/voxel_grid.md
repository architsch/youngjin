# Voxel Grid Structure

Reference: @src/shared/voxel/types/voxel.ts , @src/shared/voxel/types/voxelGrid.ts , @src/shared/voxel/util/voxelQueryUtil.ts , @src/shared/system/sharedConstants.ts

## Room Dimensions
- **Grid size**: 32 × 32 voxels (1 unit per voxel in the XZ plane).
- **Room height**: 4 units (8 collision layers × 0.5 units/layer).
- **Max room Y**: 4.0.
- **Collision layers**: 8 layers, indexed 0–7.

## Voxel Quad Encoding
Each voxel cell contains **50 quads** total:
- **48 collision layer quads**: 6 face quads per layer × 8 layers. The 6 faces are: +x, −x, +y, −y, +z, −z.
- **2 floor/ceiling quads**: Encoded separately outside the collision layer structure.

Each quad is encoded as **1 byte**:
- **1 bit**: Visibility flag (visible or hidden).
- **7 bits**: Texture index (0–127).

## Collision Layer System
The 8 collision layers partition the room height into 0.5-unit vertical slices:
- Layer 0: y ∈ [0, 0.5]
- Layer 1: y ∈ [0.5, 1.0]
- ...
- Layer 7: y ∈ [3.5, 4.0]

Each voxel tracks a **collision layer mask** — a bitmask indicating which layers are occupied. This enables:
- Partial-height structures (e.g. a half-wall at layers 0–3).
- Efficient vertical collision checks via bitwise operations.
- Wall-attached object placement validation (checking that all required layers are filled).

## Quad Positioning
Collision layer quads are positioned at:
- **Wall quads** (±x, ±z faces): `offsetY = 0.25 + 0.5 × collisionLayer`
- **Floor/ceiling quads** (±y faces): `offsetY = (orientation == "−" ? 0 : 0.5) + 0.5 × collisionLayer`

Quad scaling:
- Horizontal quads (floors/ceilings): scaled Y dimension = 1.
- Vertical quads (walls): scaled Y dimension = 0.5 (matching the 0.5-unit layer height).

## Block Manipulation
Voxel blocks can be manipulated via 6-directional arrows (world-space gizmos):
- Arrow offset distance: 0.35 units from block center.
- Each direction (+x, −x, +y, −y, +z, −z) maps to specific row, column, and collision layer offsets for adjacent block placement.
