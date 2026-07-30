import { useEffect } from "react";
import useTrackedElementRect from "../../util/trackedElementRect";

const TOOLTIP_WIDTH_PX = 240; // fixed, so the panel can be kept on screen without being measured first
const TOOLTIP_GAP_PX = 10; // gap between the panel's pointer and the anchor's edge
const SCREEN_MARGIN_PX = 8; // how close to the viewport's edge the panel may sit

// An explanatory panel that hangs off the control it was opened from — a "?" button beside a
// section title, say — and points back at it. Whatever renders it owns the open/closed state and
// tells it which element to hang off (by DOM element id), what to say, and what to do when it is
// dismissed, so the panel itself knows nothing about the feature being explained.
//
// It is placed the way a coach mark is (see ScreenCoachMark): below an anchor sitting in the upper
// half of the screen and above one in the lower half, pulled inward when it would otherwise hang
// off the edge of the viewport while its pointer stays on the anchor, and following the anchor as
// the layout shifts. Its position is viewport-fixed rather than page-absolute, so that it can be
// rendered from within a scrolling panel — a form, typically — without being cut off by it.
//
// The next click anywhere on the screen takes the panel down, the panel's own area included —
// unlike a coach mark, which is passed through, this one takes the click that dismisses it, so that
// reaching for a panel the user is done reading cannot also work whatever the panel is covering. A
// click on the anchor itself is left alone: that click is the caller's own toggle closing the
// panel, and dismissing it here as well would only close it in time for the toggle to reopen it.
export default function TooltipPanel({targetElementId, text, onDismiss}: Props)
{
    useEffect(() => {
        const dismiss = (event: MouseEvent) => {
            const anchor = document.getElementById(targetElementId);
            if (anchor && event.target instanceof Node && anchor.contains(event.target))
                return;
            onDismiss();
        };
        // Dismissing on the click rather than on the press is what keeps the panel from being
        // clicked through: leaving on the press would take the panel out of the way before the
        // click that follows is hit-tested, handing that click to whatever the panel was covering.
        // Listening during the capture phase keeps the panel from dismissing itself, since the
        // click that opened it has long passed this point by the time the listener goes on, and it
        // means a click that something else swallows still counts.
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
        {/* The pointer is a square rotated into a diamond, half of it tucked behind the panel
            so that only the half sticking out — a triangle aimed at the anchor — is seen. */}
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
