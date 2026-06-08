import SinglePlayerCondition from "./singlePlayerCondition";

export default interface SinglePlayerStepTransitionRule
{
    requirements: SinglePlayerCondition[];
    nextStep: number; // -1 if no next step exists (i.e. Current step is the final step)
    nextStepDelay: number; // in milliseconds
}