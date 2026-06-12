import SinglePlayerModeConfigMap from "../../shared/singlePlayer/maps/singlePlayerModeConfigMap";
import SinglePlayerStep from "../../shared/singlePlayer/types/singlePlayerStep";
import UserCommandSignal from "../../shared/user/types/userCommandSignal";
import SocketsClient from "../networking/client/socketsClient";
import { singlePlayerObservable } from "../system/clientObservables";
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
        for (const action of stepByName[prevStep].actionsOnEnd)
            SinglePlayerActionMap[action.type](action as any);
        prevStep = "";
    }

    if (v.step != "") // If the new step exists, start it.
    {
        // Start new step
        for (const action of stepByName[v.step].actionsOnStart)
            SinglePlayerActionMap[action.type](action as any);
        prevStep = v.step;
    }

    if (shouldFinishMode)
    {
        SocketsClient.emitUserCommandSignal(new UserCommandSignal("finishSinglePlayerMode"));
        singlePlayerObservable.set({mode: "", step: ""});
    }
});

export default SinglePlayerManager;