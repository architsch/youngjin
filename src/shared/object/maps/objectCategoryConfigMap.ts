import { ObjectCategory, ObjectCategoryEnumMap } from "../types/objectCategory";
import ObjectCategoryConfig from "../types/objectCategoryConfig";

// Every category a room can hold, and what it may hold of it. A category with no cap is one a room
// holds no collection of; listing it anyway is what makes the omission a decision.
const configByCategory: {[category: string]: ObjectCategoryConfig} =
{
    // The grid is one object, and nobody may add another.
    [ObjectCategoryEnumMap.Voxel]: {},
    // Sizes the mesh instance pools (see InstancedMeshCapacityBuilder); also the room balancer's cap
    // (see RoomPickerUtil).
    [ObjectCategoryEnumMap.Player]: {maxCountPerRoom: 64},
    // One cell of the room's shared canvas render target per canvas, which is an 8x8 grid of them (see
    // CanvasObjectTypeConfig).
    [ObjectCategoryEnumMap.Canvas]: {maxCountPerRoom: 64},
    // Sizes the shared mesh instance pools (see InstancedMeshCapacityBuilder).
    [ObjectCategoryEnumMap.Door]: {maxCountPerRoom: 16},
    // Bounded by the mesh pool, propagation cost, clutter and stored size (the block map itself doesn't
    // scale with lamp count).
    [ObjectCategoryEnumMap.Lamp]: {maxCountPerRoom: 64},
    // With the doors, as many labels as the label atlas always has room for, even all at their largest
    // (see LabelText).
    [ObjectCategoryEnumMap.Label]: {maxCountPerRoom: 16},
}

const ObjectCategoryConfigMap =
{
    getConfig: (category: ObjectCategory): ObjectCategoryConfig =>
    {
        const config = configByCategory[category];
        if (config == undefined)
            throw new Error(`getConfig :: Invalid object category (category = ${category})`);
        return config;
    },
    // For the code that is sized by a cap (a mesh pool, the room balancer) rather than checking one.
    getMaxCountPerRoom: (category: ObjectCategory): number =>
    {
        const maxCountPerRoom = ObjectCategoryConfigMap.getConfig(category).maxCountPerRoom;
        if (maxCountPerRoom == undefined)
            throw new Error(`getMaxCountPerRoom :: Object category has no cap (category = ${category})`);
        return maxCountPerRoom;
    },
}

export default ObjectCategoryConfigMap;
