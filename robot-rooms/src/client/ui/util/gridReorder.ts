import { PointerEvent as ReactPointerEvent, RefObject, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { MOUSE_DRAG_THRESHOLD_PX, REORDER_HOLD_MS, TOUCH_DRAG_THRESHOLD_PX } from "../../system/clientConstants";

// How a tile lifted off the grid stands out from it: larger, where the grid has the room, and casting a shadow.
const LIFTED_SCALE = 1.1;
const LIFTED_SHADOW = "0 2px 8px rgba(0, 0, 0, 0.6)";

// How long the others take to make room, and a tile let go to settle (in milliseconds).
const SHIFT_DURATION_MS = 150;

// What an element names itself a drop target by, for a tile dragged out of its grid, and what the one such a tile
// is over carries meanwhile, to show itself by (see TreeRow).
const DROP_TARGET_ATTRIBUTE = "data-drop-target";
const DROP_OVER_ATTRIBUTE = "data-drop-over";

// How faint a tile is in its place while a copy of it is out of the grid.
const VACATED_OPACITY = "0.3";

// How near the top or the bottom of the view the pointer starts scrolling it, and how fast at the very edge (CSS px
// per second).
const AUTO_SCROLL_EDGE_PX = 48;
const AUTO_SCROLL_MAX_SPEED = 800;

// Lets a grid's tiles be rearranged by hand, a list's rows being a grid of one column (see ImageOrderGrid,
// ImageCategoryRows): one dragged is lifted and follows the pointer, the others making room where it would land, and
// it is put there when let go. A mouse lifts a tile by dragging it; a finger by holding it still for a moment first,
// as a quicker drag scrolls the grid. A press let go before either is still a click. The tiles are the grid
// element's children, in order and all of one size, and it is their offset parent. Returns what a tile calls when a
// pointer goes down on it. onLift hears of each tile lifted.
// With onDropOut, a tile dragged out past a side of the view that has drop targets beyond it (DROP_TARGET_ATTRIBUTE)
// leaves the grid as it was, a copy of it following the pointer: let go over a drop target, it is dropped on that
// one, which onDropOut is told by the attribute's value, and let go anywhere else out there, nothing happens.
export default function useGridReorder(gridRef: RefObject<HTMLElement | null>,
    scrollerRef: RefObject<HTMLElement | null>, onLift: (position: number) => void,
    onDrop: (from: number, to: number) => void, onDropOut?: (from: number, target: string) => void)
{
    // Refs keep one drag while still calling the latest of each.
    const onLiftRef = useRef(onLift);
    onLiftRef.current = onLift;
    const onDropRef = useRef(onDrop);
    onDropRef.current = onDrop;
    const onDropOutRef = useRef(onDropOut);
    onDropOutRef.current = onDropOut;
    // Ends the drag in progress, if any, putting nothing anywhere.
    const cancelRef = useRef<(() => void) | undefined>(undefined);
    const liftedRef = useRef(false);

    useEffect(() => {
        const scroller = scrollerRef.current;
        if (!scroller)
            return;
        // A finger's drag pans the grid unless its move is refused, which only a listener there since the touch
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
    }, []);

    return (event: ReactPointerEvent, position: number) => {
        const tileGrid = gridRef.current, scroller = scrollerRef.current;
        if (!tileGrid || !scroller || event.button != 0 || !event.isPrimary)
            return;
        cancelRef.current?.();
        cancelRef.current = startDrag(tileGrid, scroller, position, event.nativeEvent, liftedRef,
            from => onLiftRef.current(from), (from, to) => onDropRef.current(from, to),
            onDropOutRef.current && ((from, target) => onDropOutRef.current?.(from, target)),
            () => cancelRef.current = undefined);
    };
}

// Returns the cancel, which ends the press (or the drag it became) with nothing rearranged.
function startDrag(tileGrid: HTMLElement, scroller: HTMLElement, from: number, down: PointerEvent,
    liftedRef: {current: boolean}, onLift: (position: number) => void, onDrop: (from: number, to: number) => void,
    onDropOut: ((from: number, target: string) => void) | undefined, onEnd: () => void): () => void
{
    const listeners = new AbortController();
    const signal = listeners.signal;
    const byMouse = down.pointerType == "mouse";
    const maxTravel = byMouse ? MOUSE_DRAG_THRESHOLD_PX : TOUCH_DRAG_THRESHOLD_PX;

    let lifted = false;
    let clientX = down.clientX, clientY = down.clientY;
    // The tiles as the grid lays them out, which neither moving them nor scrolling changes.
    let tiles: HTMLElement[] = [];
    let lefts: number[] = [], tops: number[] = [];
    let minLeft = 0, maxLeft = 0;
    // Where on the lifted tile the pointer took hold, and how large it is drawn meanwhile.
    let grabX = 0, grabY = 0, scale = 1;
    // The place the lifted tile would land at, and the one the others last made room at.
    let to = from, madeRoomAt = from;
    let frame = 0, frameTime = 0, scrollRemainder = 0;
    // The sides of the view the lifted tile can be dragged out past, the copy of it that is out of the grid, if it
    // is, and the drop target the copy is over.
    let outPastLeft = false, outPastRight = false;
    let copy: HTMLElement | undefined;
    let target: Element | null = null;

    const setTarget = (next: Element | null) => {
        if (next == target)
            return;
        target?.removeAttribute(DROP_OVER_ATTRIBUTE);
        next?.setAttribute(DROP_OVER_ATTRIBUTE, "");
        target = next;
    };
    // A copy, as the view clips the tile itself. The grid is as it was meanwhile, the tile faint in its place.
    const leaveGrid = (): HTMLElement => {
        const tile = tiles[from];
        const made = tile.cloneNode(true) as HTMLElement;
        made.removeAttribute("id");
        setStyle(made, `scale(${scale})`, "none", true);
        // What the tile takes from where it stands, the copy is given.
        made.style.width = `${tile.offsetWidth}px`;
        made.style.height = `${tile.offsetHeight}px`;
        made.style.fontFamily = getComputedStyle(tile).fontFamily;
        made.style.position = "fixed";
        made.style.pointerEvents = "none";
        document.body.appendChild(made);

        to = madeRoomAt = from;
        for (const other of tiles)
            setStyle(other, "", "transform", false);
        tile.style.opacity = VACATED_OPACITY;
        return made;
    };
    const returnToGrid = () => {
        copy?.remove();
        copy = undefined;
        setTarget(null);
        tiles[from].style.opacity = "";
    };

    // The lifted tile under the pointer, within the tiles' own bounds, and the place nearest to it: by row first,
    // then along that row. Each tile between there and where it came from stands one place nearer the latter.
    const layOut = () => {
        const view = scroller.getBoundingClientRect();
        if ((outPastLeft && clientX < view.left) || (outPastRight && clientX > view.right))
        {
            copy = copy ?? leaveGrid();
            copy.style.left = `${clientX - grabX}px`;
            copy.style.top = `${clientY - grabY}px`;
            setTarget(document.elementFromPoint(clientX, clientY)?.closest(`[${DROP_TARGET_ATTRIBUTE}]`) ?? null);
            return;
        }
        if (copy)
            returnToGrid();

        const rect = tileGrid.getBoundingClientRect();
        const left = Math.max(minLeft, Math.min(maxLeft, clientX - rect.left - grabX));
        const top = Math.max(tops[0], Math.min(tops[tops.length - 1], clientY - rect.top - grabY));
        setStyle(tiles[from], `translate(${left - lefts[from]}px, ${top - tops[from]}px) scale(${scale})`, "none", true);

        to = 0;
        for (let position = 1; position < tiles.length; ++position)
        {
            const nearerRowBy = Math.abs(tops[to] - top) - Math.abs(tops[position] - top);
            if (nearerRowBy > 0 || (nearerRowBy == 0 && Math.abs(lefts[position] - left) < Math.abs(lefts[to] - left)))
                to = position;
        }
        if (to == madeRoomAt)
            return;
        madeRoomAt = to;
        tiles.forEach((tile, position) => {
            if (position == from)
                return;
            const place = (position > from && position <= to) ? position - 1
                : (position < from && position >= to) ? position + 1 : position;
            const move = (place == position) ? ""
                : `translate(${lefts[place] - lefts[position]}px, ${tops[place] - tops[position]}px)`;
            setStyle(tile, move, "transform", false);
        });
    };

    // Scrolls the view while the pointer is near its top or its bottom, faster the nearer, unless the tile is out of
    // the grid.
    const step = (time: number) => {
        const view = scroller.getBoundingClientRect();
        const edge = Math.min(AUTO_SCROLL_EDGE_PX, 0.25 * view.height);
        const depth = copy ? 0 : (clientY < view.top + edge) ? (clientY - view.top - edge) / edge
            : (clientY > view.bottom - edge) ? (clientY - view.bottom + edge) / edge : 0;
        const distance = Math.max(-1, Math.min(1, depth)) * AUTO_SCROLL_MAX_SPEED * Math.max(time - frameTime, 0) / 1000
            + scrollRemainder;
        scrollRemainder = distance - Math.trunc(distance);
        scroller.scrollTop += Math.trunc(distance);
        frameTime = time;
        layOut();
        frame = requestAnimationFrame(step);
    };

    const lift = () => {
        tiles = Array.from(tileGrid.children) as HTMLElement[];
        if (from >= tiles.length)
            return;
        lifted = liftedRef.current = true;
        lefts = tiles.map(tile => tile.offsetLeft);
        tops = tiles.map(tile => tile.offsetTop);
        minLeft = Math.min(...lefts);
        maxLeft = Math.max(...lefts);
        const rect = tileGrid.getBoundingClientRect();
        grabX = down.clientX - rect.left - lefts[from];
        grabY = down.clientY - rect.top - tops[from];
        // One as wide as its grid would stick out of it.
        scale = (tiles[from].offsetWidth * LIFTED_SCALE <= tileGrid.clientWidth) ? LIFTED_SCALE : 1;
        if (onDropOut != undefined)
        {
            const view = scroller.getBoundingClientRect();
            document.querySelectorAll(`[${DROP_TARGET_ATTRIBUTE}]`).forEach(element => {
                const targetRect = element.getBoundingClientRect();
                outPastLeft = outPastLeft || targetRect.right <= view.left;
                outPastRight = outPastRight || targetRect.left >= view.right;
            });
        }
        frameTime = performance.now();
        onLift(from);
        layOut();
        frame = requestAnimationFrame(step);
    };
    const holdTimer = byMouse ? undefined : window.setTimeout(lift, REORDER_HOLD_MS);

    const end = (put: boolean) => {
        window.clearTimeout(holdTimer);
        cancelAnimationFrame(frame);
        listeners.abort();
        liftedRef.current = false;
        onEnd();
        if (!lifted)
            return;
        // Letting it go is a click, on it or on whatever lies under the pointer by then, which must do nothing.
        if (put)
            swallowNextClick();

        const dragged = tiles[from];
        // Out of the grid, it is dropped on the target it is over, if any, and put nowhere.
        if (copy)
        {
            const droppedOn = put ? target?.getAttribute(DROP_TARGET_ATTRIBUTE) : undefined;
            returnToGrid();
            for (const tile of tiles)
                setStyle(tile, "", "", false);
            if (droppedOn != undefined)
                onDropOut?.(from, droppedOn);
            return;
        }
        const heldAt = getMiddle(dragged);
        // At once, so the grid comes back rearranged before the others are let go of.
        if (put && to != from)
            flushSync(() => onDrop(from, to));
        for (const tile of tiles)
            setStyle(tile, "", "", false);
        if (!dragged.isConnected)
            return;

        // From where it was let go to its place in the grid.
        const placedAt = getMiddle(dragged);
        setStyle(dragged, `translate(${heldAt.x - placedAt.x}px, ${heldAt.y - placedAt.y}px) scale(${scale})`,
            "none", true);
        dragged.getBoundingClientRect();
        setStyle(dragged, "", "transform", true);
        window.setTimeout(() => setStyle(dragged, "", "", false), SHIFT_DURATION_MS);
    };

    window.addEventListener("pointermove", (event: PointerEvent) => {
        if (event.pointerId != down.pointerId)
            return;
        clientX = event.clientX;
        clientY = event.clientY;
        if (lifted)
        {
            // A mouse button let go where the page couldn't see it.
            if (byMouse && event.buttons == 0)
                end(true);
        }
        else if (Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY) > maxTravel)
        {
            // A finger that travels before the tile is lifted is scrolling.
            if (byMouse)
                lift();
            else
                end(false);
        }
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
    if (!byMouse)
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

function getMiddle(tile: HTMLElement): {x: number, y: number}
{
    const rect = tile.getBoundingClientRect();
    return {x: rect.left + 0.5 * rect.width, y: rect.top + 0.5 * rect.height};
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
