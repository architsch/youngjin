import useMouseDragScroll from "../../../util/mouseDragScroll";
import ScrollHints from "../scrollHints";
import AtlasCellSprite from "./atlasCellSprite";

export default function ImageGrid({
    imageURL, selectedCol, selectedRow, numCols, numRows, cellWidth, cellHeight, onSelect}: Props)
{
    const onRefChange = useMouseDragScroll("vertical", "grabWhileDragging");
    const gridCoordsList: {col: number, row: number}[] = []
    for (let row = 0; row < numRows; ++row)
    {
        for (let col = 0; col < numCols; ++col)
        {
            gridCoordsList.push({col, row});
        }
    }

    const cellGap = 8; // gap-2 = 0.5rem
    const containerPadding = 8; // p-2 = 0.5rem
    const naturalWidth = numCols * cellWidth + (numCols - 1) * cellGap + containerPadding * 2;

    // The grid scrolls in a flex column, which ScrollHints needs around it. width sets the natural size for w-fit
    // ancestors, maxWidth caps it within the form, and max-h + overflow-y give it its own scrollbar; the column
    // template is inline, as Tailwind can't resolve dynamic class names.
    const scrollerStyle = {
        width: `${naturalWidth}px`,
        maxWidth: "100%",
    };
    const gridStyle = {
        gridTemplateColumns: `repeat(${numCols}, minmax(0, 1fr))`,
    };

    return <div ref={onRefChange} className="flex flex-col m-2 max-h-[60vh] overflow-y-auto pointer-events-auto rounded-md"
        style={scrollerStyle}>
        <ScrollHints/>
        <div className="grid gap-2 p-2 shrink-0" style={gridStyle}>
            {gridCoordsList.map((gridCoords) => {
                return <AtlasCellSprite
                    key={`imageGrid.select.${gridCoords.col}.${gridCoords.row}`}
                    atlasImageURL={imageURL}
                    atlasWidth={cellWidth * numCols}
                    atlasHeight={cellHeight * numRows}
                    atlasCellWidth={cellWidth}
                    atlasCellHeight={cellHeight}
                    atlasCellCol={gridCoords.col}
                    atlasCellRow={gridCoords.row}
                    flipRow={false}
                    highlight={gridCoords.col == selectedCol && gridCoords.row == selectedRow}
                    autoScrollToHighlight={true}
                    additionalClassNames={""}
                    onClick={() => onSelect(gridCoords.col, gridCoords.row)}
                />})
            }
        </div>
    </div>;
}

interface Props
{
    imageURL: string;
    selectedCol: number;
    selectedRow: number;
    numCols: number;
    numRows: number;
    cellWidth: number;
    cellHeight: number;
    onSelect: (col: number, row: number) => void;
}