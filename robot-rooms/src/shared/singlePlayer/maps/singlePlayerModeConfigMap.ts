import { ROOM_EDITOR_SINGLE_PLAYER_MODE, SANDBOX_SINGLE_PLAYER_MODE,
    TUTORIAL_SINGLE_PLAYER_MODE } from "../../system/sharedConstants";
import RoomEditorSinglePlayerModeConfig from "../types/singlePlayerModeConfig/roomEditorSinglePlayerModeConfig";
import SandboxSinglePlayerModeConfig from "../types/singlePlayerModeConfig/sandboxSinglePlayerModeConfig";
import SinglePlayerModeConfig from "../types/singlePlayerModeConfig/singlePlayerModeConfig";
import TutorialSinglePlayerModeConfig from "../types/singlePlayerModeConfig/tutorialSinglePlayerModeConfig";

// What both sides know of each single-player mode (its steps live in SinglePlayerModeClientConfigMap): the
// server takes a room named for one of these as that mode's. Imported explicitly, so the map is always complete.
const SinglePlayerModeConfigMap: {[singlePlayerMode: string]: SinglePlayerModeConfig} = {
    [TUTORIAL_SINGLE_PLAYER_MODE]: TutorialSinglePlayerModeConfig,
    [SANDBOX_SINGLE_PLAYER_MODE]: SandboxSinglePlayerModeConfig,
    [ROOM_EDITOR_SINGLE_PLAYER_MODE]: RoomEditorSinglePlayerModeConfig,
};

export default SinglePlayerModeConfigMap;
