import { useEffect, useState } from "react";
import { screenOutlineRectTargetObservable } from "../../../system/clientObservables";
import useTrackedElementRect from "../../util/trackedElementRect";

const OUTLINE_PADDING_PX = 6; // how far outside the target's edges the outline sits

// A 2D rectangular outline overlay that surrounds a target UI element to highlight it,
// pulsing gently to draw attention. The target is identified by its DOM element id, which
// is supplied via screenOutlineRectTargetObservable; the outline tracks the element as it moves.
export default function ScreenOutlineRect()
{
    const [targetId, setTargetId] = useState<string | null>(null);

    useEffect(() => {
        screenOutlineRectTargetObservable.addListener("ui.screenOutlineRect", setTargetId);
        return () => screenOutlineRectTargetObservable.removeListener("ui.screenOutlineRect");
    }, []);

    const rect = useTrackedElementRect(targetId);
    if (!rect) return null;

    return <div className="absolute z-50 box-border rounded-md border-2 border-amber-400 animate-pulse pointer-events-none"
        style={{
            left: rect.left - OUTLINE_PADDING_PX,
            top: rect.top - OUTLINE_PADDING_PX,
            width: rect.width + 2 * OUTLINE_PADDING_PX,
            height: rect.height + 2 * OUTLINE_PADDING_PX,
        }}/>;
}
