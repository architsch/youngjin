import { ReactNode, useEffect, useRef, useState } from "react";
import Text from "../basic/text";
import ScrollPanel from "./scrollPanel";
import useThumbnailReorder from "../../util/thumbnailReorder";

// A row of thumbnails to pick one of (see ColorPaletteThumbnailPanel, CompositionThumbnailPanel,
// ImageMapThumbnailPanel). New choices scroll it to the current one (outlined) or, with none current or when
// resumed, to where the last panel of its id was left, or to its start if they leave that out; it grows a page at a
// time as it is scrolled to its end. A choice canChoose refuses is shown dimmed and can't be picked. With onReorder,
// its thumbnails can be rearranged by hand (see useThumbnailReorder), which leaves it where it stands; with onPickUp
// and onLetGo, the owner hears of each one picked up and let go.
export default function ThumbnailPanel<K extends string | number>({ id, choices, current, resumed = false, canChoose,
    onChoose, onReorder, onPickUp, onLetGo, canMove, renderThumbnail, thumbnailClassNames, emptyText, closeRowContent,
    overhang = false }: Props<K>)
{
    const [placeLeft] = useState(() => (current === undefined || resumed)
        ? placesLeft.get(id) as {choice: K, offset: number} | undefined : undefined);
    const anchor = placeLeft ? placeLeft.choice : current;
    const getScrollTarget = (row: K[]) => Math.max((anchor === undefined) ? -1 : row.indexOf(anchor), 0);
    const scrollTarget = getScrollTarget(choices);

    // Enough pages to reach the thumbnail scrolled to, and a page past a place left, so it can be scrolled to where it
    // stood in the view; plus those added by scrolling to the end (none for new choices).
    const [numAddedPages, setNumAddedPages] = useState<number>(0);
    const getNumPagesNeeded = (row: K[]) => {
        const target = getScrollTarget(row);
        return Math.ceil((target + 1 + ((placeLeft !== undefined && target > 0) ? PAGE_SIZE : 0)) / PAGE_SIZE);
    };
    const numShown = (getNumPagesNeeded(choices) + numAddedPages) * PAGE_SIZE;
    const shownChoices = choices.slice(0, numShown);
    const hasMore = numShown < choices.length;

    // Where the row stands, as its first thumbnail at least half in view and how far in that one is, kept for the
    // next panel of this id.
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
        const rect = document.getElementById(`${id}.${low}`)?.getBoundingClientRect();
        if (low < shownChoices.length && rect)
            placesLeft.set(id, {choice: shownChoices[low], offset: rect.left - left});
        else
            placesLeft.delete(id);
    };

    // The row as a thumbnail dropped elsewhere leaves it, which the owner is to give back as its choices.
    const rearrangedRef = useRef<K[] | null>(null);
    const canPickUp = onReorder != undefined || onPickUp != undefined;
    const holdThumbnail = useThumbnailReorder(id, scrollerRef, canPickUp ? position => {
        onPickUp?.(choices[position]);
        return onReorder != undefined && (canMove?.(choices[position]) ?? true);
    } : undefined, onReorder && ((from, to) => {
        const rearranged = [...choices];
        rearranged.splice(to, 0, ...rearranged.splice(from, 1));
        rearrangedRef.current = rearranged;
        // As many pages as now, wherever the thumbnail scrolled to ends up.
        setNumAddedPages(Math.max(numShown / PAGE_SIZE - getNumPagesNeeded(rearranged), 0));
        onReorder(choices[from], to);
    }), onLetGo);

    const scrollTargetRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const rearranged = rearrangedRef.current;
        rearrangedRef.current = null;
        // The same choices rearranged by hand stay where they stand.
        if (rearranged == null || rearranged.length != choices.length
            || rearranged.some((choice, position) => choice !== choices[position]))
        {
            setNumAddedPages(0);
            const scroller = scrollerRef.current, target = scrollTargetRef.current;
            // Both axes given: leaving one at its default scrolls every scrollable ancestor (see AtlasCellSprite).
            target?.scrollIntoView({ inline: (placeLeft || current === undefined) ? "start" : "center", block: "nearest" });
            // A place left goes back to where it stood in the view.
            if (scroller && target && placeLeft && choices[scrollTarget] === placeLeft.choice)
            {
                scroller.scrollLeft += target.getBoundingClientRect().left - scroller.getBoundingClientRect().left
                    - placeLeft.offset;
            }
        }
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

    return <ScrollPanel id={id} closeRowContent={closeRowContent} tight={true} overhang={overhang}
        scrollerRef={scrollerRef} onScroll={rememberPlace}>
        {choices.length == 0 && <>
            {emptyText && <Text content={emptyText} size="sm" additionalClassNames="self-center shrink-0"/>}
            {/* An unseen tile of no width, so the row stays as tall as with thumbnails in it. */}
            <div aria-hidden className={`${thumbnailClassNames} shrink-0 invisible`} style={{width: 0}}/>
        </>}
        {shownChoices.map((choice, position) => {
            const choosable = canChoose?.(choice) ?? true;
            const highlightClassNames = (choice === current) ? "outline-4 outline-green-500 outline-offset-1" : "";
            // The row's padding and gaps are the highlight outline's room (see ScrollPanel), and a thumbnail scrolled
            // to the start stands as far in as the first one does.
            return <div key={choice} id={`${id}.${position}`} ref={position == scrollTarget ? scrollTargetRef : undefined}
                aria-disabled={!choosable}
                onClick={choosable ? () => onChoose(choice) : undefined}
                onPointerDown={canPickUp ? event => holdThumbnail(event, position) : undefined}
                className={`${thumbnailClassNames} scroll-ml-2 shrink-0 rounded-md ${highlightClassNames} ${choosable ? "cursor-pointer" : "opacity-30 cursor-not-allowed"}`}
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
const placesLeft = new Map<string, {choice: string | number, offset: number}>();

interface Props<K>
{
    // Lets automation address the panel, and each thumbnail by its position in the row (e.g. "lampSizeOptions.0").
    // Panels choosing the same thing share one, and with it the place their row was left.
    id: string;
    // In the row's order.
    choices: K[];
    // Absent when nothing is chosen yet (e.g. for an object about to be added).
    current?: K;
    // Carries on from the last panel of its id (e.g. the one its object was just added from): it opens where that one
    // was left, not on the current choice.
    resumed?: boolean;
    // Absent means every one may be picked.
    canChoose?: (choice: K) => boolean;
    onChoose: (choice: K) => void;
    // A thumbnail was dropped at another position of the row, which the owner gives back as its choices so
    // rearranged. Absent means the row can't be rearranged.
    onReorder?: (choice: K, position: number) => void;
    // A thumbnail was held still long enough to be picked up, whether or not it may then be moved.
    onPickUp?: (choice: K) => void;
    // The one picked up was let go, moved or not.
    onLetGo?: () => void;
    // Absent means every one may be moved. One that may not is picked up all the same, and stays where it is.
    canMove?: (choice: K) => boolean;
    // What a thumbnail shows, inside a tile of thumbnailClassNames.
    renderThumbnail: (choice: K, position: number) => ReactNode;
    thumbnailClassNames: string;
    // Shown instead when there are no choices (e.g. a search matching nothing).
    emptyText?: string;
    closeRowContent?: ReactNode;
    // Lets thumbnails stick out over the panel's top edge (see ScrollPanel).
    overhang?: boolean;
}
