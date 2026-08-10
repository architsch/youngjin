import RequestRoomChangeSignal from "../../shared/room/types/requestRoomChangeSignal";
import SinglePlayerModeConfigMap from "../../shared/singlePlayer/maps/singlePlayerModeConfigMap";
import SinglePlayerAction from "../../shared/singlePlayer/types/singlePlayerAction";
import SinglePlayerStep from "../../shared/singlePlayer/types/singlePlayerStep";
import UserCommandSignal from "../../shared/user/types/userCommandSignal";
import App from "../app";
import SocketsClient from "../networking/client/socketsClient";
import { singlePlayerObservable } from "../system/clientObservables";
import { tryStartClientProcess } from "../system/types/clientProcess";
import SinglePlayerActionMap from "./maps/singlePlayerActionMap";
import SinglePlayerConditionMap from "./maps/singlePlayerConditionMap";

const SinglePlayerManager =
{
    update: (deltaTime: number) =>
    {
        const {mode, step} = singlePlayerObservable.peek();
        if (mode != "" && step != "")
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
        runActions(SinglePlayerModeConfigMap[mode].onModeEnd());
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
}

let pendingTimeout: ReturnType<typeof setTimeout> | undefined = undefined;
let prevStep: string = "";
let stepByName: {[stepName: string]: SinglePlayerStep};

singlePlayerObservable.addListener("singlePlayer", (v: {mode: string, step: string}) => {
    if (v.mode != "") // If the mode has started, ensure that its steps are loaded.
    {
        const config = SinglePlayerModeConfigMap[v.mode];
        stepByName = config.loadSteps();
    }
    
    // If the previous step was the final step, finish the singleplayer mode.
    const shouldFinishMode = prevStep != "" && v.step == "";

    if (prevStep != "") // If the previous step exists, end it.
    {
        // End previous step
        runActions(stepByName[prevStep].actionsOnEnd);
        prevStep = "";
    }

    if (v.step != "") // If the new step exists, start it.
    {
        // Start new step
        const stepObj = stepByName[v.step];
        if (stepObj.startDelay > 0)
            setTimeout(() => runActions(stepObj.actionsOnStart), stepObj.startDelay);
        else
            runActions(stepObj.actionsOnStart);
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