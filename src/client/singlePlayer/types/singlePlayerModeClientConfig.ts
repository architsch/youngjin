import SinglePlayerAction from "./singlePlayerAction";
import SinglePlayerStep from "./singlePlayerStep";

// The half of a single-player mode that only the client can carry out: what the user is walked
// through, step by step, and what has to be undone once he is through it.
//
// It is kept apart from SinglePlayerModeConfig, which holds the half both sides need — the room's
// measurements and how it is built — because the server generates that room too, while nothing on
// the server has any use for the steps. Separating them is also what lets a step reach straight for
// the room, the character, the camera and this mode's own variables: all of them the client's alone,
// and none of them reachable from shared code.
export default interface SinglePlayerModeClientConfig
{
    loadSteps: () => {[stepName: string]: SinglePlayerStep};
    // Actions to run when the mode ends — whether it was completed or skipped — to tear down
    // any lingering state (e.g. disabling every feature flag the mode may have enabled).
    onModeEnd: () => SinglePlayerAction[];
}
