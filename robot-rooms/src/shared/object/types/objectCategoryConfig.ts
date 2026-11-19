export default interface ObjectCategoryConfig
{
    // Per-room cap, spent by every type in the category together (mesh pool, clutter, stored size).
    // Unset for categories a room holds no collection of.
    maxCountPerRoom?: number;
}
