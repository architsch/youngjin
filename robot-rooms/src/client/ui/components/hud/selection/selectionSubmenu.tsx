import { ReactNode, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// How far over its button the column stands, and how near the window's sides it comes, in CSS px.
const GAP_PX = 6;
const EDGE_MARGIN_PX = 4;
// The column's own padding (p-2), by which its tools stand right over the button.
const PADDING_PX = 8;

// A column of tools raised over the button that offers them (see VoxelQuadPlacementOptions), the first of them
// nearest the button, each right over it with whatever it shows beside itself to its right. Drawn at the page's top
// level, where no tool row's scrolling clips it, and kept over its button as the row scrolls or the window changes
// size.
export default function SelectionSubmenu({ anchorId, id, children }: Props)
{
    const ref = useRef<HTMLDivElement>(null);
    const [place, setPlace] = useState<{left: number, bottom: number} | null>(null);

    useLayoutEffect(() => {
        const measure = () => {
            const rect = document.getElementById(anchorId)?.getBoundingClientRect();
            const width = ref.current?.offsetWidth ?? 0;
            setPlace(rect ? {
                left: Math.max(EDGE_MARGIN_PX, Math.min(rect.left - PADDING_PX, window.innerWidth - width - EDGE_MARGIN_PX)),
                bottom: window.innerHeight - rect.top + GAP_PX,
            } : null);
        };
        measure();
        window.addEventListener("resize", measure);
        // In the capture phase, which a scroll of any element reaches.
        window.addEventListener("scroll", measure, true);
        return () => {
            window.removeEventListener("resize", measure);
            window.removeEventListener("scroll", measure, true);
        };
    }, [anchorId]);

    // Laid out unseen until it is placed, its width being part of where it goes.
    return createPortal(<div id={id} ref={ref}
        className="fixed z-20 flex flex-col-reverse items-start gap-3 p-2 pointer-events-auto bg-gray-800 rounded-md yj-surface-convex"
        style={(place == null) ? {visibility: "hidden"} : {left: place.left, bottom: place.bottom}}>
        {children}
    </div>, document.getElementById("uiRoot") ?? document.body);
}

interface Props
{
    // The button the column stands over.
    anchorId: string;
    id?: string;
    children: ReactNode;
}
