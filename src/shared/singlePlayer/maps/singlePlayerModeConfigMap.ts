import { TUTORIAL_SINGLE_PLAYER_MODE } from "../../system/sharedConstants";
import SinglePlayerModeConfig from "../types/singlePlayerModeConfig/singlePlayerModeConfig";
import TutorialSinglePlayerModeConfig from "../types/singlePlayerModeConfig/tutorialSinglePlayerModeConfig";

// Every single-player mode's room: the parameters it is built from, and how it is built. Shared,
// because the server generates the same room the client does — the steps the user is then walked
// through are the client's alone (see SinglePlayerModeClientConfigMap).
//
// Entries are imported here rather than registering themselves, so that the map is complete the
// moment it is read and does not depend on some entry point having remembered to pull a file in.
const SinglePlayerModeConfigMap: {[singlePlayerMode: string]: SinglePlayerModeConfig} = {
    [TUTORIAL_SINGLE_PLAYER_MODE]: TutorialSinglePlayerModeConfig,
};

export default SinglePlayerModeConfigMap;
