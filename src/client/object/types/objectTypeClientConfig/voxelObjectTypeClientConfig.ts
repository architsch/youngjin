import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import ObjectTypeClientConfigMap from "../../maps/objectTypeClientConfigMap";
import VoxelGameObject from "../voxelGameObject";
import ObjectTypeClientConfig from "./objectTypeClientConfig";

// A voxel is never picked out as an object. What the user takes hold of in the room's block work is
// the face he clicked — one quad of one voxel, which is what carries a texture and what a block is
// built on — so the selection there is a VoxelQuadSelection, this config declares none, and the
// object answers the click itself (see VoxelGameObject).
const VoxelObjectTypeClientConfig: ObjectTypeClientConfig =
{
    construct: (params: AddObjectSignal) => new VoxelGameObject(params),
};

ObjectTypeClientConfigMap.setConfig("Voxel", VoxelObjectTypeClientConfig);

export default VoxelObjectTypeClientConfig;
