import { RefObject, useEffect, useState } from "react";

// The largest size of the given aspect ratio that fits in the element, kept up to date as it resizes.
export default function useFitSize(ref: RefObject<HTMLElement | null>, aspect: number): {width: number, height: number}
{
    const [size, setSize] = useState({width: 0, height: 0});
    useEffect(() => {
        const element = ref.current;
        if (element == null)
            return;
        const update = () => {
            const width = Math.min(element.clientWidth, element.clientHeight * aspect);
            setSize({width, height: width / aspect});
        };
        update();
        const observer = new ResizeObserver(update);
        observer.observe(element);
        return () => observer.disconnect();
    }, [ref, aspect]);
    return size;
}
