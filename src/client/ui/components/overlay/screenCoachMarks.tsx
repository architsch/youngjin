import { useEffect, useState } from "react";
import { screenCoachMarksObservable } from "../../../system/clientObservables";
import CoachMark from "../../types/coachMark";
import ScreenCoachMark from "./screenCoachMark";

// The layer holding every coach mark that is currently up (see FTUEUtil). Because a mark is
// triggered by whatever UI happens to own its control, two of them can easily fall due at once, or
// one while another is still being read; rendering them side by side is what keeps the newcomer
// from taking the older mark's place. Each mark is keyed by the feature it advertises, so the ones
// already on screen keep their own position and lifetime as marks come and go around them, and a
// mark that appeared later is drawn on top should the two ever overlap.
export default function ScreenCoachMarks()
{
    const [coachMarks, setCoachMarks] = useState<CoachMark[]>([]);

    useEffect(() => {
        screenCoachMarksObservable.addListener("ui.screenCoachMarks", setCoachMarks);
        return () => screenCoachMarksObservable.removeListener("ui.screenCoachMarks");
    }, []);

    return <>
        {coachMarks.map(coachMark => <ScreenCoachMark key={coachMark.ftueElementCode} coachMark={coachMark}/>)}
    </>;
}
