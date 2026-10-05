import { ReactNode, RefObject, useCallback, useEffect, useRef } from "react";
import IconButton from "../input/iconButton";
import CloseIcon from "../../svg/icons/closeIcon";
import useMouseDragScroll from "../../util/mouseDragScroll";
import useTrackedElementRect from "../../util/trackedElementRect";
import ClosablePanelUtil from "../../util/closablePanelUtil";

// Shared shell for bottom panels: a horizontally scrolling tray sized to its contents, covering only
// itself so the room stays visible. Normally laid out by its owner. A panel raised from a toggle inside
// another panel (anchorElementId) instead hangs just above that toggle, right-aligned to it within the
// screen. With onClose it gets a close button and joins the back-gesture stack (see ClosablePanelUtil).

export default function ScrollPanel({ children, id, onClose, closeRowContent, anchorElementId, size = "md",
    tight = false, overhang = false, scrollerRef, onScroll, additionalClassNames = "" }: Props)
{
    const onRefChange = useMouseDragScroll("horizontal", "alwaysGrab");
    const setScroller = useCallback((node: HTMLDivElement | null) => {
        onRefChange(node);
        if (scrollerRef)
            scrollerRef.current = node;
    }, [onRefChange, scrollerRef]);
    const anchorRect = useTrackedElementRect(anchorElementId ?? null);
    const anchored = anchorElementId != undefined;

    // A ref keeps one closable-panel registration while still calling the latest onClose.
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const closable = onClose != undefined;

    useEffect(() => {
        if (!closable)
            return;
        const token = ClosablePanelUtil.register(() => onCloseRef.current?.());
        return () => ClosablePanelUtil.unregister(token);
    }, [closable]);

    // Close button sits above the panel, so the panel is only as tall as its controls. The body fits its
    // contents up to the column's width, past which the row scrolls (children are shrink-0; see
    // SelectionToolRow). Fitting the column instead would let an owner's margins overflow. A tight row
    // holds the panel's padding itself, so it scrolls under it.
    const rowClassNames = `flex flex-row items-stretch ${tight ? "gap-2 p-2" : "gap-3"}`;
    const closeButton = closable && <IconButton id={id ? `${id}Close` : undefined} icon={<CloseIcon/>} size="sm"
        onClick={() => onCloseRef.current?.()}/>;
    const panel = <div className={`flex flex-col gap-1 items-start min-w-0 ${anchored ? "w-fit max-w-full shrink-0" : ""} ${additionalClassNames}`}>
        {closeRowContent
            ? <div className="flex flex-row items-center gap-3 w-full">
                {closeButton}
                {closeRowContent}
            </div>
            : closeButton}
        <div id={id} className={`${tight ? "" : "p-2"} flex flex-col w-fit max-w-full ${maxHeightClassNames[size]} bg-gray-700 rounded-lg pointer-events-auto yj-surface-convex`}>
            {overhang
                // The scroller clips, so it reaches up past the panel's edge; only the row inside it takes
                // pointer input, which keeps that extra room click-through.
                ? <div ref={setScroller} onScroll={onScroll}
                    className="w-full min-h-0 -mt-6 pt-6 overflow-auto no-scrollbar pointer-events-none">
                    <div className={`${rowClassNames} w-max pointer-events-auto`}>
                        {children}
                    </div>
                </div>
                : <div ref={setScroller} onScroll={onScroll}
                    className={`${rowClassNames} w-full min-h-0 overflow-auto no-scrollbar`}>
                    {children}
                </div>}
        </div>
    </div>;

    if (!anchored)
        return panel;

    // Hidden until the anchor is measured, to avoid flashing elsewhere.
    if (anchorRect == null)
        return null;

    // A frame from the screen top to just above the toggle, with the panel at its foot (no height
    // measuring needed) and a right spacer matching the toggle's right offset; the spacer shrinks
    // first when space runs out. The frame ignores pointer input.
    return <div className="fixed top-0 z-10 flex flex-row justify-end items-end pointer-events-none"
        style={{left: SCREEN_MARGIN_PX, right: SCREEN_MARGIN_PX, height: Math.max(0, anchorRect.top - ANCHOR_GAP_PX)}}>
        {panel}
        <div className="min-w-0" style={{width: `calc(100% - ${anchorRect.right - SCREEN_MARGIN_PX}px)`}}/>
    </div>;
}

// Max heights before scrolling; the taller cap is for content that must be seen whole (e.g. room plan).
const maxHeightClassNames = {
    md: "max-h-[30vh]",
    lg: "max-h-[50vh]",
};

// Gap between an anchored panel and its toggle.
const ANCHOR_GAP_PX = 4;

// Screen-side margin for anchored panels.
const SCREEN_MARGIN_PX = 8;

interface Props
{
    children: ReactNode;
    // The panel body's DOM id (for tutorial steps and coach marks). Its close button's is the same followed by
    // "Close" (e.g. "lampSizeOptionsClose"), for automation.
    id?: string;
    // Adds a close button and back-gesture support.
    onClose?: () => void;
    // A row over the panel (e.g. a search bar), which follows the close button if there is one.
    closeRowContent?: ReactNode;
    // Toggle to hang from (see above).
    anchorElementId?: string;
    size?: "md" | "lg";
    // Stands the children closer together and scrolls them under the panel's padding, not inside it, so
    // what one draws around itself (e.g. a highlight outline) isn't clipped.
    tight?: boolean;
    // Lets children stick out over the panel's top edge (e.g. entry badges) without making it taller.
    overhang?: boolean;
    // The element that scrolls, and a call each time it does (e.g. to keep where it stands; see ThumbnailPanel).
    scrollerRef?: RefObject<HTMLDivElement | null>;
    onScroll?: () => void;
    additionalClassNames?: string;
}
