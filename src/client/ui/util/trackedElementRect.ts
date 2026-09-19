import { useEffect, useState } from "react";

// Live viewport rect of the element with the given id, re-read every frame but only updating state on
// change. Null if no id or the element isn't in the DOM. scrollIntoView brings the element out of any
// scrollable ancestor it is hiding in, for callers that draw attention to it rather than follow it.
export default function useTrackedElementRect(elementId: string | null,
    scrollIntoView: boolean = false): DOMRect | null
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
        let scrolled = false;

        const tick = () => {
            const element = document.getElementById(elementId);
            if (element)
            {
                if (scrollIntoView && !scrolled)
                {
                    scrolled = true;
                    // Both axes specified, as leaving one at its default scrolls every scrollable
                    // ancestor, including the overflow-hidden full-screen UI layer.
                    element.scrollIntoView({inline: "center", block: "nearest"});
                }
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
    }, [elementId, scrollIntoView]);

    return rect;
}
