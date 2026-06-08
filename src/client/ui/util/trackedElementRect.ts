import { useEffect, useState } from "react";

// Tracks the live bounding rectangle (in viewport coordinates) of the DOM element
// with the given id, re-reading it every animation frame so that an on-screen overlay
// can follow the element as the layout shifts. The returned rect only updates when the
// element's position or size actually changes, so a stationary target costs no re-renders.
// Returns null when no id is given or the element is not currently in the DOM.
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
