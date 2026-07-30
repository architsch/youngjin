import { FTUEElementCode } from "./ftueElementCode";

export default interface CoachMark
{
    ftueElementCode: FTUEElementCode; // the feature the mark advertises (also the mark's identity)
    targetElementId: string; // DOM element id of the control the mark points at
    text: string; // the single line of guidance shown in the bubble
}
