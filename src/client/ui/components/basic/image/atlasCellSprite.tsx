import { RefObject, useEffect, useRef } from "react";

export default function AtlasCellSprite(props: {
        atlasImageURL: string,
        atlasWidth: number, atlasHeight: number,
        atlasCellWidth: number, atlasCellHeight: number,
        atlasCellRow: number, atlasCellCol: number,
        flipRow: boolean,
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
            // Kept to the strip this cell lives in. Naming only the axis the strip scrolls on
            // leaves the other one at its default, which asks for the cell at the *top* of the
            // view — and the browser answers that by scrolling every ancestor that can scroll,
            // the full-screen UI layer included: it is `overflow: hidden`, which the user cannot
            // scroll but code still can, so the whole HUD is dragged along with the cell.
            if (element)
                element.scrollIntoView({ inline: "center", block: "nearest" });
            else
                console.error("AtlasCellSprite's ref is null.");
        }
    }, []);

    const displayRow = props.flipRow ? (numRows - props.atlasCellRow - 1) : props.atlasCellRow;

    // I am hard-coding CSS styles here instead of using Tailwind's utility classes,
    // since the parameters must be dynamically determined (and thus cannot be preloaded during Tailwind's CSS build process)
    return <div ref={myRef} onClick={props.onClick} style={{
        aspectRatio: props.atlasCellWidth / props.atlasCellHeight,
        backgroundImage: `url(${props.atlasImageURL})`,
        backgroundSize: `${100 * numCols}% ${100 * numRows}%`,
        backgroundPosition: `-${100 * props.atlasCellCol}% -${100 * displayRow}%`,
    }} className={`${props.additionalClassNames} ${highlightClasses}`}></div>;
}