import { useEffect, useState } from "react";
import TutorialMoveInstruction from "./tutorialMoveInstruction";
import { ongoingClientProcessExists } from "../../../system/types/clientProcess";
import { ongoingClientProcessesObservable } from "../../../system/clientObservables";
import GameSocketsClient from "../../../networking/client/gameSocketsClient";
import UserCommandParams from "../../../../shared/user/types/userCommandParams";
import User from "../../../../shared/user/types/user";
import { UserTypeEnumMap } from "../../../../shared/user/types/userType";
import { getCookie, setCookie } from "typescript-cookie";
import { GUEST_TUTORIAL_STEP_COOKIE_NAME } from "../../../../shared/system/sharedConstants";

export default function Tutorial({user}: Props)
{
    let initialTutorialStep = 0;
    if (user.userType == UserTypeEnumMap.Guest)
    {
        const cookie = getCookie(GUEST_TUTORIAL_STEP_COOKIE_NAME);
        if (cookie)
        {
            initialTutorialStep = parseInt(cookie);
            if (isNaN(initialTutorialStep))
            {
                initialTutorialStep = 0;
                console.error(`Failed to parse tutorial step from cookie for guest user (cookie: ${cookie})`);
            }
        }
        else
        {
            initialTutorialStep = 0;
            setCookie(GUEST_TUTORIAL_STEP_COOKIE_NAME, initialTutorialStep.toString(), {expires: 3});
        }
    }
    else
    {
        initialTutorialStep = user.tutorialStep;
    }

    const [state, setState] = useState<TutorialState>({loading: true, step: initialTutorialStep});

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
        const newStep = state.step + 1;
        setState({...state, step: newStep});

        if (user.userType == UserTypeEnumMap.Guest)
            setCookie(GUEST_TUTORIAL_STEP_COOKIE_NAME, newStep.toString(), {expires: 3});
        else
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