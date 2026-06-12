import ObjectGroup from "../../object/types/objectGroup";
import VoxelGrid from "../../voxel/types/voxelGrid";
import SinglePlayerModeConfigMetadata from "./singlePlayerModeConfigMetadata";
import SinglePlayerStep from "./singlePlayerStep";

export default interface SinglePlayerModeConfig
{
    loadMetadata: () => SinglePlayerModeConfigMetadata;
    buildRoom: (voxelGrid: VoxelGrid, objectGroup: ObjectGroup) => void;
    loadSteps: () => {[stepName: string]: SinglePlayerStep};
}