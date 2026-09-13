import { ReactNode } from "react";
import useMouseDragScroll from "../../../util/mouseDragScroll";

// Shared tool tray for selections. Scrolls horizontally instead of clipping, so every tool stays
// reachable on narrow screens; children are shrink-0 so the row overflows rather than squeezes.
export default function SelectionToolRow({ children }: Props)
{
    const onRefChange = useMouseDragScroll("horizontal", "alwaysGrab");

    // Sized to its tools, capped at screen width.
    return <div ref={onRefChange}
        className="flex flex-row items-center gap-4 p-2 w-fit max-w-full overflow-x-auto no-scrollbar pointer-events-auto bg-gray-800 rounded-md yj-surface-convex">
        {children}
    </div>
}

interface Props
{
    children: ReactNode;
}
