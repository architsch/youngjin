import { ReactNode, useEffect, useRef, useState } from "react";
import Text from "../basic/text";
import ScrollPanel from "./scrollPanel";

// A closable row of thumbnails to pick one of (see CompositionThumbnailPanel, ImageMapThumbnailPanel). New choices
// scroll it to the current one (outlined) or, with none current, to where the last panel of its id was left, or to
// its start if they leave that out; it grows a page at a time as it is scrolled to its end. A choice canChoose
// refuses is shown dimmed and can't be picked.
export default function ThumbnailPanel<K extends string | number>({ id, choices, current, canChoose, onChoose,
    renderThumbnail, thumbnailClassNames, emptyText, closeRowContent, overhang = false, onClose }: Props<K>)
{
    const [placeLeft] = useState(() => (current === undefined) ? placesLeft.get(id) as K | undefined : undefined);
    const anchor = current ?? placeLeft;
    const scrollTarget = Math.max((anchor === undefined) ? -1 : choices.indexOf(anchor), 0);

    // Enough pages to reach the thumbnail scrolled to, and a page past a place left, so it can be scrolled to the start
    // of the view; plus those added by scrolling to the end (none for new choices).
    const [numAddedPages, setNumAddedPages] = useState<number>(0);
    const numNeeded = scrollTarget + 1 + ((current === undefined && scrollTarget > 0) ? PAGE_SIZE : 0);
    const numShown = (Math.ceil(numNeeded / PAGE_SIZE) + numAddedPages) * PAGE_SIZE;
    const shownChoices = choices.slice(0, numShown);
    const hasMore = numShown < choices.length;

    // Where the row stands, as its first thumbnail at least half in view, kept for the next panel of this id.
    const scrollerRef = useRef<HTMLDivElement>(null);
    const rememberPlace = () => {
        const scroller = scrollerRef.current;
        if (!scroller)
            return;
        // The thumbnails run left to right, so the first past the row's left edge is found by halving.
        const left = scroller.getBoundingClientRect().left;
        let low = 0, high = shownChoices.length;
        while (low < high)
        {
            const mid = Math.floor((low + high) / 2);
            const rect = document.getElementById(`${id}.${mid}`)?.getBoundingClientRect();
            if (rect && rect.left + 0.5 * rect.width < left)
                low = mid + 1;
            else
                high = mid;
        }
        if (low < shownChoices.length)
            placesLeft.set(id, shownChoices[low]);
        else
            placesLeft.delete(id);
    };

    const scrollTargetRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        setNumAddedPages(0);
        // Both axes given: leaving one at its default scrolls every scrollable ancestor (see AtlasCellSprite). A place
        // left goes back to the start of the view, where it was.
        scrollTargetRef.current?.scrollIntoView({ inline: (current === undefined) ? "start" : "center", block: "nearest" });
        rememberPlace();
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
        scrollerRef={scrollerRef} onScroll={rememberPlace} additionalClassNames="m-2">
        {choices.length == 0 && <>
            {emptyText && <Text content={emptyText} size="sm" additionalClassNames="self-center shrink-0"/>}
            {/* An unseen tile of no width, so the row stays as tall as with thumbnails in it. */}
            <div aria-hidden className={`${thumbnailClassNames} m-1.5 shrink-0 invisible`}
                style={{width: 0, marginLeft: 0, marginRight: 0}}/>
        </>}
        {shownChoices.map((choice, position) => {
            const choosable = canChoose?.(choice) ?? true;
            const highlightClassNames = (choice === current) ? "outline-4 outline-green-500 outline-offset-1" : "";
            // The margin leaves room for the highlight outline inside the scrolling row, and a thumbnail scrolled to
            // the start keeps it.
            return <div key={choice} id={`${id}.${position}`} ref={position == scrollTarget ? scrollTargetRef : undefined}
                aria-disabled={!choosable}
                onClick={choosable ? () => onChoose(choice) : undefined}
                className={`${thumbnailClassNames} m-1.5 scroll-ml-1.5 shrink-0 rounded-md ${highlightClassNames} ${choosable ? "cursor-pointer" : "opacity-30 cursor-not-allowed"}`}
            >
                {renderThumbnail(choice, position)}
            </div>;
        })}
        {hasMore && <div ref={endRef} className="w-px shrink-0"/>}
    </ScrollPanel>;
}

// Thumbnails mounted per page; mounting thousands at once (and requesting their images) doesn't scale.
const PAGE_SIZE = 30;

// Where each panel's row was last left, by id, for as long as the app runs.
const placesLeft = new Map<string, string | number>();

interface Props<K>
{
    // Lets automation address the panel, and each thumbnail by its position in the row (e.g. "lampSizeOptions.0").
    // Panels choosing the same thing share one, and with it the place their row was left.
    id: string;
    // In the row's order.
    choices: K[];
    // Absent when nothing is chosen yet (e.g. for an object about to be added).
    current?: K;
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
