export type ObjectCategory = string;

// The kind of thing an object is, regardless of how it is placed: every kind of lamp is a Lamp. A room
// caps what it holds by category, not by type (see ObjectCategoryConfigMap). Never stored.
export const ObjectCategoryEnumMap: Record<string, ObjectCategory> =
{
    Voxel: "Voxel",
    Player: "Player",
    Canvas: "Canvas",
    Door: "Door",
    Lamp: "Lamp",
    Label: "Label",
}
