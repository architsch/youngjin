import { useEffect, useState } from "react";
import { screenCoachMarksObservable } from "../../../system/clientObservables";
import CoachMark from "../../types/coachMark";
import ScreenCoachMark from "./screenCoachMark";

// Renders all active coach marks side by side (marks from different UIs can overlap in time), keyed
// by element so each keeps its own position and lifetime.
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
