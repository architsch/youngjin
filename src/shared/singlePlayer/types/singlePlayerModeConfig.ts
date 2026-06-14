import ObjectGroup from "../../object/types/objectGroup";
import VoxelGrid from "../../voxel/types/voxelGrid";
import SinglePlayerAction from "./singlePlayerAction";
import SinglePlayerModeConfigMetadata from "./singlePlayerModeConfigMetadata";
import SinglePlayerStep from "./singlePlayerStep";

export default interface SinglePlayerModeConfig
{
    loadMetadata: () => SinglePlayerModeConfigMetadata;
    buildRoom: (voxelGrid: VoxelGrid, objectGroup: ObjectGroup) => void;
    loadSteps: () => {[stepName: string]: SinglePlayerStep};
    // Actions to run when the mode ends — whether it was completed or skipped — to tear down
    // any lingering state (e.g. disabling every feature flag the mode may have enabled).
    onModeEnd: () => SinglePlayerAction[];
}