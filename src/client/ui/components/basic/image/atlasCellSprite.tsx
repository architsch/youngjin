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
            // Specify both axes: leaving one at its default scrolls every scrollable ancestor,
            // including the overflow-hidden full-screen UI layer.
            if (element)
                element.scrollIntoView({ inline: "center", block: "nearest" });
            else
                console.error("AtlasCellSprite's ref is null.");
        }
    }, []);

    const displayRow = props.flipRow ? (numRows - props.atlasCellRow - 1) : props.atlasCellRow;

    // Inline styles, since these values are dynamic and Tailwind can't generate them.
    return <div ref={myRef} onClick={props.onClick} style={{
        aspectRatio: props.atlasCellWidth / props.atlasCellHeight,
        backgroundImage: `url(${props.atlasImageURL})`,
        backgroundSize: `${100 * numCols}% ${100 * numRows}%`,
        backgroundPosition: `-${100 * props.atlasCellCol}% -${100 * displayRow}%`,
    }} className={`${props.additionalClassNames} ${highlightClasses}`}></div>;
}