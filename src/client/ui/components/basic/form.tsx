import { ReactNode } from "react";
import useMouseDragScroll from "../../util/mouseDragScroll";

export default function Form({ children }: Props)
{
    const onRefChange = useMouseDragScroll("vertical", "grabWhileDragging");

    // The form owns the size caps so children using `min-h-0` (e.g. an internal
    // scrollable panel) can shrink to fit, while siblings stay at their natural size.
    // pointer-events-auto re-enables interaction inside `#uiRoot`'s pointer-events-none layer.
    return <div ref={onRefChange} className="flex flex-col gap-2 p-5 max-w-[80vw] max-h-[75vh] overflow-y-auto overflow-x-hidden pointer-events-auto text-center">
        {children}
    </div>
}

interface Props
{
    children: ReactNode;
}
