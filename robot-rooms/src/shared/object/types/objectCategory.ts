export type ObjectCategory = string;

// The kind of thing an object is, regardless of how it is placed: every kind of lamp is a Lamp. A room
// caps what it holds by category, not by type (see ObjectCategoryConfigMap). Never stored.
export const ObjectCategoryEnumMap: Record<string, ObjectCategory> =
{
    Voxel: "Voxel",
    Player: "Player",
    Picture: "Picture", // canvases and props
    Door: "Door",
    Lamp: "Lamp",
    Label: "Label",
    Npc: "Npc",
    Volume: "Volume",
    Fan: "Fan",
    Mirror: "Mirror",
    Collectible: "Collectible",
    Cannon: "Cannon",
    CannonBall: "CannonBall",
    Pet: "Pet", // the pets that come and go with their owners
    ServerPet: "ServerPet", // the pets a room keeps
    PetScrap: "PetScrap",
}
