import { ReactNode } from "react";
import useMouseDragScroll from "../../../util/mouseDragScroll";

// The tray of tools for whatever the user currently has picked out — a lamp, a door, a canvas, a
// patch of wall. One component rather than the same row written out in each of them, because what it
// has to get right is a screen-width problem rather than a per-object one.
//
// **It scrolls sideways instead of being cut off.** A tray is only ever as wide as the tools in it,
// and every kind of object has a different number of them — a lamp's two dials and a swatch are
// already far wider than a door's row of buttons, and each of these grows as the object it belongs
// to learns to do more. Held to the width of the screen and clipped, the tools past the edge are not
// merely hard to reach: there is nothing to say they exist. Scrolled, the tray behaves as the texture
// strip below it and the character's parts already do — dragged with the mouse, swiped on a touch
// screen — and a phone is left able to reach every tool a desktop can.
//
// Nothing inside may give way to that: the contents keep their own width (`shrink-0`) so the row
// overflows and scrolls, where a row of shrinkable tools would silently squeeze itself into the
// space instead and never scroll at all.
export default function SelectionToolRow({ children }: Props)
{
    const onRefChange = useMouseDragScroll("horizontal", "alwaysGrab");

    // Wide enough for its tools and no wider, up to the width of the screen — a tray of two buttons
    // stays a tray of two buttons rather than a bar across the room.
    return <div ref={onRefChange}
        className="flex flex-row items-center gap-4 p-2 w-fit max-w-full overflow-x-auto no-scrollbar pointer-events-auto bg-gray-800 rounded-md yj-surface-convex">
        {children}
    </div>
}

interface Props
{
    children: ReactNode;
}
