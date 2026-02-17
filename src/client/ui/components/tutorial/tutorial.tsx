import { useEffect, useState } from "react";
import TutorialMoveInstruction from "./tutorialMoveInstruction";
import { ongoingClientProcessExists } from "../../../system/types/clientProcess";
import { ongoingClientProcessesObservable } from "../../../system/clientObservables";
import GameSocketsClient from "../../../networking/client/gameSocketsClient";
import UserCommandParams from "../../../../shared/user/types/userCommandParams";
import User from "../../../../shared/user/types/user";
import { LAST_TUTORIAL_STEP, TUTORIAL_DONE_STEP } from "../../../../shared/system/sharedConstants";

export default function Tutorial({user}: Props)
{
    const [state, setState] = useState<TutorialState>({loading: true, step: user.tutorialStep});

    useEffect(() => {
        ongoingClientProcessesObservable.addListener("ui.tutorial", _ => setState({
            ...state,
            loading: ongoingClientProcessExists()
        }));
        return () => {
            ongoingClientProcessesObservable.removeListener("ui.tutorial");
        };
    }, []);

    const incrementTutorialStep = () => {
        const newStep = (state.step >= LAST_TUTORIAL_STEP)
            ? TUTORIAL_DONE_STEP
            : state.step + 1;
        setState({...state, step: newStep});
        GameSocketsClient.emitUserCommand(new UserCommandParams(`tutorialStep ${newStep}`));
    };

    return <>
        {!state.loading && state.step == 0 &&
            <TutorialMoveInstruction incrementTutorialStep={incrementTutorialStep}/>}
    </>;
}

interface TutorialState
{
    loading: boolean;
    step: number;
}

interface Props
{
    user: User;
}