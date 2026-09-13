import { SANDBOX_SINGLE_PLAYER_MODE, TUTORIAL_SINGLE_PLAYER_MODE } from "../../system/sharedConstants";
import SandboxSinglePlayerModeConfig from "../types/singlePlayerModeConfig/sandboxSinglePlayerModeConfig";
import SinglePlayerModeConfig from "../types/singlePlayerModeConfig/singlePlayerModeConfig";
import TutorialSinglePlayerModeConfig from "../types/singlePlayerModeConfig/tutorialSinglePlayerModeConfig";

// Room configs per single-player mode (shared, since the server generates the same room; steps live in
// SinglePlayerModeClientConfigMap). Imported explicitly, so the map is always complete.
const SinglePlayerModeConfigMap: {[singlePlayerMode: string]: SinglePlayerModeConfig} = {
    [TUTORIAL_SINGLE_PLAYER_MODE]: TutorialSinglePlayerModeConfig,
    [SANDBOX_SINGLE_PLAYER_MODE]: SandboxSinglePlayerModeConfig,
};

export default SinglePlayerModeConfigMap;
