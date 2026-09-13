import { SANDBOX_SINGLE_PLAYER_MODE, TUTORIAL_SINGLE_PLAYER_MODE } from "../../../shared/system/sharedConstants";
import SandboxSinglePlayerModeClientConfig from "../types/singlePlayerModeClientConfig/sandboxSinglePlayerModeClientConfig";
import SinglePlayerModeClientConfig from "../types/singlePlayerModeClientConfig/singlePlayerModeClientConfig";
import TutorialSinglePlayerModeClientConfig from "../types/singlePlayerModeClientConfig/tutorialSinglePlayerModeClientConfig";

// Client-side steps and teardown per mode (see SinglePlayerModeClientConfig). The room itself is in
// the shared SinglePlayerModeConfigMap.
const SinglePlayerModeClientConfigMap: {[singlePlayerMode: string]: SinglePlayerModeClientConfig} = {
    [TUTORIAL_SINGLE_PLAYER_MODE]: TutorialSinglePlayerModeClientConfig,
    [SANDBOX_SINGLE_PLAYER_MODE]: SandboxSinglePlayerModeClientConfig,
};

export default SinglePlayerModeClientConfigMap;
