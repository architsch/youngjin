import { useEffect } from "react";
import useTrackedElementRect from "../../util/trackedElementRect";

const TOOLTIP_WIDTH_PX = 240; // fixed, so the panel can be kept on screen without being measured first
const TOOLTIP_GAP_PX = 10; // gap between the panel's pointer and the anchor's edge
const SCREEN_MARGIN_PX = 8; // how close to the viewport's edge the panel may sit

// Explanatory panel anchored to a control (by DOM id), placed like a coach mark (see ScreenCoachMark)
// but viewport-fixed so scrolling containers can't clip it. The caller owns open state. The next click
// anywhere dismisses it and is consumed (so it can't activate what's underneath); clicks on the anchor
// are left to the caller's toggle.
export default function TooltipPanel({targetElementId, text, onDismiss}: Props)
{
    useEffect(() => {
        const dismiss = (event: MouseEvent) => {
            const anchor = document.getElementById(targetElementId);
            if (anchor && event.target instanceof Node && anchor.contains(event.target))
                return;
            onDismiss();
        };
        // Dismiss on click (not press), so the click can't fall through to what the panel covered.
        // Capture phase also sees clicks that others swallow.
        document.addEventListener("click", dismiss, true);
        return () => document.removeEventListener("click", dismiss, true);
    }, [targetElementId, onDismiss]);

    const rect = useTrackedElementRect(targetElementId);
    if (!rect)
        return null;

    const anchorCenterX = rect.left + rect.width * 0.5;
    const left = Math.min(
        Math.max(anchorCenterX - TOOLTIP_WIDTH_PX * 0.5, SCREEN_MARGIN_PX),
        Math.max(window.innerWidth - TOOLTIP_WIDTH_PX - SCREEN_MARGIN_PX, SCREEN_MARGIN_PX));
    const pointerLeft = anchorCenterX - left;
    const showBelowAnchor = rect.top + rect.height * 0.5 < window.innerHeight * 0.5;

    return <div className={`fixed z-50 px-3 py-2 text-sm text-left leading-snug text-gray-800 bg-gray-100 rounded-md drop-shadow-lg pointer-events-auto ${showBelowAnchor ? "" : "-translate-y-full"}`}
        style={{
            left: left,
            top: showBelowAnchor ? rect.bottom + TOOLTIP_GAP_PX : rect.top - TOOLTIP_GAP_PX,
            width: TOOLTIP_WIDTH_PX,
        }}>
        {/* Pointer: a rotated square half-hidden behind the panel, showing a triangle. */}
        <div className="absolute size-3 -ml-1.5 rotate-45 bg-gray-100"
            style={showBelowAnchor ? { left: pointerLeft, top: -4 } : { left: pointerLeft, bottom: -4 }}/>
        {text}
    </div>;
}

interface Props
{
    targetElementId: string; // DOM element id of the control the panel hangs off and points at
    text: string; // what the panel has to say
    onDismiss: () => void; // called when the user presses anywhere other than the anchor
}
