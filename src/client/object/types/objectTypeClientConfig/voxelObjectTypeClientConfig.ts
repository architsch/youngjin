import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import ObjectTypeClientConfigMap from "../../maps/objectTypeClientConfigMap";
import VoxelGameObject from "../voxelGameObject";
import ObjectTypeClientConfig from "./objectTypeClientConfig";

// Voxels are never selected as objects: a click selects the face (VoxelQuadSelection), handled in
// VoxelGameObject.
const VoxelObjectTypeClientConfig: ObjectTypeClientConfig =
{
    construct: (params: AddObjectSignal) => new VoxelGameObject(params),
};

ObjectTypeClientConfigMap.setConfig("Voxel", VoxelObjectTypeClientConfig);

export default VoxelObjectTypeClientConfig;
