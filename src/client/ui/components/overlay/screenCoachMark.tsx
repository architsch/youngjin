import useTrackedElementRect from "../../util/trackedElementRect";
import CoachMark from "../../types/coachMark";

const COACH_MARK_WIDTH_PX = 176; // fixed, so the bubble can be kept on screen without being measured first
const COACH_MARK_GAP_PX = 10; // gap between the bubble's pointer and the target's edge
const SCREEN_MARGIN_PX = 8; // how close to the viewport's edge the bubble may sit

// A coach mark bubble pointing at a DOM element (see FTUEUtil). Tracks its target and draws nothing
// while the target is off screen (it stays up until removed). Placed on whichever side has room and
// clamped to the viewport. Ignores pointer events and sits below popups.
export default function ScreenCoachMark({coachMark}: {coachMark: CoachMark})
{
    const {ftueElementCode, targetElementId, text} = coachMark;

    const rect = useTrackedElementRect(targetElementId);
    if (!rect)
        return null;

    const targetCenterX = rect.left + rect.width * 0.5;
    const left = Math.min(
        Math.max(targetCenterX - COACH_MARK_WIDTH_PX * 0.5, SCREEN_MARGIN_PX),
        Math.max(window.innerWidth - COACH_MARK_WIDTH_PX - SCREEN_MARGIN_PX, SCREEN_MARGIN_PX));
    const pointerLeft = targetCenterX - left;
    const showBelowTarget = rect.top + rect.height * 0.5 < window.innerHeight * 0.5;

    return <div className={`absolute z-30 px-3 py-2 text-sm font-semibold text-center leading-tight text-gray-900 bg-amber-400 rounded-md drop-shadow-lg pointer-events-none ${showBelowTarget ? "" : "-translate-y-full"}`}
        style={{
            left: left,
            top: showBelowTarget ? rect.bottom + COACH_MARK_GAP_PX : rect.top - COACH_MARK_GAP_PX,
            width: COACH_MARK_WIDTH_PX,
        }}>
        {/* Pointer: a rotated square half-hidden behind the bubble, showing a triangle. */}
        <div className="absolute size-3 -ml-1.5 rotate-45 bg-amber-400"
            style={showBelowTarget ? { left: pointerLeft, top: -4 } : { left: pointerLeft, bottom: -4 }}/>
        {text}
    </div>;
}
