# Version-6 voxel-grid fixtures

Rooms encoded in **version 6** of the voxel-grid binary format — the last format whose cells were one
world unit wide, and the only one in which a block could fill half or a quarter of its cell layer. From
version 7 on a cell is half as wide, every block is a cube, and a block's shape is no longer a thing.

These are not hand-written. Each `.bin` was produced by the encoder of commit `ffe50850` (the last
commit before the grid's resolution was doubled), run over rooms built with that commit's own code, so
the bytes are what that code actually wrote rather than a re-implementation of the format.

The accompanying `.json` records what the same code made of those bytes when it **read them back**,
which is the state the current code has to carry over into cubes.

| field              | meaning                                                                  |
|--------------------|--------------------------------------------------------------------------|
| `shapes`           | every block's shape, one hex digit each, in block index order (layer fastest, then column, then row, over 32 x 32 cells): one bit per half-cell sub-block it fills (bit = x half + 2 * z half), `0` for no block, `f` for a whole one |
| `numBlocksByShape` | how many blocks of each shape that is                                      |
| `quadsHash`        | FNV-1a over the whole room's quad memory (texture indices), in index order over 32 x 32 cells |
| `restrictedZones`  | the room's zones, each as `[rowMin, rowMax, colMin, colMax]`               |
| `byteLength`       | how long the encoded blob was                                              |

| fixture   | what it is                                                                              |
|-----------|-------------------------------------------------------------------------------------------|
| `shapes`  | an open hall holding every shape: free-standing, on the floor, under the ceiling, as a thin wall, a fence and table legs, each shape beside each other, stacked in opposite corners and against the boundary wall, with the room's floor and ceiling tiles in a pattern, under two zones |
| `regular` | a generated Regular room as a builder leaves it: an eighth of its blocks shrunk, shrunk and whole blocks set down in its open space, faces repainted, under as many zones as a room may carry |
| `hub`     | a generated Hub room, which holds whole blocks only, as every room did until someone shrank one, under two zones |

They are consumed by `tests/integration/scenarios/voxel-grid-migration.test.ts`. Leave them
untouched: their whole value is that nothing in the current tree produced them.
