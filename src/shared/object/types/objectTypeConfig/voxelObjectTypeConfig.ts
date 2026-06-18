import Room from "../../../room/types/room";
import User from "../../../user/types/user";
import { UserRole } from "../../../user/types/userRole";
import AddObjectSignal from "../../types/addObjectSignal";
import ObjectTypeConfig from "./objectTypeConfig";
import SetObjectMetadataSignal from "../../types/setObjectMetadataSignal";
import SetObjectTransformSignal from "../../types/setObjectTransformSignal";

// This object represents each voxel in the room's voxelGrid. Each voxel consists of blocks, and each block consists of quads (aka "voxelQuads").
const VoxelObjectTypeConfig: ObjectTypeConfig =
{
    objectType: "Voxel",
    persistent: false,
    autoUnload: false, // Voxels persist across rooms (shared instanced mesh + texture pack); rebound, not recreated.
    canUserAddObject: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal) => {
        return false;
    },
    canUserRemoveObject: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal) => {
        return false;
    },
    canUserSetObjectTransform: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal, signal: SetObjectTransformSignal) => {
        return false;
    },
    canUserSetObjectMetadata: (user: User, userRole: UserRole, room: Room, obj: AddObjectSignal, signal: SetObjectMetadataSignal) => {
        return false;
    },
    components: {
        spawnedByAny: {
            // Collider is not needed here because the physics system handles voxels under a separate logic.
            instancedMeshGraphics: {},
        },
    },
}

export default VoxelObjectTypeConfig;