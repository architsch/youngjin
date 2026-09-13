import { useEffect, useState } from "react";

// Live viewport rect of the element with the given id, re-read every frame but only updating state on
// change. Null if no id or the element isn't in the DOM.
export default function useTrackedElementRect(elementId: string | null): DOMRect | null
{
    const [rect, setRect] = useState<DOMRect | null>(null);

    useEffect(() => {
        if (!elementId)
        {
            setRect(null);
            return;
        }

        let frameId = 0;
        let prevKey = "";

        const tick = () => {
            const element = document.getElementById(elementId);
            if (element)
            {
                const r = element.getBoundingClientRect();
                const key = `${r.left},${r.top},${r.width},${r.height}`;
                if (key != prevKey)
                {
                    prevKey = key;
                    setRect(r);
                }
            }
            else if (prevKey != "")
            {
                prevKey = "";
                setRect(null);
            }
            frameId = requestAnimationFrame(tick);
        };
        frameId = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(frameId);
    }, [elementId]);

    return rect;
}
