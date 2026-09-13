import { ReactNode } from "react";
import useMouseDragScroll from "../../util/mouseDragScroll";

export default function Form({ children, id }: Props)
{
    const onRefChange = useMouseDragScroll("vertical", "grabWhileDragging");

    // The form owns the size caps so min-h-0 children can shrink. pointer-events-auto re-enables
    // interaction inside #uiRoot's pointer-events-none layer.
    return <div id={id} ref={onRefChange} className="flex flex-col gap-2 p-5 max-w-[80vw] max-h-[75vh] overflow-y-auto overflow-x-hidden pointer-events-auto text-center">
        {children}
    </div>
}

interface Props
{
    children: ReactNode;
    // Lets automation address a specific open form.
    id?: string;
}
