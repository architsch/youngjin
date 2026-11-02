import { screenCoachMarksObservable } from "../../system/clientObservables";
import CoachMark from "../types/coachMark";

const DURATION_MS = 3000;

let shown: CoachMark | undefined = undefined;
let timeout: ReturnType<typeof setTimeout> | undefined = undefined;
let numShowings = 0;

// Says why a click came to nothing, right where it was made: a coach mark over what was clicked, gone after a moment or by
// its x. One at a time, each coming in afresh, so that clicking again is answered again.
const RefusalCoachMarkUtil =
{
    show: (targetElementId: string, text: string): void =>
    {
        RefusalCoachMarkUtil.hide();
        const coachMark: CoachMark = {targetElementId, text, refusal: true, showing: ++numShowings,
            onDismiss: RefusalCoachMarkUtil.hide};
        shown = coachMark;
        screenCoachMarksObservable.change(coachMarks => [...coachMarks, coachMark]);
        timeout = setTimeout(RefusalCoachMarkUtil.hide, DURATION_MS);
    },
    hide: (): void =>
    {
        clearTimeout(timeout);
        const coachMark = shown;
        shown = undefined;
        if (coachMark != undefined)
            screenCoachMarksObservable.change(coachMarks => coachMarks.filter(mark => mark != coachMark));
    },
}

export default RefusalCoachMarkUtil;
