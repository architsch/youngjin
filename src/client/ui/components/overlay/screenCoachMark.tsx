import useTrackedElementRect from "../../util/trackedElementRect";
import CoachMark from "../../types/coachMark";

const COACH_MARK_WIDTH_PX = 176; // fixed, so the bubble can be kept on screen without being measured first
const COACH_MARK_GAP_PX = 10; // gap between the bubble's pointer and the target's edge
const SCREEN_MARGIN_PX = 8; // how close to the viewport's edge the bubble may sit

// A small text bubble that sits next to a target UI element and points at it, telling a first-time
// user what that control is for (see FTUEUtil). One of these is rendered per mark that is up (see
// ScreenCoachMarks), and each is on its own: it tracks its own target as that element moves, keeps
// its own clock, and disappears once it has had its say — or right away if the target isn't on
// screen (e.g. the menu holding it was closed), since a mark pointing at nothing says nothing.
//
// The bubble is placed on whichever side of the target has room for it: below a control near the
// top of the screen, above one near the bottom. It is pulled inward when it would otherwise hang
// off the edge of the viewport, while its pointer stays on the target. It ignores pointer events,
// and it is layered below popups, so the user can operate the coached control right through it and
// whatever that control opens covers it.
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
        {/* The pointer is a square rotated into a diamond, half of it tucked behind the bubble
            so that only the half sticking out — a triangle aimed at the target — is seen. */}
        <div className="absolute size-3 -ml-1.5 rotate-45 bg-amber-400"
            style={showBelowTarget ? { left: pointerLeft, top: -4 } : { left: pointerLeft, bottom: -4 }}/>
        {text}
    </div>;
}
