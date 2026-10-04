import { ReactNode, RefObject, useEffect, useRef } from "react";

export default function AtlasCellSprite(props: {
        id?: string,
        atlasImageURL: string,
        atlasWidth: number, atlasHeight: number,
        atlasCellWidth: number, atlasCellHeight: number,
        atlasCellRow: number, atlasCellCol: number,
        // Pixels of the cell left out all round, when its picture sits inside a margin.
        atlasCellMargin?: number,
        flipRow: boolean,
        highlight: boolean, autoScrollToHighlight: boolean,
        additionalClassNames: string,
        // Shown dimmed and not clickable.
        disabled?: boolean,
        onClick?: () => void | Promise<void>,
        // Drawn over the cell (e.g. a badge).
        children?: ReactNode,
    })
{
    const numRows = Math.floor(props.atlasHeight / props.atlasCellHeight);

    const highlightClasses = props.highlight ? `outline-4 outline-green-500 outline-offset-1` : "";
    const disabledClasses = props.disabled ? "opacity-30 cursor-not-allowed" : "";
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

    // The part of the atlas shown, in its pixels from the top-left.
    const margin = props.atlasCellMargin ?? 0;
    const shownWidth = props.atlasCellWidth - 2 * margin;
    const shownHeight = props.atlasCellHeight - 2 * margin;
    const shownLeft = props.atlasCellCol * props.atlasCellWidth + margin;
    const shownTop = displayRow * props.atlasCellHeight + margin;

    // A percentage position is a share of how far the image overhangs the sprite, which is none when the
    // atlas is all that is shown.
    const overhangX = props.atlasWidth - shownWidth;
    const overhangY = props.atlasHeight - shownHeight;
    const positionX = (overhangX > 0) ? 100 * shownLeft / overhangX : 0;
    const positionY = (overhangY > 0) ? 100 * shownTop / overhangY : 0;

    // Inline styles, since these values are dynamic and Tailwind can't generate them.
    // A div has no `disabled`, so it is declared via aria for assistive tech and automation.
    return <div id={props.id} ref={myRef} aria-disabled={props.disabled}
        onClick={props.disabled ? undefined : props.onClick} style={{
        aspectRatio: shownWidth / shownHeight,
        backgroundImage: `url(${props.atlasImageURL})`,
        backgroundSize: `${100 * props.atlasWidth / shownWidth}% ${100 * props.atlasHeight / shownHeight}%`,
        backgroundPosition: `${positionX}% ${positionY}%`,
    }} className={`${props.additionalClassNames} ${highlightClasses} ${disabledClasses}`}>{props.children}</div>;
}