import { singlePlayerModeObservable, singlePlayerStepObservable } from "../system/clientObservables";
import SinglePlayerStepRunnerConstructorMap from "./maps/singlePlayerStepRunnerConstructorMap";
import SinglePlayerStepRunner from "./stepRunners/singlePlayerStepRunner";

const SinglePlayerManager =
{
    update: (deltaTime: number) =>
    {
        if (currStepRunner)
            currStepRunner.update(deltaTime);
    },
}

let currStepRunner: SinglePlayerStepRunner | undefined;
let singlePlayerMode = "";
let singlePlayerStep = -1;

singlePlayerModeObservable.addListener("singlePlayer", (x: string) => {
    singlePlayerMode = x;
    onSinglePlayerModeOrStepSet();
});
singlePlayerStepObservable.addListener("singlePlayer", (x: number) => {
    singlePlayerStep = x;
    onSinglePlayerModeOrStepSet();
});

function onSinglePlayerModeOrStepSet()
{
    if (currStepRunner)
    {
        currStepRunner.end();
        currStepRunner = undefined;
    }

    if (singlePlayerMode.length > 0 && singlePlayerStep >= 0)
    {
        currStepRunner = SinglePlayerStepRunnerConstructorMap[singlePlayerMode][singlePlayerStep]();
        currStepRunner.start();
    }
}

export default SinglePlayerManager;