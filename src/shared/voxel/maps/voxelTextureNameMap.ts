// What each texture of a voxel texture pack shows, in a few words, so that one can be told and chosen without being
// seen (as AI agents choose them). A pack's own cells in texture index order (from its atlas's bottom-left, row by
// row), then the procedural ones every pack shares. Unique within a pack.
const packNamesByTexturePackPath: {[texturePackPath: string]: string[]} = {
    "default": [
        "grey stone slabs", "ornate white tiles", "blue mosaic tiles", "cream marble tiles",
        "grey octagon tiles", "white octagon tiles", "small marble checker", "large marble checker",
        "grey flagstones", "blue tiles", "white diamond tiles", "pale octagon tiles",
        "green tiles", "veined cream marble", "yellow hex pavers", "red herringbone bricks",
        "pale pine", "dark oak", "weathered planks", "pale ash",
        "mahogany", "oak", "walnut", "grey siding",
        "yellow basket weave", "straw weave", "purple herringbone", "green brick tiles",
        "red basket weave", "brown wicker", "green vent grille", "dark corrugated metal",
        "grey stone wall", "pale bricks", "water", "fire",
        "grey pebbles", "sunflowers", "grass", "dark foliage",
        "red bricks", "ochre stone blocks", "dark stone blocks", "moroccan tiles",
        "mottled grey slabs", "sandstone blocks", "rose stone blocks", "grey stucco",
        "glass blocks", "purple crystal", "green plaid", "diamond plate",
        "blue denim", "pale green granite", "speckled sandstone", "amber cracked stone",
        "giraffe hide", "red tartan", "cow hide", "turquoise suede",
        "orange-black hide", "pink quilted tiles", "camouflage", "charcoal fabric",
    ],
    "country": [
        "brown stone bricks", "limestone bricks", "brown cobblestones", "cream stone tiles",
        "pale diagonal tiles", "peach mosaic", "pink pavers", "slate blue bricks",
        "red plaid", "green plaid", "pink plaid", "mauve plaid",
        "pastel plaid", "leopard hide", "giraffe hide", "tiger hide",
        "knotty yellow wood", "dark wood", "golden wood", "streaked wood",
        "olive wood", "diagonal planks", "log wall", "pale wood",
        "pale planks", "tan basket weave", "large stone checker", "small stone checker",
        "brown tiles", "rag rug", "fine wicker", "golden wicker",
        "corrugated metal", "green louvers", "dark ribbed metal", "brown ornate fabric",
        "salmon plaster", "brown earth", "dusty ground", "olive earth",
        "cream marble", "glass blocks", "rusty metal", "gold",
        "grey slate tiles", "grey stone", "grey pebbles", "red pebbles",
        "thatch", "mossy shingles", "clay roof tiles", "weathered boards",
        "cow hide", "fire", "water", "sunflowers",
        "dark granite", "dry grass", "moss", "lichen",
        "patchy grass", "grass", "meadow grass", "lawn",
    ],
    "garden": [
        "grey stone blocks", "rust bricks", "grey stone tiles", "grey marble tiles",
        "brown brick wall", "rubble wall", "stacked slate", "grey rubble bricks",
        "river stones", "mauve tiles", "gold mosaic", "colorful mosaic",
        "fan pavers", "brick pavers", "large marble checker", "small marble checker",
        "bamboo", "red wood", "brown wood", "mossy shingles",
        "brown weave", "green wicker", "dark ribbed metal", "green louvers",
        "giraffe hide", "purple flowers", "sunflowers", "red flowers",
        "tulips", "pink flowers", "magenta flowers", "yellow flowers",
        "marigolds", "pink blossoms", "grey rocks", "dark rocks",
        "pebbles", "green leaves", "succulents", "variegated leaves",
        "dark grass", "tall grass", "olive foliage", "clover lawn",
        "herb bed", "hedge", "grass tufts", "ivy",
        "yellow grass", "stepping stones", "grass", "deck planks",
        "pale wood", "soil", "dark soil", "cow hide",
        "pink plaid", "green plaid", "orange herringbone", "azulejo tiles",
        "taupe stucco", "granite", "water", "fire",
    ],
    "aqua": [
        "white terrazzo tiles", "lavender tiles", "white mosaic tiles", "sea green tiles",
        "glass blocks", "mauve tiles", "grey diamond tiles", "white glossy tiles",
        "cobalt mosaic", "circle stone pavers", "dotted grey tiles", "large marble checker",
        "small marble checker", "beige diamond tiles", "white diamond tiles", "beige rhombus tiles",
        "slate blue bricks", "white octagon tiles", "beige octagon tiles", "blue marble",
        "blue granite", "pale blue marble", "blue stucco", "moroccan tiles",
        "riveted metal", "blue porthole panel", "green louvers", "dark ribbed metal",
        "rippled water", "white stacked stone", "grey granite", "dark blue stone",
        "green marble", "jade", "sea glass", "turquoise water",
        "pool water", "water", "sky blue water", "ice",
        "blue crystal tiles", "purple crystal", "teal crystal", "pale crystal",
        "opal", "pale blue plaster", "snow", "cream marble",
        "mahogany", "golden wood", "red plaid", "pastel plaid",
        "blue knit", "wicker", "giraffe hide", "cow hide",
        "grass", "dark grass", "sand", "pebbles",
        "grey pebbles", "blue flowers", "sunflowers", "fire",
    ],
    "inferno": [
        "brown stone tiles", "rusty parquet", "diamond plate", "rusty diamond plate",
        "olive weave", "red corduroy", "mahogany", "golden wood",
        "brown wood", "dark red wood", "red roof tiles", "corrugated metal",
        "hieroglyphs", "dark pavers", "large marble checker", "small marble checker",
        "black diamond marble", "black and white diamond marble", "beige diamond marble", "black marble",
        "beige marble", "sunflowers", "grass", "dark foliage",
        "water", "gold crystal", "studded fabric", "grey pebbles",
        "red gravel", "red shingles", "amber rock", "rusty corrugated metal",
        "rusty grate", "rusty lattice", "perforated metal", "rusty mesh",
        "rusty herringbone", "green louvers", "dark ribbed metal", "rusty panel",
        "cracked earth", "pale cracked stone", "sandstone", "brown rough stone",
        "salmon plaster", "mauve stone", "olive slime", "grey-brown rock",
        "sand", "rusty plate", "giraffe hide", "cow hide",
        "rusted steel", "maroon gravel", "red crust", "dark rust",
        "molten red", "orange rust", "lava cracks", "dark lava",
        "fire", "embers", "orange flames", "scorched",
    ],
    "prison": [
        "grey stone tiles", "rose stone blocks", "peach mosaic", "ornate white tiles",
        "sunflowers", "grass", "dark foliage", "peeling green paint",
        "speckled carpet", "mahogany", "golden wood", "grey bars",
        "giraffe hide", "cow hide", "green crystal", "teal plaster",
        "triangle tiles", "dark ribbed metal", "pale lattice", "slate",
        "olive stone", "brass pipes", "red grit", "grey granite",
        "lichen concrete", "pale grate", "green truss", "fire",
        "water", "riveted metal", "diamond plate", "braided metal",
        "grey hex tiles", "black cobbles", "olive circuit", "camouflage",
        "green plaid", "stone fretwork", "green grate", "green louvers",
        "small marble checker", "large marble checker", "lavender stucco", "brass",
        "grey ribbed panel", "grey planks", "weathered planks", "glass blocks",
        "weathered boards", "corrugated metal", "rust-stained plaster", "mauve plaster",
        "grey pebbles", "speckled stone", "wood shingles", "slate tiles",
        "crumpled foil", "rust", "peeling red paint", "grimy olive",
        "black moss", "charcoal stone", "grey concrete", "peeling blue paint",
    ],
};

// In the order of ProceduralVoxelTextures.
const proceduralNames = [
    "light metal", "grey metal", "dark metal",
    "white concrete", "raw concrete", "black concrete",
    "khaki concrete", "orange concrete", "beige concrete", "brown concrete", "red concrete",
    "olive concrete", "teal concrete", "blue concrete", "purple concrete", "lavender concrete",
];

const VoxelTextureNameMap =
{
    // Every texture of a pack, by texture index; none for a pack nobody has named.
    getNames: (texturePackPath: string): string[] =>
    {
        const packNames = packNamesByTexturePackPath[texturePackPath];
        return packNames ? [...packNames, ...proceduralNames] : [];
    },
    // A texture's name, or its index for one without.
    getName: (texturePackPath: string, textureIndex: number): string =>
    {
        return VoxelTextureNameMap.getNames(texturePackPath)[textureIndex] ?? `texture ${textureIndex}`;
    },
    // The texture a name stands for in a pack, case aside; -1 for none.
    findTextureIndex: (texturePackPath: string, name: string): number =>
    {
        const wanted = name.trim().toLowerCase();
        return VoxelTextureNameMap.getNames(texturePackPath).indexOf(wanted);
    },
}

export default VoxelTextureNameMap;
