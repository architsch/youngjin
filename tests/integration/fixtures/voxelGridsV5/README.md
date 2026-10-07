# Version-5 voxel-grid fixtures

Rooms encoded in **version 5** of the voxel-grid binary format — the last format in which every block
was a whole one. From version 6 on, the bit of a quad's byte that version 5 left unused says how its
block has been shrunk.

These are not hand-written. Each `.bin` was produced by the encoder of the working tree as it stood on
2026-10-06: the version-5 work on top of commit `7cd28d3f`, before anything of version 6 was written.
That state was never a commit of its own, so there is none to name here. What matters is that the bytes
are what that code actually wrote rather than a re-implementation of the format.

Version 5 is laid out byte for byte as version 6 is, and a version-5 room holds only whole blocks, which
version 6 writes the same way. So a version-6 save of one of these rooms must differ from its fixture in
the version byte alone, and a reader that mistook the unused bit for anything would show up as a room
whose blocks came back shrunk or missing. That is what these fixtures are for.

The accompanying `.json` records what the same code made of those bytes when it **read them back**,
which is the state the current code has to reproduce.

| field             | meaning                                                                  |
|-------------------|--------------------------------------------------------------------------|
| `masks`           | every voxel's `collisionLayerMask` (the layers holding a block), in row-major order |
| `quadsHash`       | FNV-1a over the whole room's quad memory (texture indices), in index order |
| `numVisibleQuads` | how many quads of the whole room were drawn                                |
| `restrictedZones` | the room's zones, each as `[rowMin, rowMax, colMin, colMax]`               |
| `byteLength`      | how long the encoded blob was                                              |

| fixture   | what it is                                                                              |
|-----------|-------------------------------------------------------------------------------------------|
| `hub`     | a generated Hub room (two open storeys in one texture), under two zones                    |
| `regular` | a generated Regular room, which is mostly solid mass for its owner to mine out             |
| `mixed`   | the version-4 `mixed` room, loaded and saved again as the server does to a room it loads: block work at assorted heights with faces repainted here and there, under as many zones as a room may carry |

`hub` and `regular` are painted in texture 0 throughout, so their quad memory is all zeros and their
hashes agree; `mixed` is the one that carries textures.

They are consumed by `tests/integration/scenarios/voxel-grid-migration.test.ts`. Leave them
untouched: their whole value is that nothing in the current tree produced them.
