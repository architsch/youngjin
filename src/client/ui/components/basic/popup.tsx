import { ReactNode } from "react";

export default function Popup({ children }: Props)
{
    return <div className={className}>
        <div className="relative w-fit h-fit text-lg text-gray-200 bg-gray-600 border-gray-400 border-2">
            {children}
        </div>
    </div>
}

const className = "absolute inset-0 z-40 pointer-events-auto flex justify-center items-center bg-black/50";

interface Props
{
    children: ReactNode;
}