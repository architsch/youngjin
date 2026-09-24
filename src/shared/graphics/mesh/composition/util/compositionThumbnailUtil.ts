import type ObjectTypeConfig from "../../../../object/types/objectTypeConfig/objectTypeConfig";

// Layout of the per-type thumbnail atlases of pre-encoded compositions (see
// CompositionThumbnailBuilder): the type's entries in PreEncodedCompositionIndexMap order, row by row.
const CELL_SIZE = 128; // in pixels (cells are square)
const NUM_COLS = 8;

// For types that don't set their own thumbnail view: a true isometric view.
const ISOMETRIC_VIEW = {yawDeg: 45, pitchDeg: Math.atan(1 / Math.SQRT2) * 180 / Math.PI};

const CompositionThumbnailUtil =
{
    getCellSize: (): number => CELL_SIZE,
    getNumCols: (numThumbnails: number): number => Math.max(1, Math.min(NUM_COLS, numThumbnails)),
    getNumRows: (numThumbnails: number): number => Math.max(1, Math.ceil(numThumbnails / NUM_COLS)),
    // position: the entry's position within its type's list, not its composition index.
    getCell: (position: number): {col: number, row: number} =>
    {
        return {col: position % NUM_COLS, row: Math.floor(position / NUM_COLS)};
    },
    // Relative to the app's assets directory.
    getAtlasPath: (objectType: string): string =>
    {
        return `instanced_mesh_composition/thumbnails/${objectType}.webp`;
    },
    getView: (config: ObjectTypeConfig): {yawDeg: number, pitchDeg: number} =>
    {
        return config.components.spawnedByAny?.instancedMeshComposer?.thumbnailView ?? ISOMETRIC_VIEW;
    },
}

export default CompositionThumbnailUtil;
