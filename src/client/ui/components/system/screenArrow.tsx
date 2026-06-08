import { useEffect, useState } from "react";
import { screenArrowTargetObservable } from "../../../system/clientObservables";
import useTrackedElementRect from "../../util/trackedElementRect";

const ARROW_GAP_PX = 8; // gap between the arrow's tip and the target's top edge

// A 2D arrow overlay that hovers just above a target UI element and points down at it,
// bouncing to draw attention. The target is identified by its DOM element id, which is
// supplied via screenArrowTargetObservable; the arrow tracks the element as it moves.
export default function ScreenArrow()
{
    const [targetId, setTargetId] = useState<string | null>(null);

    useEffect(() => {
        screenArrowTargetObservable.addListener("ui.screenArrow", setTargetId);
        return () => screenArrowTargetObservable.removeListener("ui.screenArrow");
    }, []);

    const rect = useTrackedElementRect(targetId);
    if (!rect) return null;

    return <div className="absolute z-50 w-8 h-8 -translate-x-1/2 -translate-y-full animate-bounce pointer-events-none drop-shadow-lg"
        style={{ left: rect.left + rect.width / 2, top: rect.top - ARROW_GAP_PX }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-amber-400">
            <line x1="12" y1="3" x2="12" y2="18"/>
            <path d="M6 12 L12 19 L18 12"/>
        </svg>
    </div>;
}
