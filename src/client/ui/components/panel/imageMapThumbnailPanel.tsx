import { useEffect, useMemo, useRef, useState } from "react";
import App from "../../../app";
import ImageMapUtil from "../../../../shared/graphics/image/util/imageMapUtil";
import ImageChoiceUtil from "../../util/imageChoiceUtil";
import Text from "../basic/text";
import TextInput from "../input/textInput";
import ScrollPanel from "./scrollPanel";

// Picks an image of one of an image map's subfolders from its thumbnails: one shuffled row, the current image
// first, narrowed by the search bar beneath it by the images' keywords (see ImageChoiceUtil). Thumbnails are added
// a page at a time as the row is scrolled to its end. An image canChoose refuses is shown dimmed and can't be picked.
export default function ImageMapThumbnailPanel({ id, searchInputId, searchPlaceholder, mapName, subfolder,
    currentPath, canChoose, onChoose, onClose }: Props)
{
    const imageMap = ImageMapUtil.getImageMap(mapName);
    const assetsURL = App.getEnv().assets_url;
    const [searchInput, setSearchInput] = useState<string>("");

    // Shuffled once, so the row holds still while images are tried from it.
    const allItems = useMemo(() => ImageChoiceUtil.getShuffledItems(imageMap, subfolder, currentPath),
        [mapName, subfolder]);
    const filteredItems = useMemo(() => ImageChoiceUtil.getFilteredItems(allItems, searchInput),
        [allItems, searchInput]);
    const [pageIndex, setPageIndex] = useState<number>(0);
    const pageItems = ImageChoiceUtil.getPageItems(filteredItems, pageIndex);
    const hasMore = ImageChoiceUtil.hasMore(filteredItems, pageIndex);

    // A new search starts again from the row's first page, scrolled to its start.
    const firstRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        setPageIndex(0);
        firstRef.current?.scrollIntoView({ inline: "nearest", block: "nearest" });
    }, [filteredItems]);

    // Observed afresh after every page, so an end still in view once a page is added asks for the next.
    const endRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const end = endRef.current;
        if (!end || !hasMore)
            return;
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting))
                setPageIndex(p => p + 1);
        });
        observer.observe(end);
        return () => observer.disconnect();
    }, [pageItems.length, hasMore]);

    return <>
        <ScrollPanel id={id} onClose={onClose} additionalClassNames="m-2">
            {filteredItems.length == 0 && <Text content="No images match your search." size="sm"
                additionalClassNames="self-center shrink-0"/>}
            {pageItems.map((metadata, position) => {
                const choosable = canChoose(metadata.path);
                const highlightClassNames = (metadata.path === currentPath)
                    ? "outline-4 outline-green-500 outline-offset-1" : "";
                // The margin leaves room for the highlight outline inside the scrolling row.
                return <div key={metadata.path} id={`${id}.${position}`} ref={position == 0 ? firstRef : undefined}
                    aria-disabled={!choosable}
                    onClick={choosable ? () => onChoose(metadata.path) : undefined}
                    className={`size-20 m-1.5 shrink-0 flex items-center justify-center rounded-md bg-gray-800 ${highlightClassNames} ${choosable ? "cursor-pointer" : "opacity-30 cursor-not-allowed"}`}
                >
                    {/* Not draggable, so dragging across the row scrolls it. */}
                    <img src={imageMap.getThumbnailURLByPath(assetsURL, metadata.path)} alt=""
                        draggable={false} className="max-w-full max-h-full object-contain pointer-events-none select-none"/>
                </div>;
            })}
            {hasMore && <div ref={endRef} className="w-px shrink-0"/>}
        </ScrollPanel>
        {/* Where the tools it was opened from were, as wide as the screen allows up to a comfortable length. */}
        <TextInput id={searchInputId} size="sm" placeholder={searchPlaceholder} currValue={searchInput}
            setTextInput={setSearchInput} additionalClassNames="w-full max-w-lg h-10"/>
    </>;
}

interface Props
{
    // Lets automation address the panel, and each thumbnail by its position in the row (e.g. "canvasImageOptions.0").
    id: string;
    searchInputId: string;
    // What the keywords hold, which differs by subfolder (a painting's are its title and author).
    searchPlaceholder: string;
    mapName: string;
    subfolder: string;
    currentPath: string;
    canChoose: (path: string) => boolean;
    onChoose: (path: string) => void;
    onClose: () => void;
}
