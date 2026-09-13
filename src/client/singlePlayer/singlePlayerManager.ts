import RequestRoomChangeSignal from "../../shared/room/types/requestRoomChangeSignal";
import UserCommandSignal from "../../shared/user/types/userCommandSignal";
import App from "../app";
import SocketsClient from "../networking/client/socketsClient";
import { singlePlayerObservable } from "../system/clientObservables";
import ClientEvent from "../system/types/clientEvent";
import { ClientEventType } from "../system/types/clientEventType";
import { tryStartClientProcess } from "../system/types/clientProcess";
import ClientEventHistoryUtil from "../system/util/clientEventHistoryUtil";
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
        // Don't evaluate transitions before the step's start actions have run.
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
        // Idempotent: finishing re-enters the listener below, and the server must get only one
        // "finishSinglePlayerMode" command.
        const mode = singlePlayerObservable.peek().mode;
        if (mode == "")
            return;
        // Cancel a pending step transition so it can't start after the mode has ended.
        if (pendingTimeout !== undefined)
        {
            clearTimeout(pendingTimeout);
            pendingTimeout = undefined;
        }
        // Runs for both completion and skipping.
        runActions(SinglePlayerModeClientConfigMap[mode].onModeEnd());
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
        // Clear the step rather than finishing directly, so skipping follows the completion order
        // (end step, then finish). Otherwise a step's end actions could re-enable a flag after
        // onModeEnd's teardown.
        singlePlayerObservable.set({mode, step: ""});
        if (tryStartClientProcess("roomChange", 1, 1))
        {
            // An empty roomID lets the server pick the destination.
            SocketsClient.emitRequestRoomChangeSignal(new RequestRoomChangeSignal("", true));
        }
    },
    // Stores a value for later steps of this mode (see the "set_variable" action).
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

// Values computed during play for later steps; cleared when the mode ends.
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
                // Skip if the step was left during the delay (skipped or room changed).
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
        ClientEventHistoryUtil.add(new ClientEvent(ClientEventType.SinglePlayerStepChanged));
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
