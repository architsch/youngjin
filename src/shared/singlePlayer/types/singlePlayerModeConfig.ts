import ObjectGroup from "../../object/types/objectGroup";
import VoxelGrid from "../../voxel/types/voxelGrid";
import SinglePlayerModeConfigMetadata from "./singlePlayerModeConfigMetadata";

// What a single-player mode's room is: its measurements, the texture pack it is dressed in, and how
// it is built. Shared, because the server generates the same room the client does.
//
// What the mode *does* to the user once he is inside that room — the steps he is walked through — is
// the client's alone, and lives in SinglePlayerModeClientConfig.
export default interface SinglePlayerModeConfig
{
    loadMetadata: () => SinglePlayerModeConfigMetadata;
    texturePackPath: string;
    buildRoom: (voxelGrid: VoxelGrid, objectGroup: ObjectGroup) => void;
}
