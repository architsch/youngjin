import { CSSProperties, ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { numActiveInputElementsObservable } from "../../../system/clientObservables";
import useMouseDragScroll from "../../util/mouseDragScroll";
import ClosablePanelUtil from "../../util/closablePanelUtil";
import KeyPressUtil from "../../util/keyPressUtil";
import ScrollHints from "../basic/scrollHints";

const GRID_GAP = 4; // Space kept between the button and the grid above it
const SCREEN_MARGIN = 8; // Space kept between the grid and the screen edges
// Max travel (px) for an outside press to count as a dismissing click rather than a camera drag.
const DISMISS_MOVEMENT_TOLERANCE = 8;

// A button showing the current choice, which opens a grid of the choices right above it (see PaletteColorInput,
// PartShapeInput).
export default function ToggledGridInput({ id, numCells, columnsOnHorizontalScreen, columnsOnVerticalScreen, renderCell,
    buttonClassNames, buttonStyle, buttonContent, disabled = false, onClose }: Props)
{
    const [gridOpen, setGridOpen] = useState(false);

    // Disabling can come while the grid is open (e.g. a zone drawn over the edited object).
    useEffect(() => {
        if (disabled)
            setGridOpen(false);
    }, [disabled]);
    const [gridStyle, setGridStyle] = useState<CSSProperties | undefined>(undefined);
    const [gridColumns, setGridColumns] = useState(columnsOnHorizontalScreen);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const gridRef = useRef<HTMLDivElement | null>(null);
    const onGridDragScroll = useMouseDragScroll("vertical", "grabWhileDragging");
    const onGridRefChange = useCallback((node: HTMLDivElement | null) => {
        gridRef.current = node;
        onGridDragScroll(node);
    }, [onGridDragScroll]);

    useEffect(() => {
        if (!gridOpen)
            return;
        // Counts as an active input while open, and as a panel open over the controls around it (see
        // ClosablePanelUtil); Escape closes it.
        numActiveInputElementsObservable.change(n => n + 1);
        const panelToken = ClosablePanelUtil.register(() => setGridOpen(false));
        const onKeyDown = (ev: KeyboardEvent) => {
            if (!KeyPressUtil.isEscape(ev))
                return;
            // Kept from the browser, whose own close request would go on to close what the grid is open over
            // (see useCloseGesture).
            ev.preventDefault();
            setGridOpen(false);
        };
        // An outside press closes the grid only if it didn't travel (a drag orbits the camera).
        // The toggle button counts as inside, as does a coach mark, whose x closes only itself.
        let pressPos: {x: number, y: number} | undefined;
        const onPointerDown = (ev: PointerEvent) => {
            const target = ev.target as Element | null;
            const pressedGrid = (target != null) && ((gridRef.current?.contains(target) == true)
                || (buttonRef.current?.contains(target) == true) || target.closest("[data-coach-mark]") != null);
            pressPos = pressedGrid ? undefined : {x: ev.clientX, y: ev.clientY};
        };
        const onPointerUp = (ev: PointerEvent) => {
            if (pressPos != undefined
                && Math.hypot(ev.clientX - pressPos.x, ev.clientY - pressPos.y) <= DISMISS_MOVEMENT_TOLERANCE)
                setGridOpen(false);
            pressPos = undefined;
        };
        const onPointerCancel = () => {
            pressPos = undefined;
        };
        window.addEventListener("keydown", onKeyDown);
        // Capturing, so that these readings do not depend on what the pressed element does with the event.
        window.addEventListener("pointerdown", onPointerDown, true);
        window.addEventListener("pointerup", onPointerUp, true);
        window.addEventListener("pointercancel", onPointerCancel, true);
        return () => {
            numActiveInputElementsObservable.change(n => n - 1);
            ClosablePanelUtil.unregister(panelToken);
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("pointerdown", onPointerDown, true);
            window.removeEventListener("pointerup", onPointerUp, true);
            window.removeEventListener("pointercancel", onPointerCancel, true);
            onClose?.();
        };
    }, [gridOpen]);

    useLayoutEffect(() => {
        const button = buttonRef.current;
        if (!gridOpen || button == null)
        {
            setGridStyle(undefined);
            return;
        }
        // Over the button's middle, kept on screen, and height-capped to stay there. Again with the columns, which change
        // its width.
        const reposition = () => {
            const buttonRect = button.getBoundingClientRect();
            const gridWidth = gridRef.current?.getBoundingClientRect().width ?? 0;
            const left = Math.max(SCREEN_MARGIN, Math.min(window.innerWidth - gridWidth - SCREEN_MARGIN,
                buttonRect.left + 0.5 * (buttonRect.width - gridWidth)));
            const bottom = window.innerHeight - buttonRect.top + GRID_GAP;
            const maxHeight = Math.max(0, buttonRect.top - GRID_GAP - SCREEN_MARGIN);
            setGridColumns((window.innerHeight > window.innerWidth) ? columnsOnVerticalScreen : columnsOnHorizontalScreen);
            // Unchanged style avoids re-renders while scrolling the grid.
            setGridStyle(prevStyle => (prevStyle != undefined && prevStyle.left == left && prevStyle.bottom == bottom
                && prevStyle.maxHeight == maxHeight)
                ? prevStyle : {left, bottom, maxHeight});
        };
        reposition();
        // Re-anchor whenever the button moves.
        window.addEventListener("resize", reposition);
        window.addEventListener("scroll", reposition, true); // Capturing, so that scrolling ancestors count too
        return () => {
            window.removeEventListener("resize", reposition);
            window.removeEventListener("scroll", reposition, true);
        };
    }, [gridOpen, gridColumns]);

    return <>
        <button
            ref={buttonRef}
            id={id}
            className={buttonClassNames}
            style={buttonStyle}
            disabled={disabled}
            onClick={() => setGridOpen(prev => !prev)}
        >
            {buttonContent}
        </button>
        {gridOpen &&
            // Positioning frame only; pointer-events-none so the canvas still receives drags.
            <div className="fixed inset-0 z-50 pointer-events-none">
                {/* The grid stays hidden until measured, so that it never flashes at an unanchored spot. */}
                <div ref={onGridRefChange}
                    className={`absolute p-2 flex flex-col gap-0.5 bg-gray-700 rounded-lg overflow-y-auto pointer-events-auto yj-surface-convex ${(gridStyle == undefined) ? "invisible" : ""}`}
                    style={gridStyle}>
                    <ScrollHints/>
                    {Array.from({length: Math.ceil(numCells / gridColumns)}, (_, rowIndex) =>
                        <div key={"grid-row-" + rowIndex} className="flex flex-row gap-0.5">
                            {Array.from({length: gridColumns}, (_, columnIndex) =>
                                rowIndex * gridColumns + columnIndex)
                                .filter(index => index < numCells)
                                .map(index => renderCell(index, () => setGridOpen(false)))}
                        </div>)}
                </div>
            </div>}
    </>;
}

interface Props
{
    // The button's, for automation.
    id?: string;
    numCells: number;
    columnsOnHorizontalScreen: number;
    columnsOnVerticalScreen: number;
    // A cell of the grid, keyed, given what closes the grid.
    renderCell: (index: number, close: () => void) => ReactNode;
    buttonClassNames: string;
    buttonStyle?: CSSProperties;
    buttonContent?: ReactNode;
    disabled?: boolean;
    onClose?: () => void;
}
