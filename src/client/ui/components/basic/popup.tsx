import { ReactNode } from "react";
import Text from "./text";
import Button from "./button";

export default function Popup({ children, onClose, showCloseButton = false, title = "" }: Props)
{
    const hasTopBar = showCloseButton || title.length > 0;

    return <div className={className} onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} className="relative w-fit h-fit text-lg text-gray-200 bg-gray-600 border-gray-400 border-2">
            {hasTopBar && <div className="flex flex-col">
                <div className="flex flex-row">
                    {title.length > 0 && <Text size="sm" content={title}/>}
                    {showCloseButton && <Button name="X" size="sm" onClick={onClose} additionalClassNames="ml-auto"/>}
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