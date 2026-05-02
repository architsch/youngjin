import { useCallback } from "react";
import { enableVerticalDragScroll } from "../../util/mouseScroll";
import AtlasCellSprite from "./atlasCellSprite";

export default function ImageGrid({
    imageURL, selectedCol, selectedRow, numCols, numRows, cellSize, onSelect}: Props)
{
    const onRefChange = useCallback((node: any) => {
        if (node)
            enableVerticalDragScroll(node as HTMLElement);
    }, []);

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

    const gridClassNames = "grid gap-2 m-2 p-2 min-h-0 overflow-y-auto pointer-events-auto bg-black";
    // Tailwind's JIT compiler cannot resolve dynamically-built class names like `grid-cols-${numCols}`,
    // so the column template is set inline. Height is bounded by the parent flex container; min-h-0 lets
    // this grid shrink so it scrolls internally instead of pushing siblings out of view.
    const gridStyle = {
        gridTemplateColumns: `repeat(${numCols}, minmax(0, 1fr))`,
        width: `min(${naturalWidth}px, 90vw)`,
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