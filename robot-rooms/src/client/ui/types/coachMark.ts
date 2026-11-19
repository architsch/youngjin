import { FTUEElementCode } from "../../../shared/user/types/ftueElementCode";

export default interface CoachMark
{
    ftueElementCode?: FTUEElementCode; // the feature the mark advertises, if it does (also the mark's identity)
    showing?: number; // tells a mark from the last with the same text, so that it comes in afresh
    targetElementId: string; // DOM element id of the control the mark points at
    text: string; // the guidance shown in the bubble, a line break where one is wanted
    reward?: boolean; // tells of something given, not a feature: green, and bouncing as it comes
    refusal?: boolean; // says why a click came to nothing: over what was clicked, even a grid, in a bounce of red light
    button?: {label: string, onClick: () => void}; // a button ahead of the text, which it reads on from
    onDismiss?: () => void; // gives the mark an x in its corner, for one that stays until closed
}
