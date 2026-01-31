import { ReactNode } from "react";

export default function Form({ children }: Props)
{
    return <div className="flex flex-col justify-center gap-2 max-w-10/12 text-center">
        {children}
    </div>
}

interface Props
{
    children: ReactNode;
}