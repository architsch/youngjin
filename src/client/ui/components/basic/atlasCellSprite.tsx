import { RefObject, useEffect, useRef } from "react";

export default function AtlasCellSprite(props: {
        atlasImageURL: string,
        atlasWidth: number, atlasHeight: number,
        atlasCellWidth: number, atlasCellHeight: number,
        atlasCellRow: number, atlasCellCol: number,
        highlight: boolean, autoScrollToHighlight: boolean,
        additionalClassNames: string,
        onClick?: () => void | Promise<void>,
    })
{
    const numCols = Math.floor(props.atlasWidth / props.atlasCellWidth);
    const numRows = Math.floor(props.atlasHeight / props.atlasCellHeight);

    const highlightClasses = props.highlight ? `outline-4 outline-green-500 outline-offset-1` : "";
    const myRef: RefObject<HTMLDivElement | null> = useRef(null);

    useEffect(() => {
        if (props.highlight && props.autoScrollToHighlight)
        {
            const element = myRef.current;
            if (element)
                element.scrollIntoView({ inline: "center" });
            else
                console.error("AtlasCellSprite's ref is null.");
        }
    }, []);

    // I am hard-coding CSS styles here instead of using Tailwind's utility classes,
    // since the parameters must be dynamically determined (and thus cannot be preloaded during Tailwind's CSS build process)
    return <div ref={myRef} onClick={props.onClick} style={{
        aspectRatio: props.atlasCellWidth / props.atlasCellHeight,
        backgroundImage: `url(${props.atlasImageURL})`,
        backgroundSize: `${100 * numCols}% ${100 * numRows}%`,
        backgroundPosition: `-${100 * props.atlasCellCol}% -${100 * (numRows - props.atlasCellRow - 1)}%`,
    }} className={`${props.additionalClassNames} ${highlightClasses}`}></div>;
}