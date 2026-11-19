import { CSSProperties, useLayoutEffect, useRef } from "react";
import App from "../../../app";
import ImageMap from "../../../../shared/graphics/image/types/imageMap";
import ImageMetadata from "../../../../shared/graphics/image/types/imageMetadata";
import useGridReorder from "../../util/gridReorder";

// Images of an image map as a grid of thumbnails of the size given, in the order given: left to right, then top to
// bottom (see AdminAssetSettingsEditor). A click selects one, and a click beside them none; one dragged is selected
// too, and is put where it is dropped, or with onDropOut, dropped on what it is dragged out of the grid onto (see
// useGridReorder). Each is tagged with its number, red for a staging one and black for an enabled one, and those
// filed under markedCategory are framed.
export default function ImageOrderGrid({ id, imageMap, images, selectedPath, markedCategory, tileSize, onSelect,
    onMove, onDropOut, additionalClassNames = "" }: Props)
{
    const assetsURL = App.getEnv().assets_url;
    const scrollerRef = useRef<HTMLDivElement>(null);
    const tileGridRef = useRef<HTMLDivElement>(null);
    const holdTile = useGridReorder(tileGridRef, scrollerRef, position => onSelect(images[position].path),
        (from, to) => onMove(images[from].path, to),
        onDropOut && ((from, target) => onDropOut(images[from].path, target)));

    // Kept in view as the thumbnails change size, which rearranges their rows.
    const selectedRef = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        // Both axes given: leaving one at its default scrolls every scrollable ancestor (see AtlasCellSprite).
        selectedRef.current?.scrollIntoView({ inline: "nearest", block: "nearest" });
    }, [tileSize]);

    // The grid's padding and gaps are the highlight outline's room, as is the margin a thumbnail is scrolled to with.
    return <div id={id} ref={scrollerRef} onClick={() => onSelect(undefined)}
        className={`overflow-y-auto bg-gray-700 rounded-lg yj-surface-convex yj-visible-scrollbar ${additionalClassNames}`}>
        <div ref={tileGridRef} className="relative flex flex-row flex-wrap gap-2 p-2"
            style={{"--yj-tile-size": `${tileSize}px`} as CSSProperties}>
            {images.map((image, position) => <div key={image.path} id={`${id}.${position}`}
                ref={(image.path == selectedPath) ? selectedRef : undefined}
                onClick={event => {
                    event.stopPropagation();
                    onSelect(image.path);
                }}
                onPointerDown={event => holdTile(event, position)}
                className={`relative size-(--yj-tile-size) flex items-center justify-center shrink-0 scroll-m-2 bg-gray-800 rounded-md cursor-pointer ${(image.path == selectedPath) ? "outline-4 outline-green-500 outline-offset-1" : ""}`}>
                {/* Not draggable, so dragging one moves its tile. */}
                <img src={imageMap.getThumbnailURLByPath(assetsURL, image.path)} alt="" draggable={false} loading="lazy"
                    className="max-w-full max-h-full object-contain pointer-events-none select-none"/>
                {markedCategory != undefined && ImageMap.getCategories(image.keywords).includes(markedCategory)
                    && <span className="absolute inset-0 rounded-md border-3 border-amber-400 pointer-events-none"/>}
                <span title={image.staging ? "Staging: not offered on the live server" : "Enabled: offered on the live server too"}
                    className={`absolute top-0 right-0 min-w-3 h-3 px-1 flex items-center justify-center rounded-full ring-1 ${image.staging ? "bg-red-500 ring-black/50" : "bg-black ring-white/50"} text-[9px] font-bold leading-none text-white select-none`}>
                    {image.path.substring(image.path.indexOf("/") + 1)}
                </span>
            </div>)}
        </div>
    </div>;
}

interface Props
{
    // Lets automation address the grid, and each thumbnail by its place in the order (e.g. "imageOrderGrid.0").
    id: string;
    imageMap: ImageMap;
    // In the order shown.
    images: ImageMetadata[];
    // Absent when none is selected.
    selectedPath?: string;
    // The category whose images are marked, if any.
    markedCategory?: string;
    // A thumbnail's width and height, in CSS px.
    tileSize: number;
    onSelect: (path: string | undefined) => void;
    // A thumbnail was dropped at another place of the order, which the owner gives back as its images so rearranged.
    onMove: (path: string, position: number) => void;
    // A thumbnail was dragged out of the grid and dropped on a drop target, which named itself so (see TreeRow).
    // Absent means none can be dragged out.
    onDropOut?: (path: string, target: string) => void;
    additionalClassNames?: string;
}
