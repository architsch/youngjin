import RequestRoomChangeSignal from "../../shared/room/types/requestRoomChangeSignal";
import UserCommandSignal from "../../shared/user/types/userCommandSignal";
import App from "../app";
import SocketsClient from "../networking/client/socketsClient";
import { singlePlayerObservable } from "../system/clientObservables";
import { tryStartClientProcess } from "../system/types/clientProcess";
import SinglePlayerActionMap from "./maps/singlePlayerActionMap";
import SinglePlayerConditionMap from "./maps/singlePlayerConditionMap";
import SinglePlayerModeClientConfigMap from "./maps/singlePlayerModeClientConfigMap";
import SinglePlayerAction from "./types/singlePlayerAction";
import SinglePlayerStep from "./types/singlePlayerStep";

const SinglePlayerManager =
{
    update: (deltaTime: number) =>
    {
        const {mode, step} = singlePlayerObservable.peek();
        // A step that has not begun yet cannot be over: while its start actions are waiting out
        // their delay, the world is still arranged the way the previous step left it, and a rule
        // read against that arrangement would answer for a step that has not happened.
        if (mode != "" && step != "" && stepStarted)
        {
            // Check transition rules
            for (const rule of stepByName[step].transitionRules)
            {
                let allRequirementsMet = true;
                for (const requirement of rule.requirements)
                {
                    if (!SinglePlayerConditionMap[requirement.type](requirement as any))
                    {
                        allRequirementsMet = false;
                        break;
                    }
                }
                if (allRequirementsMet)
                {
                    if (pendingTimeout === undefined)
                    {
                        if (rule.nextStepDelay > 0)
                        {
                            pendingTimeout = setTimeout(() => {
                                singlePlayerObservable.set({
                                    mode: singlePlayerObservable.peek().mode,
                                    step: rule.nextStep
                                });
                                pendingTimeout = undefined;
                            }, rule.nextStepDelay);
                        }
                        else
                        {
                            singlePlayerObservable.set({
                                mode: singlePlayerObservable.peek().mode,
                                step: rule.nextStep
                            });
                        }
                    }
                    break;
                }
            }
        }
    },
    finishSinglePlayerMode: () =>
    {
        // Idempotent: finishing sets the observable to {mode:"", step:""}, which re-enters the
        // listener below and calls this again. Bail out so the server only receives one
        // "finishSinglePlayerMode" command (relevant when finishing is triggered mid-step).
        const mode = singlePlayerObservable.peek().mode;
        if (mode == "")
            return;
        // A step transition may still be waiting out its delay. Cancel it, or it would fire after
        // the mode has ended and start that step (UI, gizmos, feature flags) on top of whichever
        // room the user moved on to.
        if (pendingTimeout !== undefined)
        {
            clearTimeout(pendingTimeout);
            pendingTimeout = undefined;
        }
        // Tear down any state the mode left behind (e.g. disable every feature flag it enabled).
        // Doing it here means it runs for both natural completion and skipping.
        runActions(SinglePlayerModeClientConfigMap[mode].onModeEnd());
        // Whatever the mode's steps worked out for each other belonged to that run of it, and to
        // the room it was played in. Nothing of it survives into the next.
        for (const name of Object.keys(variables))
            delete variables[name];
        SocketsClient.emitUserCommandSignal(new UserCommandSignal("finishSinglePlayerMode"));
        App.getUser().singlePlayerMode = "";
        singlePlayerObservable.set({mode: "", step: ""});
    },
    skipSinglePlayerMode: () =>
    {
        const mode = singlePlayerObservable.peek().mode;
        if (mode == "")
        {
            console.warn("skipSinglePlayerMode :: SinglePlayerMode is already finished.");
            return;
        }
        // Clear the step instead of finishing the mode directly, so that skipping takes exactly
        // the same path as natural completion: the listener below ends the current step first,
        // and only then finishes the mode. Calling finish directly would invert that order, and
        // a step whose actionsOnEnd re-enables a feature flag would silently undo onModeEnd's
        // teardown — leaving the flag set for the rest of the session.
        singlePlayerObservable.set({mode, step: ""});
        if (tryStartClientProcess("roomChange", 1, 1))
        {
            // Since roomID is not specified (i.e. left as ""), the server will
            // pick the most appropriate destination for the user.
            SocketsClient.emitRequestRoomChangeSignal(new RequestRoomChangeSignal("", true));
        }
    },
    // Sets a value aside under a name, for the rest of the current mode to build its parameters
    // from (see the "set_variable" action).
    setVariable: (name: string, value: any) =>
    {
        variables[name] = value;
    },
    // What was set aside under the given name, or undefined if nothing was.
    getVariable: (name: string): any =>
    {
        return variables[name];
    },
}

// What the steps of the current mode have worked out for each other. A step is written long before
// it is played, so much of what it wants to point at — which patch of floor, which view the user
// started from — can only be settled while it is being played; this is where one step leaves such a
// finding for the steps that follow it, and it is emptied when the mode ends.
const variables: {[name: string]: any} = {};

let pendingTimeout: ReturnType<typeof setTimeout> | undefined = undefined;
let prevStep: string = "";
// Whether the current step's start actions have run (see update).
let stepStarted: boolean = false;
let stepByName: {[stepName: string]: SinglePlayerStep};

singlePlayerObservable.addListener("singlePlayer", (v: {mode: string, step: string}) => {
    if (v.mode != "") // If the mode has started, ensure that its steps are loaded.
        stepByName = SinglePlayerModeClientConfigMap[v.mode].loadSteps();

    // If the previous step was the final step, finish the singleplayer mode.
    const shouldFinishMode = prevStep != "" && v.step == "";

    if (prevStep != "") // If the previous step exists, end it.
    {
        // End previous step
        runActions(stepByName[prevStep].actionsOnEnd);
        prevStep = "";
    }

    stepStarted = false;

    if (v.step != "") // If the new step exists, start it.
    {
        // Start new step
        const stepObj = stepByName[v.step];
        if (stepObj.startDelay > 0)
        {
            setTimeout(() => {
                // The step may have been left behind meanwhile (the mode was skipped, or the room
                // changed), in which case its actions belong to nothing and must not run.
                if (singlePlayerObservable.peek().step != v.step)
                    return;
                runActions(stepObj.actionsOnStart);
                stepStarted = true;
            }, stepObj.startDelay);
        }
        else
        {
            runActions(stepObj.actionsOnStart);
            stepStarted = true;
        }
        prevStep = v.step;
    }

    if (shouldFinishMode)
        SinglePlayerManager.finishSinglePlayerMode();
});

function runActions(actions: SinglePlayerAction[])
{
    for (const action of actions)
        SinglePlayerActionMap[action.type](action as any);
}

export default SinglePlayerManager;
