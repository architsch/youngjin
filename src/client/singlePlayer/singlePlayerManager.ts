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
        // Tear down any state the mode left behind (e.g. disable every feature flag it enabled).
        // Doing it here means it runs for both natural completion and skipping.
        runActions(SinglePlayerModeConfigMap[mode].onModeEnd());
        SocketsClient.emitUserCommandSignal(new UserCommandSignal("finishSinglePlayerMode"));
        App.getUser().singlePlayerMode = "";
        singlePlayerObservable.set({mode: "", step: ""});
    },
    skipSinglePlayerMode: () =>
    {
        if (singlePlayerObservable.peek().mode == "")
            return;
        // On natural completion the exit door carries the player out of the single-player experience;
        // when skipping there is no door, so request that same room change here (mirroring
        // DoorGameObject) before finishing — honoring the URL-requested destination if there was one.
        if (tryStartClientProcess("roomChange", 1, 1))
            SocketsClient.emitRequestRoomChangeSignal(new RequestRoomChangeSignal(App.getPostSinglePlayerRoomID()));
        SinglePlayerManager.finishSinglePlayerMode();
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