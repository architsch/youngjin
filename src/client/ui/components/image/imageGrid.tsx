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

    const gridStyle = `grid grid-cols-${numCols} grid-rows-${numRows} gap-2 p-2 w-full max-h-64 overflow-y-auto pointer-events-auto bg-black`;

    return <div ref={onRefChange} className={gridStyle}>
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