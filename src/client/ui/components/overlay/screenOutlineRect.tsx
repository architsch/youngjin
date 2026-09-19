import { useEffect, useState } from "react";
import { screenOutlineRectTargetObservable } from "../../../system/clientObservables";
import useTrackedElementRect from "../../util/trackedElementRect";

const OUTLINE_PADDING_PX = 2; // how far outside the target's edges the outline sits

// Pulsing rectangle outline around a DOM element (screenOutlineRectTargetObservable). Tracks the element.
export default function ScreenOutlineRect()
{
    const [targetId, setTargetId] = useState<string | null>(null);

    useEffect(() => {
        screenOutlineRectTargetObservable.addListener("ui.screenOutlineRect", setTargetId);
        return () => screenOutlineRectTargetObservable.removeListener("ui.screenOutlineRect");
    }, []);

    const rect = useTrackedElementRect(targetId, true);
    if (!rect) return null;

    return <div className="absolute z-50 box-border rounded-md border-4 border-amber-400 animate-pulse-strong pointer-events-none"
        style={{
            left: rect.left - OUTLINE_PADDING_PX,
            top: rect.top - OUTLINE_PADDING_PX,
            width: rect.width + 2 * OUTLINE_PADDING_PX,
            height: rect.height + 2 * OUTLINE_PADDING_PX,
        }}/>;
}
