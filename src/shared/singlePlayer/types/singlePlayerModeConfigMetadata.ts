type SinglePlayerModeConfigMetadata = {
    entranceVoxelCol: number,
    entranceVoxelRow: number,
    hotspots: {[name: string]: {row: number, col: number}},
    rects: {[name: string]: {rowStart: number, colStart: number, numRows: number, numCols: number}},
}

export default SinglePlayerModeConfigMetadata;