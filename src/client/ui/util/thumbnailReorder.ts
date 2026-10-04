import { PointerEvent as ReactPointerEvent, RefObject, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { MOUSE_DRAG_THRESHOLD_PX, THUMBNAIL_REORDER_HOLD_MS, TOUCH_DRAG_THRESHOLD_PX } from "../../system/clientConstants";

// How a thumbnail lifted off the row stands out from it: larger, and casting a shadow.
const LIFTED_SCALE = 1.1;
const LIFTED_SHADOW = "0 2px 8px rgba(0, 0, 0, 0.6)";

// How long the others take to make room, and a thumbnail let go to settle (in milliseconds).
const SHIFT_DURATION_MS = 150;

// How near either end of the row the pointer starts scrolling it, and how fast at the very end (CSS px per second).
const AUTO_SCROLL_EDGE_PX = 64;
const AUTO_SCROLL_MAX_SPEED = 1200;

// Lets a row's thumbnails be rearranged by hand, the way icons in a dock are (see ThumbnailPanel): one held still
// for a moment is picked up and follows the pointer along the row, the others making room where it would land, and
// it is put there when let go. A quicker drag still scrolls the row, and a quicker release is still a click.
// Returns what a thumbnail calls when a pointer goes down on it. onPickUp says whether the one picked up may be
// moved; one that may not stays where it is, and letting it go is no click either. Without it, nothing is picked up.
// onLetGo follows each pick-up, however it ends.
export default function useThumbnailReorder(rowId: string, scrollerRef: RefObject<HTMLDivElement | null>,
    onPickUp?: (position: number) => boolean, onDrop?: (from: number, to: number) => void, onLetGo?: () => void)
{
    // Refs keep one hold while still calling the latest of each.
    const onPickUpRef = useRef(onPickUp);
    onPickUpRef.current = onPickUp;
    const onDropRef = useRef(onDrop);
    onDropRef.current = onDrop;
    const onLetGoRef = useRef(onLetGo);
    onLetGoRef.current = onLetGo;
    // Ends the hold in progress, if any, putting nothing anywhere.
    const cancelRef = useRef<(() => void) | undefined>(undefined);
    const liftedRef = useRef(false);
    const enabled = onPickUp != undefined;

    useEffect(() => {
        const scroller = scrollerRef.current;
        if (!enabled || !scroller)
            return;
        // A finger's drag pans the row unless its move is refused, which only a listener there since the touch
        // began can do.
        const refuseWhileLifted = (event: TouchEvent) => {
            if (liftedRef.current)
                event.preventDefault();
        };
        scroller.addEventListener("touchmove", refuseWhileLifted, { passive: false });
        return () => {
            scroller.removeEventListener("touchmove", refuseWhileLifted);
            cancelRef.current?.();
        };
    }, [enabled]);

    return (event: ReactPointerEvent, position: number) => {
        const scroller = scrollerRef.current;
        if (!onPickUpRef.current || !scroller || event.button != 0 || !event.isPrimary)
            return;
        cancelRef.current?.();
        cancelRef.current = startHold(rowId, scroller, position, event.nativeEvent, liftedRef,
            from => onPickUpRef.current?.(from) ?? false, (from, to) => onDropRef.current?.(from, to),
            () => onLetGoRef.current?.(), () => cancelRef.current = undefined);
    };
}

// Returns the cancel, which ends the hold (or the drag it became) with nothing rearranged.
function startHold(rowId: string, scroller: HTMLElement, from: number, down: PointerEvent,
    liftedRef: {current: boolean}, onPickUp: (position: number) => boolean,
    onDrop: (from: number, to: number) => void, onLetGo: () => void, onEnd: () => void): () => void
{
    const listeners = new AbortController();
    const signal = listeners.signal;
    const maxTravel = (down.pointerType == "mouse") ? MOUSE_DRAG_THRESHOLD_PX : TOUCH_DRAG_THRESHOLD_PX;

    // Picked up once held long enough, and lifted with it to follow the pointer, unless it may not be moved.
    let pickedUp = false;
    let lifted = false;
    let clientX = down.clientX;
    // Where along the row's content the pointer took hold.
    let grabX = 0;
    let to = from;
    let frame = 0, frameTime = 0, scrollRemainder = 0;
    // How far each thumbnail was last moved, so its style is written only when that changes.
    const moves = new Map<HTMLElement, number>();

    // Addressed by position, as the row may gain a page of them meanwhile (see ThumbnailPanel).
    const getTiles = (): HTMLElement[] => {
        const tiles: HTMLElement[] = [];
        for (let tile = document.getElementById(`${rowId}.0`); tile; tile = document.getElementById(`${rowId}.${tiles.length}`))
            tiles.push(tile);
        return tiles;
    };

    // The lifted thumbnail under the pointer, and each of the others a slot aside once the lifted one's middle is
    // past its near edge. Measured where the row lays them out, which neither moving them nor scrolling changes.
    const layOut = () => {
        const tiles = getTiles();
        if (from >= tiles.length || tiles.length < 2)
            return;
        const lefts = tiles.map(tile => tile.offsetLeft), widths = tiles.map(tile => tile.offsetWidth);
        const spacing = lefts[1] - lefts[0] - widths[0];
        const slot = widths[from] + spacing;
        const last = tiles.length - 1;
        const offset = Math.max(lefts[0] - lefts[from], Math.min(lefts[last] + widths[last] - lefts[from] - widths[from],
            clientX + scroller.scrollLeft - grabX));
        const middle = lefts[from] + 0.5 * widths[from] + offset;

        to = from;
        tiles.forEach((tile, position) => {
            const shift = (position < from && middle < lefts[position] + widths[position] + 0.5 * spacing) ? slot
                : (position > from && middle > lefts[position] - 0.5 * spacing) ? -slot : 0;
            if (shift != 0)
                to = (shift > 0) ? Math.min(to, position) : Math.max(to, position);

            const move = (position == from) ? offset : shift;
            if (moves.get(tile) === move)
                return;
            moves.set(tile, move);
            if (position == from)
                setStyle(tile, `translateX(${offset}px) scale(${LIFTED_SCALE})`, "none", true);
            else
                setStyle(tile, (shift == 0) ? "" : `translateX(${shift}px)`, "transform", false);
        });
    };

    // Scrolls the row while the pointer is near either end of it, faster the nearer.
    const step = (time: number) => {
        const rect = scroller.getBoundingClientRect();
        const edge = Math.min(AUTO_SCROLL_EDGE_PX, 0.25 * rect.width);
        const depth = (clientX < rect.left + edge) ? (clientX - rect.left - edge) / edge
            : (clientX > rect.right - edge) ? (clientX - rect.right + edge) / edge : 0;
        const distance = Math.max(-1, Math.min(1, depth)) * AUTO_SCROLL_MAX_SPEED * Math.max(time - frameTime, 0) / 1000
            + scrollRemainder;
        scrollRemainder = distance - Math.trunc(distance);
        scroller.scrollLeft += Math.trunc(distance);
        frameTime = time;
        layOut();
        frame = requestAnimationFrame(step);
    };

    const pickUp = () => {
        pickedUp = true;
        if (!onPickUp(from))
            return;
        lifted = liftedRef.current = true;
        grabX = clientX + scroller.scrollLeft;
        frameTime = performance.now();
        // Nothing else follows the mouse meanwhile, the row's own drag-scrolling included (see useMouseDragScroll).
        window.addEventListener("mousemove", (event: MouseEvent) => {
            event.stopPropagation();
            event.preventDefault();
        }, { capture: true, signal });
        layOut();
        frame = requestAnimationFrame(step);
    };
    const holdTimer = window.setTimeout(pickUp, THUMBNAIL_REORDER_HOLD_MS);

    const end = (put: boolean) => {
        window.clearTimeout(holdTimer);
        cancelAnimationFrame(frame);
        listeners.abort();
        liftedRef.current = false;
        onEnd();
        if (pickedUp)
            onLetGo();
        // Letting it go is a click on it, which must choose nothing.
        if (pickedUp && put)
            swallowNextClick();
        if (!lifted)
            return;

        const tiles = getTiles();
        const dragged: HTMLElement | undefined = tiles[from];
        const heldAt = dragged ? getMiddle(dragged) : 0;
        // At once, so the row comes back rearranged before the others are let go of.
        if (put && to != from)
            flushSync(() => onDrop(from, to));
        for (const tile of tiles)
            setStyle(tile, "", "", false);
        if (!dragged?.isConnected)
            return;

        // From where it was let go to its place in the row.
        setStyle(dragged, `translateX(${heldAt - getMiddle(dragged)}px) scale(${LIFTED_SCALE})`, "none", true);
        dragged.getBoundingClientRect();
        setStyle(dragged, "", "transform", true);
        window.setTimeout(() => setStyle(dragged, "", "", false), SHIFT_DURATION_MS);
    };

    window.addEventListener("pointermove", (event: PointerEvent) => {
        if (event.pointerId != down.pointerId)
            return;
        clientX = event.clientX;
        // A mouse button let go where the page couldn't see it.
        if (pickedUp && event.pointerType == "mouse" && event.buttons == 0)
            end(true);
        else if (!pickedUp && Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY) > maxTravel)
            end(false);
    }, { signal });
    window.addEventListener("pointerup", (event: PointerEvent) => {
        if (event.pointerId == down.pointerId)
            end(true);
    }, { signal });
    window.addEventListener("pointercancel", (event: PointerEvent) => {
        if (event.pointerId == down.pointerId)
            end(false);
    }, { signal });
    // A finger held still would otherwise bring up the browser's own menu.
    if (down.pointerType != "mouse")
        window.addEventListener("contextmenu", (event: MouseEvent) => event.preventDefault(), { signal });

    return () => end(false);
}

// What slides is given by its longhand properties: the stylesheet's build makes a class of the shorthand's name
// wherever a scanned file writes it.
function setStyle(tile: HTMLElement, transform: string, sliding: "transform" | "none" | "", lifted: boolean): void
{
    tile.style.transform = transform;
    tile.style.transitionProperty = sliding;
    tile.style.transitionDuration = (sliding == "transform") ? `${SHIFT_DURATION_MS}ms` : "";
    tile.style.zIndex = lifted ? "10" : "";
    tile.style.boxShadow = lifted ? LIFTED_SHADOW : "";
}

function getMiddle(tile: HTMLElement): number
{
    const rect = tile.getBoundingClientRect();
    return rect.left + 0.5 * rect.width;
}

// The next click is dropped, unless a pointer goes down first (a release that made no click).
function swallowNextClick(): void
{
    const listeners = new AbortController();
    window.addEventListener("click", (event: MouseEvent) => {
        event.stopPropagation();
        event.preventDefault();
        listeners.abort();
    }, { capture: true, signal: listeners.signal });
    window.addEventListener("pointerdown", () => listeners.abort(), { capture: true, signal: listeners.signal });
}
