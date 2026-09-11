import { ReactNode, useEffect, useRef } from "react";
import IconButton from "../input/iconButton";
import CloseIcon from "../../svg/icons/closeIcon";
import useMouseDragScroll from "../../util/mouseDragScroll";
import useTrackedElementRect from "../../util/trackedElementRect";
import ClosablePanelUtil from "../../util/closablePanelUtil";

//------------------------------------------------------------------------
// A tray of controls at the foot of the screen that scrolls sideways when it holds more than fits:
// the shell every panel here shares — a character's parts, a door's colours, a room's settings. It is
// to a panel what Form is to a popup: each panel supplies its contents and hands them to this.
//
// Unlike a popup it covers nothing but itself. The room stays in view and live behind it, which is
// the reason to have panels at all: nearly everything they hold is judged by looking at the room
// while it changes, and a popup would cover the very thing being adjusted.
//
// Where it stands is its owner's business, since what the panel belongs to decides that — a door's
// colours stack above the door's own tools, a room's settings along the bottom edge — so it is laid
// out in the flow like anything else rather than placing itself.
//
// The exception is a panel raised by a toggle inside another panel, such as one of a room's settings
// opened from the row that names them. Laid out in the flow, it would have to stand above the whole
// of the panel it came from, that panel's close button included, leaving a band of the room between
// the two covered for nothing. So its owner names the toggle instead, and the panel hangs from it:
// its foot just clear of the toggle's top edge, following the toggle wherever the layout takes it.
// Such a panel is only as wide as what it holds, and stands over the entry it was raised from — its
// right edge at the toggle's own, pushed back in wherever that would carry it off the screen — so
// that it reads as coming from that toggle and covers no more of the room than it has to. Whatever
// of the panel below it does cover, close button included, costs nothing: it is the one being
// worked with, and the first to be put away.
//
// A panel given a way to close is one the user can put away: it carries a close button, and it is
// among the panels the back gesture puts away first (see ClosablePanelUtil). A panel given none is a
// part of whatever raised it — the character's parts are what the character being selected looks
// like — and has neither.
//------------------------------------------------------------------------

export default function ScrollPanel({ children, id, onClose, anchorElementId, size = "md", additionalClassNames = "" }: Props)
{
    const onRefChange = useMouseDragScroll("horizontal", "alwaysGrab");
    const anchorRect = useTrackedElementRect(anchorElementId ?? null);
    const anchored = anchorElementId != undefined;

    // Held in a ref, so that the panel stays one entry on the list of closable panels for as long as
    // it is up while still calling whatever its owner handed in last.
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const closable = onClose != undefined;

    useEffect(() => {
        if (!closable)
            return;
        const token = ClosablePanelUtil.register(() => onCloseRef.current?.());
        return () => ClosablePanelUtil.unregister(token);
    }, [closable]);

    // The close button stands above the panel rather than inside it, so the panel is exactly as tall
    // as the controls it holds — a slab of background reaching up past them to enclose a button reads
    // as a panel with a gap in it.
    //
    // The row takes the width it is given rather than shrinking to its contents, since scrolling
    // sideways is the whole point of it: a row sized to its widest child would grow to fit that child
    // and leave itself nothing to scroll within. What it holds is expected to keep its own width
    // (`shrink-0`) for the same reason (see SelectionToolRow). A panel hanging from a toggle sizes
    // itself to its contents instead (see above), and so gives the row exactly what it holds, up to
    // the width of the screen.
    const panel = <div className={`flex flex-col gap-1 items-start min-w-0 ${anchored ? "w-fit max-w-full shrink-0" : ""} ${additionalClassNames}`}>
        {closable && <IconButton icon={<CloseIcon/>} size="sm" onClick={() => onCloseRef.current?.()}/>}
        <div id={id} className={`p-2 flex flex-col w-full ${maxHeightClassNames[size]} bg-gray-700 rounded-lg pointer-events-auto yj-surface-convex`}>
            <div ref={onRefChange} className="flex flex-row items-stretch gap-3 w-full min-h-0 overflow-auto no-scrollbar">
                {children}
            </div>
        </div>
    </div>;

    if (!anchored)
        return panel;

    // Nothing is drawn until the toggle has been found, so that the panel never flashes up anywhere
    // but where it hangs.
    if (anchorRect == null)
        return null;

    // A frame reaching from the top of the screen down to just above the toggle, with the panel
    // standing at its foot — which is what lets the panel's foot be placed without first measuring
    // how tall the panel is. The same goes for its width: the panel is followed across the frame by a
    // gap as wide as the stretch from the toggle's right edge to the frame's, and stands against it,
    // so that its right edge meets the toggle's. Where the panel is too wide for that, the gap is what
    // gives way, and the panel comes to rest against the frame's left edge rather than running off
    // it. The frame itself takes no input, so that the room behind it can still be dragged about;
    // only the panel does.
    return <div className="fixed top-0 z-10 flex flex-row justify-end items-end pointer-events-none"
        style={{left: SCREEN_MARGIN_PX, right: SCREEN_MARGIN_PX, height: Math.max(0, anchorRect.top - ANCHOR_GAP_PX)}}>
        {panel}
        <div className="min-w-0" style={{width: `calc(100% - ${anchorRect.right - SCREEN_MARGIN_PX}px)`}}/>
    </div>;
}

// How tall a panel may grow before its contents scroll instead. Most panels are a row of controls a
// finger's height or so; the taller cap is for a panel holding something that has to be seen whole to
// be worked with, like a room's plan, or a column of settings meant to be worked down without
// scrolling.
const maxHeightClassNames = {
    md: "max-h-[30vh]",
    lg: "max-h-[50vh]",
};

// How far above its toggle a panel hanging from one stands, in pixels: enough that the toggle is
// left untouched, and so still plainly the thing the panel came from, and no more.
const ANCHOR_GAP_PX = 4;

// How close to the sides of the screen a panel hanging from a toggle may come, in pixels — the same
// margin the panels along the bottom keep from them.
const SCREEN_MARGIN_PX = 8;

interface Props
{
    children: ReactNode;
    // DOM element id of the panel's body — what a tutorial step points at, and what a coach mark
    // hangs off.
    id?: string;
    // How the panel is put away. A panel given this carries a close button and answers the back
    // gesture; one given none is part of whatever raised it, and does neither.
    onClose?: () => void;
    // DOM element id of the toggle the panel hangs from, for a panel raised from inside another (see
    // above). A panel given none is laid out in the flow by its owner.
    anchorElementId?: string;
    size?: "md" | "lg";
    additionalClassNames?: string;
}
