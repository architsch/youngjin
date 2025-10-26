const s0 = `
GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG
GgggggDgDgDgDgDgDgDgDggggggggggG
GggggggggggggggggggggggggggggggG
GggggggggggggggggggggggggggggggG
GggggggggggggggggggggggggggggggG
BBBBBBBBBggggggggGGGGGGGGGGGGGGG
BbbbbbbbBggggggggGgggggggggggggG
BbbbbbbbBggggggggGgggggggggggggG
BEbbbbbbBggggggggGgggggggggggggG
BbbbbbbbBeeeeeeeeeeeeeeeCccccccC
BEbbbbbbBeeeeeeeeeeeeeeeCccccccC
BbbbbbbbBeeeeeeeeeeeeeeeCCCCCCCC
BEbbbbbbBeeeeiiiiiiieeeeCccccccC
BbbbbbbbBeeeeiiiiiiieeeeCccccccC
GddddddddeeeeiiiiiiieeeeCccccccC
GGdddddddeeeeiiiiiiieeeeCccccccC
GddddddddeeeeeeeeeeeeeeeCccccccC
GGdddddddeeeeeeeeeeeeeeeCccccccC
GddddddddeeeeeeeeeeeeeeegggggggG
GGGGGGGGGGGGGGggggggggggggggggg1
GggggggggggggggggggggggggggggggG
GgggggggggggggggggggggggHhhhhhhH
FffffffffffffFggggggggggHhhhhhhH
FffffffffffffFggggggggggHhhhhhhH
FffffffffffffFggggggggggHhhhhhhH
FffffffffffffFggggggggggHhhhhhhH
FffffffffffffFggggggggggHhhhhhhH
FffffffffffffFggggHHHHHHHHHHHHHH
FffffffffffffFgggggggggggggggggG
FffffffffffffFgggggggggggggggggG
FffffffffffffFgggggggggggggggggG
FFFFFFFFFFFFFFGGGGGGGGGGGGGGGGGG
`.split("\n").map(x => x.trim()).filter(x => x.length > 0).join("\n");

const s1 = `
EEEEEEEEEEEEEEEE
EkkkkkkkkkkkkkkE
EkFkkkkkkkkkkFkE
EkkkkkkkkkkkkkkE
EkFkkkkkkkkkkFkE
EkkkkkkkkkkkkkkE
EkkkkkkkkkkkkkkE
AjjjjjjjjjjjjjjA
AjjjjjjjjjjjjjjA
AjjjjjjjjjjjjjjA
AjjjjjjjjjjjjjjA
CddddddddddddddC
CdFFddddddddFFdC
CdFFddddddddFFdC
CddddddddddddddC
CCCCCCC0CCCCCCCC
`.split("\n").map(x => x.trim()).filter(x => x.length > 0).join("\n");

const VoxelMaps: {[roomID: string]: string} =
{
    s0, s1,
}

export default VoxelMaps;