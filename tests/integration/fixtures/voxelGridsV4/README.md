# Version-4 voxel-grid fixtures

Rooms encoded in **version 4** of the voxel-grid binary format — the last format in which a quad
stored, in its high bit, whether it was drawn. From version 5 on that bit is unused and a quad is
drawn where the room's blocks say so.

These are not hand-written. Each `.bin` was produced by the encoder at commit `7cd28d3f`, which wrote
version 4, so what they hold is what that code actually wrote rather than a re-implementation of the
old format.

Version 4 is laid out byte for byte as version 5 is, so a reader that ignored the difference would
still decode these — and would only show up as a room whose faces came back subtly different from the
ones that were written. That is what these fixtures are for.

The accompanying `.json` records what the same code made of those bytes when it **read them back**,
which is the state the current code has to reproduce.

| field                        | meaning                                                                  |
|------------------------------|--------------------------------------------------------------------------|
| `masks`                      | every voxel's `collisionLayerMask`, in row-major order                     |
| `quadsHash`                  | FNV-1a over the whole room's quad memory (drawn bit + texture index), in index order |
| `quadsHashWithoutOuterShell` | the same, with the drawn bit cleared on every block face that looks out of the grid |
| `numVisibleQuads`            | how many quads of the whole room were drawn                                |
| `numVisibleOuterShellQuads`  | how many of those look out of the grid                                     |
| `restrictedZones`            | the room's zones, each as `[rowMin, rowMax, colMin, colMax]`               |
| `byteLength`                 | how long the encoded blob was                                              |

| fixture   | what it is                                                                              |
|-----------|-------------------------------------------------------------------------------------------|
| `hub`     | a generated Hub room, i.e. what the live hubs are, under two zones                         |
| `regular` | a generated Regular room, which is mostly solid mass for its owner to mine out             |
| `mixed`   | block work at assorted heights with faces repainted here and there, under as many zones as a room may carry |
| `shell`   | a room generated and encoded by commit `e0e55bb5` (2026-08-13), before the outer shell stopped being drawn, then loaded and encoded again by `7cd28d3f`, as the server does to a room it loads: its outer shell is still stored as drawn |

They are consumed by `tests/integration/scenarios/voxel-grid-migration.test.ts`. Leave them
untouched: their whole value is that nothing in the current tree produced them.
