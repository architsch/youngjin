import ProceduralTextureSpec from "../types/proceduralTextureSpec";

// The cells SSG adds to every voxel texture pack's atlas (see VoxelTexturePackBuilder), in texture index order from
// the first past a pack's own. Append-only: a stored quad names its texture by index, and each is drawn from a seed
// that is its place here.
export const ProceduralVoxelTextures: ProceduralTextureSpec[] = [
    // Shiny metal: light, medium and dark gray
    {surface: "metal", colorHex: "#c2c6cb"},
    {surface: "metal", colorHex: "#8b9097"},
    {surface: "metal", colorHex: "#4b4f55"},
    // Concrete painted white, raw, and painted black
    {surface: "paintedConcrete", colorHex: "#ebeae6"},
    {surface: "rawConcrete", colorHex: "#8f8d88"},
    {surface: "paintedConcrete", colorHex: "#2a2b2d"},
    // Concrete painted light khaki, dusty orange, Chrysler dark beige, dark brown and royal red
    {surface: "paintedConcrete", colorHex: "#f0e68c"},
    {surface: "paintedConcrete", colorHex: "#e27a53"},
    {surface: "paintedConcrete", colorHex: "#a9957b"},
    {surface: "paintedConcrete", colorHex: "#654321"},
    {surface: "paintedConcrete", colorHex: "#5f081f"},
    // Concrete painted army green, dark cyan, cornflower blue, husky purple and royal periwinkle
    {surface: "paintedConcrete", colorHex: "#4b5320"},
    {surface: "paintedConcrete", colorHex: "#067a87"},
    {surface: "paintedConcrete", colorHex: "#6395ee"},
    {surface: "paintedConcrete", colorHex: "#4b2e83"},
    {surface: "paintedConcrete", colorHex: "#be93d4"},
];
