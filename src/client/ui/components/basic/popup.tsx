import { ReactNode, useRef } from "react";
import Text from "./text";
import IconButton from "./iconButton";
import CloseIcon from "./icons/closeIcon";
import { DRAG_THRESHOLD_PX } from "../../../system/clientConstants";

export default function Popup({ children, onClose, showCloseButton = false, title = "" }: Props)
{
    const hasTopBar = showCloseButton || title.length > 0;
    const downOnBackdropRef = useRef(false);
    const downPosRef = useRef({ x: 0, y: 0 });

    return <div
        className={className}
        onPointerDown={(e) => {
            downOnBackdropRef.current = e.target === e.currentTarget;
            downPosRef.current = { x: e.clientX, y: e.clientY };
        }}
        onClick={(e) => {
            // Close on click (not pointerup) so the backdrop is still mounted when the
            // synthetic touch-click is dispatched on mobile, absorbing it. Closing during
            // pointerup removes the backdrop before the synthetic click is hit-tested,
            // which lets the click fall through to the game canvas and fire a raycast.
            const dx = e.clientX - downPosRef.current.x;
            const dy = e.clientY - downPosRef.current.y;
            const movedTooFar = dx * dx + dy * dy > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX;
            const shouldClose = downOnBackdropRef.current && e.target === e.currentTarget && !movedTooFar;
            downOnBackdropRef.current = false;
            if (shouldClose) onClose();
        }}
    >
        <div className="relative w-fit h-fit text-lg text-gray-200 bg-gray-600 border-gray-400 border-2 rounded-lg">
            {hasTopBar && <div className="flex flex-col">
                <div className="flex flex-row">
                    {title.length > 0 && <Text size="sm" content={title}/>}
                    {showCloseButton && <IconButton icon={<CloseIcon/>} size="sm" onClick={onClose} additionalClassNames="ml-auto"/>}
                </div>
                {children}
            </div>}
            {!hasTopBar && children}
        </div>
    </div>
}

const className = "absolute inset-0 z-40 pointer-events-auto flex justify-center items-center bg-black/50";

interface Props
{
    children: ReactNode;
    onClose: () => void;
    showCloseButton?: boolean;
    title?: string;
}