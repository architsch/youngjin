import { useEffect, useRef } from "react";
import Image from "./image";

export default function ImageListRow({ imageURL, title, author, selected,
    autoScrollToSelected, onClick }: Props)
{
    const myRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (selected && autoScrollToSelected)
        {
            const element = myRef.current;
            if (element)
                element.scrollIntoView({ block: "center" });
        }
    }, []);

    const selectionClassNames = selected ? "outline-4 outline-green-500 outline-offset-1" : "";

    return <div
        ref={myRef}
        onClick={onClick}
        className={`flex flex-row items-center gap-2 p-2 cursor-pointer rounded-md bg-gray-800/50 hover:bg-gray-700/50 ${selectionClassNames}`}
    >
        <Image src={imageURL} size="sm" alt={title} additionalClassNames="rounded-md shrink-0"/>
        <div className="flex flex-col min-w-0 flex-1 text-left">
            <div className="yj-text-sm text-gray-200 truncate">{title}</div>
            <div className="yj-text-xs text-gray-400 truncate">{author}</div>
        </div>
    </div>;
}

interface Props
{
    imageURL: string;
    title: string;
    author: string;
    selected: boolean;
    autoScrollToSelected: boolean;
    onClick: () => void;
}
