import { ROOM_EDITOR_SINGLE_PLAYER_MODE, SANDBOX_SINGLE_PLAYER_MODE,
    TUTORIAL_SINGLE_PLAYER_MODE } from "../../../shared/system/sharedConstants";
import RoomEditorSinglePlayerModeClientConfig from "../types/singlePlayerModeClientConfig/roomEditorSinglePlayerModeClientConfig";
import SandboxSinglePlayerModeClientConfig from "../types/singlePlayerModeClientConfig/sandboxSinglePlayerModeClientConfig";
import SinglePlayerModeClientConfig from "../types/singlePlayerModeClientConfig/singlePlayerModeClientConfig";
import TutorialSinglePlayerModeClientConfig from "../types/singlePlayerModeClientConfig/tutorialSinglePlayerModeClientConfig";

// Client-side steps and teardown per mode (see SinglePlayerModeClientConfig). The room each is played in is
// named by the shared SinglePlayerModeConfigMap.
const SinglePlayerModeClientConfigMap: {[singlePlayerMode: string]: SinglePlayerModeClientConfig} = {
    [TUTORIAL_SINGLE_PLAYER_MODE]: TutorialSinglePlayerModeClientConfig,
    [SANDBOX_SINGLE_PLAYER_MODE]: SandboxSinglePlayerModeClientConfig,
    [ROOM_EDITOR_SINGLE_PLAYER_MODE]: RoomEditorSinglePlayerModeClientConfig,
};

export default SinglePlayerModeClientConfigMap;
