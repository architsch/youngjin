import { ReactNode, useCallback } from "react";
import { enableVerticalDragScroll } from "../../util/mouseScroll";

export default function Form({ children }: Props)
{
    const onRefChange = useCallback((node: HTMLElement | null) => {
        if (node)
            enableVerticalDragScroll(node);
    }, []);

    // The form owns the size caps so children using `min-h-0` (e.g. an internal
    // scrollable panel) can shrink to fit, while siblings stay at their natural size.
    // pointer-events-auto re-enables interaction inside `#uiRoot`'s pointer-events-none layer.
    return <div ref={onRefChange} className="flex flex-col gap-2 p-5 max-w-[80vw] max-h-[75vh] overflow-auto pointer-events-auto text-center">
        {children}
    </div>
}

interface Props
{
    children: ReactNode;
}
