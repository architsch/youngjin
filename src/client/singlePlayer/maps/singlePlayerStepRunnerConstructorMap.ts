import SinglePlayerStepRunner from "../stepRunners/singlePlayerStepRunner";
import { Tutorial_0 } from "../stepRunners/tutorial_0";

// array index = single-player mode's current step (aka "singlePlayerStep")
const SinglePlayerStepRunnerConstructorMap: {[singlePlayerMode: string]: (() => SinglePlayerStepRunner)[]} = {
    "tutorial": [
        () => new Tutorial_0(),
    ],
};

export default SinglePlayerStepRunnerConstructorMap;