import useMouseDragScroll from "../../../util/mouseDragScroll";
import AtlasCellSprite from "./atlasCellSprite";

export default function ImageGrid({
    imageURL, selectedCol, selectedRow, numCols, numRows, cellSize, onSelect}: Props)
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
    const naturalWidth = numCols * cellSize + (numCols - 1) * cellGap + containerPadding * 2;

    const gridClassNames = "grid gap-2 m-2 p-2 max-h-[60vh] overflow-y-auto pointer-events-auto rounded-md";
    // Inline column template (Tailwind can't resolve dynamic class names). width sets the natural
    // size for w-fit ancestors, maxWidth caps it within the form, and max-h + overflow-y give the grid
    // its own scrollbar.
    const gridStyle = {
        gridTemplateColumns: `repeat(${numCols}, minmax(0, 1fr))`,
        width: `${naturalWidth}px`,
        maxWidth: "100%",
    };

    return <div ref={onRefChange} className={gridClassNames} style={gridStyle}>
        {gridCoordsList.map((gridCoords) => {
            return <AtlasCellSprite
                key={`imageGrid.select.${gridCoords.col}.${gridCoords.row}`}
                atlasImageURL={imageURL}
                atlasWidth={cellSize * numCols}
                atlasHeight={cellSize * numRows}
                atlasCellWidth={cellSize}
                atlasCellHeight={cellSize}
                atlasCellCol={gridCoords.col}
                atlasCellRow={gridCoords.row}
                flipRow={false}
                highlight={gridCoords.col == selectedCol && gridCoords.row == selectedRow}
                autoScrollToHighlight={true}
                additionalClassNames={""}
                onClick={() => onSelect(gridCoords.col, gridCoords.row)}
            />})
        }
    </div>;
}

interface Props
{
    imageURL: string;
    selectedCol: number;
    selectedRow: number;
    numCols: number;
    numRows: number;
    cellSize: number;
    onSelect: (col: number, row: number) => void;
}