import { RefObject, useEffect, useState } from "react";

// The largest size of the given aspect ratio that fits inside the element's padding, kept up to date as it resizes.
// The padding stays clear, so what is drawn a little past the fitted box (a handle on its corner) is still within
// the element: past it, it would make whatever scrolls around the element scroll, and resize the element in turn.
export default function useFitSize(ref: RefObject<HTMLElement | null>, aspect: number): {width: number, height: number}
{
    const [size, setSize] = useState({width: 0, height: 0});
    useEffect(() => {
        const element = ref.current;
        if (element == null)
            return;
        const update = () => {
            const style = getComputedStyle(element);
            const roomAcross = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
            const roomDown = element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
            const width = Math.max(0, Math.min(roomAcross, roomDown * aspect));
            setSize({width, height: width / aspect});
        };
        update();
        const observer = new ResizeObserver(update);
        observer.observe(element);
        return () => observer.disconnect();
    }, [ref, aspect]);
    return size;
}
