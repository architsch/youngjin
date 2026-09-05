# Version-3 voxel-grid fixtures

Rooms encoded in **version 3** of the voxel-grid binary format — the format in use before a room
carried its restricted zones alongside its voxels.

These are not hand-written. Each `.bin` was produced by the shipped encoder at commit `c4397b14`,
the last commit before the format version was raised, so what they hold is what that code actually
wrote rather than a re-implementation of the old format.

Version 3 is a version the current format still reads byte for byte: the zones were appended after
the voxels, so nothing in front of them moved. That is exactly why these fixtures are worth keeping
— a change that quietly disturbed the voxel bytes would still decode, and would only show up as a
room that came back subtly different from the one that was written.

The accompanying `.json` records what the same code made of those bytes when it **read them back**,
which is the state the current code has to reproduce.

| field             | meaning                                                              |
|-------------------|----------------------------------------------------------------------|
| `masks`           | every voxel's `collisionLayerMask`, in row-major order                 |
| `quadsHash`       | FNV-1a over the whole room's quad memory, in index order              |
| `numVisibleQuads` | how many quads of the whole room were drawn                            |
| `byteLength`      | how long the encoded blob was                                          |

| fixture     | what it is                                                                          |
|-------------|--------------------------------------------------------------------------------------|
| `solid`     | the base grid every room is carved out of: solid from floor to ceiling, nothing drawn  |
| `hub`       | a generated Hub room, i.e. what the live hubs are                                      |
| `regular`   | a generated Regular room, which is mostly solid mass for its owner to mine out          |
| `mixed`     | block work at assorted heights, so occupancy is scattered rather than following generation's own shapes |

They are consumed by `tests/integration/scenarios/voxel-grid-migration.test.ts`. Leave them
untouched: their whole value is that nothing in the current tree produced them.
