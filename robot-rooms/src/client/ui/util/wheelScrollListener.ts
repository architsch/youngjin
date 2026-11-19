import { useEffect } from "react";
import ScrollAreaUtil from "./scrollAreaUtil";

// Has a wheel rolled up or down over a strip that only scrolls sideways scroll it (see ScrollAreaUtil), in either
// game mode and inside a popup.
export default function useWheelScrollListener(): void
{
    useEffect(() => {
        const onWheel = (ev: WheelEvent) => {
            if (ScrollAreaUtil.tryScrollSideways(ev))
                ev.preventDefault();
        };
        // Non-passive, which a window's wheel listener is not by default, so the roll can be kept from the page.
        window.addEventListener("wheel", onWheel, {passive: false});
        return () => {
            window.removeEventListener("wheel", onWheel);
        };
    }, []);
}
