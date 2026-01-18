import { useEffect, useState } from "react";
import TutorialMoveInstruction from "./tutorialMoveInstruction";
import { ongoingClientProcessExists } from "../../../system/types/clientProcess";
import { ongoingClientProcessesObservable } from "../../../system/clientObservables";

export default function Tutorial()
{
    const [state, setState] = useState<TutorialState>({loading: true, step: 0});

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
        setState({...state, step: state.step + 1});
    };

    return <>
        {/*!state.loading && state.step == 0 &&
            <TutorialMoveInstruction incrementTutorialStep={incrementTutorialStep}/>*/}
    </>;
}

interface TutorialState
{
    loading: boolean;
    step: number;
}