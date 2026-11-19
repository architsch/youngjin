import Room from "../../../room/types/room";
import User from "../../../user/types/user";
import AddObjectSignal from "../../types/addObjectSignal";
import { ObjectCategoryEnumMap } from "../../types/objectCategory";
import ObjectTypeConfig from "./objectTypeConfig";
import SetObjectMetadataSignal from "../../types/setObjectMetadataSignal";
import SetObjectTransformSignal from "../../types/setObjectTransformSignal";

// The room's voxel grid as a single object (voxels -> blocks -> quads). No per-room cap: there is only
// one, and nobody may add another.
const VoxelObjectTypeConfig =
{
    objectType: "Voxel",
    persistent: false,
    autoUnload: false, // Voxels persist across rooms (shared instanced mesh + texture pack); rebound, not recreated.
    category: ObjectCategoryEnumMap.Voxel,
    canUserAddObject: (user: User, room: Room, obj: AddObjectSignal) => {
        return false;
    },
    canUserRemoveObject: (user: User, room: Room, obj: AddObjectSignal) => {
        return false;
    },
    canUserSetObjectTransform: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectTransformSignal) => {
        return false;
    },
    canUserSetObjectMetadata: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectMetadataSignal) => {
        return false;
    },
    components: {
        spawnedByAny: {
            // Collider is not needed here because the physics system handles voxels under a separate logic.
            instancedMeshGraphics: {},
            orbitOccluder: {}, // The room's own walls, floor, and ceiling are the main thing the orbit camera has to see past.
        },
    },
} satisfies ObjectTypeConfig;

export default VoxelObjectTypeConfig;