# Legacy voxel-grid fixtures

Rooms encoded in **version 1** of the voxel-grid binary format — the format in use while a room
stood eight collision layers tall and was closed off overhead by a flat ceiling tile.

These are not hand-written. Each `.bin` was produced by checking the repository out at commit
`d826a1f4` (the last commit before the room's height was doubled) into a git worktree and running
that code's own encoder over a generated room, so what they hold is what the shipped code actually
wrote — not a re-implementation of it.

The accompanying `.json` records what that same code made of those bytes when it **read them back**,
which is the state the current code has to reproduce. That is deliberately not the room as it stood
in memory before it was written: an unoccupied layer's quads are never persisted, so whatever they
happened to hold is dropped by the encoder and comes back zeroed. Describing the pre-encode room
would hold the new decoder to a state the old decoder never produced either.

| field            | meaning                                                                    |
|------------------|----------------------------------------------------------------------------|
| `masks`          | every voxel's `collisionLayerMask`, in row-major order                       |
| `ceilingQuads`   | every voxel's ceiling quad byte (visibility bit + texture index)             |
| `floorQuads`     | every voxel's floor quad byte                                               |
| `numVisibleQuads`| how many quads of the whole room were drawn                                  |
| `layerQuadsHash` | FNV-1a over all six faces of all eight layers of all voxels, in that order   |

| fixture              | what it is                                                            |
|----------------------|-----------------------------------------------------------------------|
| `bare`               | the bare shell a multiplayer room used to be: floor, ceiling, boundary wall, entrance |
| `procedural_*`       | fully generated multiplayer rooms, i.e. what the live rooms are        |
| `mixed`              | block work of assorted heights, including columns that reach the old ceiling and columns that stop short of it |

They are consumed by `tests/integration/scenarios/voxel-grid-migration.test.ts`. Leave them
untouched: their whole value is that nothing in the current tree produced them.
