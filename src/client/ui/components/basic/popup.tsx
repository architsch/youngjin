import { ReactNode } from "react";

export default function Popup({ children }: Props)
{
    return <div className={className}>
        <div className="flex justify-center items-center p-5 gap-2 w-fit h-fit text-lg text-gray-200 bg-gray-600 border-gray-400 border-2">
            {children}
        </div>
    </div>
}

const className = "flex justify-center items-center w-full h-full bg-black/50";

interface Props
{
    children: ReactNode;
}