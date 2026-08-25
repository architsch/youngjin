import { TUTORIAL_SINGLE_PLAYER_MODE } from "../../../shared/system/sharedConstants";
import SinglePlayerModeClientConfig from "../types/singlePlayerModeClientConfig/singlePlayerModeClientConfig";
import TutorialSinglePlayerModeClientConfig from "../types/singlePlayerModeClientConfig/tutorialSinglePlayerModeClientConfig";

// What each single-player mode does to the client while it is being played: the steps the user is
// walked through, and the teardown that follows them (see SinglePlayerModeClientConfig). The room
// those steps are played in is described elsewhere, by the shared SinglePlayerModeConfigMap, since
// the server generates that room too.
const SinglePlayerModeClientConfigMap: {[singlePlayerMode: string]: SinglePlayerModeClientConfig} = {
    [TUTORIAL_SINGLE_PLAYER_MODE]: TutorialSinglePlayerModeClientConfig,
};

export default SinglePlayerModeClientConfigMap;
