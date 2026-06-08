import SinglePlayerAction from "./singlePlayerAction";
import SinglePlayerStepTransitionRule from "./singlePlayerStepTransitionRule";

export default interface SinglePlayerStep
{
    actionsOnStart: SinglePlayerAction[];
    transitionRules: SinglePlayerStepTransitionRule[];
    actionsOnEnd: SinglePlayerAction[];
}