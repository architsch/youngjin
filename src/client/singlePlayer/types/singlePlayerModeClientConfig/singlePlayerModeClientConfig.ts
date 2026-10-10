import SinglePlayerAction from "../singlePlayerAction";
import SinglePlayerStep from "../singlePlayerStep";

// Client-only half of a single-player mode: steps and teardown. The room it is played in is named by the shared
// SinglePlayerModeConfig, and what the steps act on is found in it by tag or by name (see SinglePlayerRoomQueryUtil).
export default interface SinglePlayerModeClientConfig
{
    loadSteps: () => {[stepName: string]: SinglePlayerStep};
    // Teardown for both completion and skipping (e.g. disabling feature flags).
    onModeEnd: () => SinglePlayerAction[];
}
