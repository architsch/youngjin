import SinglePlayerAction from "../singlePlayerAction";
import SinglePlayerStep from "../singlePlayerStep";

// Client-only half of a single-player mode: steps and teardown. The room lives in the shared
// SinglePlayerModeConfig (the server generates it too).
export default interface SinglePlayerModeClientConfig
{
    loadSteps: () => {[stepName: string]: SinglePlayerStep};
    // Teardown for both completion and skipping (e.g. disabling feature flags).
    onModeEnd: () => SinglePlayerAction[];
}
