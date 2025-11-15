import { useState } from "react";
import TutorialMoveInstruction from "./tutorialMoveInstruction";

export default function Tutorial()
{
    const [state, setState] = useState<TutorialState>({step: 0});

    const incrementTutorialStep = () => {
        setState({step: state.step + 1});
    };

    return <>
        {state.step == 0 && <TutorialMoveInstruction incrementTutorialStep={incrementTutorialStep}/>}
    </>;
}

interface TutorialState
{
    step: number;
}