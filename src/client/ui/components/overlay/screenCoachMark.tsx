import useTrackedElementRect from "../../util/trackedElementRect";
import CoachMark from "../../types/coachMark";
import CloseIcon from "../../svg/icons/closeIcon";

const COACH_MARK_WIDTH_PX = 176; // fixed, so the bubble can be kept on screen without being measured first
const CLOSABLE_COACH_MARK_WIDTH_PX = 200; // with room for its x beside the text
const COACH_MARK_GAP_PX = 10; // gap between the bubble's pointer and the target's edge
const SCREEN_MARGIN_PX = 8; // how close to the viewport's edge the bubble may sit

// A coach mark bubble pointing at a DOM element (see FTUEUtil). Tracks its target and draws nothing
// while the target is off screen (it stays up until removed). Placed on whichever side has room and
// clamped to the viewport. Ignores pointer events, but for any button of its own, and sits below popups,
// but for a refusal's, which is always above what was clicked, and whatever that lies in.
export default function ScreenCoachMark({coachMark}: {coachMark: CoachMark})
{
    const {targetElementId, text, reward, refusal, button, onDismiss} = coachMark;

    const rect = useTrackedElementRect(targetElementId);
    if (!rect)
        return null;

    const width = onDismiss ? CLOSABLE_COACH_MARK_WIDTH_PX : COACH_MARK_WIDTH_PX;
    const targetCenterX = rect.left + rect.width * 0.5;
    const left = Math.min(
        Math.max(targetCenterX - width * 0.5, SCREEN_MARGIN_PX),
        Math.max(window.innerWidth - width - SCREEN_MARGIN_PX, SCREEN_MARGIN_PX));
    const pointerLeft = targetCenterX - left;
    const showBelowTarget = !refusal && rect.top + rect.height * 0.5 < window.innerHeight * 0.5;
    const color = reward ? "bg-green-300" : "bg-amber-400";
    // These tell of dollars, and the UI's monospace has a slashed zero.
    const font = (reward || refusal) ? "font-sans" : "";

    return <div data-coach-mark className={`absolute ${refusal ? "z-60" : "z-30"} pl-3 ${onDismiss ? "pr-7" : "pr-3"} py-2 text-sm font-semibold ${font} text-center ${button ? "leading-normal" : "leading-tight"} whitespace-pre-line text-gray-900 ${color} rounded-md drop-shadow-lg pointer-events-none ${showBelowTarget ? "" : "-translate-y-full"} ${reward ? "animate-coach-mark-reward" : ""} ${refusal ? "animate-coach-mark-refusal" : ""}`}
        style={{
            left: left,
            top: showBelowTarget ? rect.bottom + COACH_MARK_GAP_PX : rect.top - COACH_MARK_GAP_PX,
            width: width,
            transformOrigin: `${pointerLeft}px ${showBelowTarget ? "0" : "100%"}`,
        }}>
        {/* Pointer: a rotated square half-hidden behind the bubble, showing a triangle. */}
        <div className={`absolute size-3 -ml-1.5 rotate-45 ${color}`}
            style={showBelowTarget ? { left: pointerLeft, top: -4 } : { left: pointerLeft, bottom: -4 }}/>
        {button && <><span className="yj-link-button" onClick={button.onClick}>{button.label}</span>{" "}</>}
        {text}
        {/* The icon's cross is half its width, in a corner, with room around it for a finger. */}
        {onDismiss && <span className="absolute -top-2 -right-2 size-10 p-2 cursor-pointer pointer-events-auto" onClick={onDismiss}>
            <CloseIcon/>
        </span>}
    </div>;
}
