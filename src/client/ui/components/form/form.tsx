import { ReactNode } from "react";
import useMouseDragScroll from "../../util/mouseDragScroll";

export default function Form({ children, id }: Props)
{
    const onRefChange = useMouseDragScroll("vertical", "grabWhileDragging");

    // The form owns the size caps so children using `min-h-0` (e.g. an internal
    // scrollable panel) can shrink to fit, while siblings stay at their natural size.
    // pointer-events-auto re-enables interaction inside `#uiRoot`'s pointer-events-none layer.
    return <div id={id} ref={onRefChange} className="flex flex-col gap-2 p-5 max-w-[80vw] max-h-[75vh] overflow-y-auto overflow-x-hidden pointer-events-auto text-center">
        {children}
    </div>
}

interface Props
{
    children: ReactNode;
    // Names the form so it can be addressed from outside the app. A popup is put up by whatever
    // opened it rather than by a route, so without a name of its own there is nothing to tell one
    // open form from another — and its fields are ordinary inputs that every other form has too.
    id?: string;
}
