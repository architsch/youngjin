import { ReactNode, useEffect, useRef, useState } from "react";
import Text from "../basic/text";
import ScrollPanel from "./scrollPanel";

// A closable row of thumbnails to pick one of (see CompositionThumbnailPanel, ImageMapThumbnailPanel). New choices
// scroll it to the current one (outlined), or to its start if they leave it out; it grows a page at a time as it is
// scrolled to its end. A choice canChoose refuses is shown dimmed and can't be picked.
export default function ThumbnailPanel<K extends string | number>({ id, choices, current, canChoose, onChoose,
    renderThumbnail, thumbnailClassNames, emptyText, closeRowContent, overhang = false, onClose }: Props<K>)
{
    const scrollTarget = Math.max(choices.indexOf(current), 0);

    // Enough pages to reach the current thumbnail, plus those added by scrolling to the end (none for new choices).
    const [numAddedPages, setNumAddedPages] = useState<number>(0);
    const numShown = (Math.floor(scrollTarget / PAGE_SIZE) + 1 + numAddedPages) * PAGE_SIZE;
    const shownChoices = choices.slice(0, numShown);
    const hasMore = numShown < choices.length;

    const scrollTargetRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        setNumAddedPages(0);
        // Both axes given: leaving one at its default scrolls every scrollable ancestor (see AtlasCellSprite).
        scrollTargetRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
    }, [choices]);

    // Observed afresh after every page, so an end still in view once a page is added asks for the next.
    const endRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const end = endRef.current;
        if (!end || !hasMore)
            return;
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting))
                setNumAddedPages(n => n + 1);
        });
        observer.observe(end);
        return () => observer.disconnect();
    }, [shownChoices.length, hasMore]);

    return <ScrollPanel id={id} onClose={onClose} closeRowContent={closeRowContent} overhang={overhang}
        additionalClassNames="m-2">
        {choices.length == 0 && <>
            {emptyText && <Text content={emptyText} size="sm" additionalClassNames="self-center shrink-0"/>}
            {/* An unseen tile of no width, so the row stays as tall as with thumbnails in it. */}
            <div aria-hidden className={`${thumbnailClassNames} m-1.5 shrink-0 invisible`}
                style={{width: 0, marginLeft: 0, marginRight: 0}}/>
        </>}
        {shownChoices.map((choice, position) => {
            const choosable = canChoose?.(choice) ?? true;
            const highlightClassNames = (choice === current) ? "outline-4 outline-green-500 outline-offset-1" : "";
            // The margin leaves room for the highlight outline inside the scrolling row.
            return <div key={choice} id={`${id}.${position}`} ref={position == scrollTarget ? scrollTargetRef : undefined}
                aria-disabled={!choosable}
                onClick={choosable ? () => onChoose(choice) : undefined}
                className={`${thumbnailClassNames} m-1.5 shrink-0 rounded-md ${highlightClassNames} ${choosable ? "cursor-pointer" : "opacity-30 cursor-not-allowed"}`}
            >
                {renderThumbnail(choice, position)}
            </div>;
        })}
        {hasMore && <div ref={endRef} className="w-px shrink-0"/>}
    </ScrollPanel>;
}

// Thumbnails mounted per page; mounting thousands at once (and requesting their images) doesn't scale.
const PAGE_SIZE = 30;

interface Props<K>
{
    // Lets automation address the panel, and each thumbnail by its position in the row (e.g. "lampSizeOptions.0").
    id: string;
    // In the row's order.
    choices: K[];
    current: K;
    // Absent means every one may be picked.
    canChoose?: (choice: K) => boolean;
    onChoose: (choice: K) => void;
    // What a thumbnail shows, inside a tile of thumbnailClassNames.
    renderThumbnail: (choice: K, position: number) => ReactNode;
    thumbnailClassNames: string;
    // Shown instead when there are no choices (e.g. a search matching nothing).
    emptyText?: string;
    closeRowContent?: ReactNode;
    // Lets thumbnails stick out over the panel's top edge (see ScrollPanel).
    overhang?: boolean;
    onClose: () => void;
}
