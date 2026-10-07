import { NUM_COLLISION_LAYERS, NUM_VOXEL_SUB_BLOCKS, NUM_VOXEL_SUB_COLS, NUM_VOXEL_SUB_ROWS }
    from "../../../../shared/system/sharedConstants";

// Smooths the light field across neighbouring sub-blocks. Linear texture filtering has slope
// discontinuities at sub-block boundaries that read as facets. Separable per-axis sweeps, which visit
// only the columns of layers that light is in or beside (most of a room is usually dark).

// Narrow tent kernel; wider would visibly shift light away from its lamp.
const CENTER_WEIGHT = 0.5;
const NEIGHBOR_WEIGHT = 0.25;

// What renormalizes a sum, by how many of the two neighbours took part in it.
const NORMALIZE_BY_NUM_NEIGHBORS = [
    1 / CENTER_WEIGHT,
    1 / (CENTER_WEIGHT + NEIGHBOR_WEIGHT),
    1 / (CENTER_WEIGHT + 2 * NEIGHBOR_WEIGHT),
];

// Strides follow the sub-block index layout: layer fastest, then sub-column, then sub-row. So a column
// (one sub-column of one sub-row) is a contiguous run of layers.
const LAYER_STRIDE = 1;
const COL_STRIDE = NUM_COLLISION_LAYERS;
const ROW_STRIDE = NUM_VOXEL_SUB_COLS * NUM_COLLISION_LAYERS;
const NUM_COLUMNS = NUM_VOXEL_SUB_COLS * NUM_VOXEL_SUB_ROWS;

// Reused across runs (this runs on every lamp drag).
const lightScratch = new Float32Array(NUM_VOXEL_SUB_BLOCKS * 3);
const fluxScratch = new Float32Array(NUM_VOXEL_SUB_BLOCKS * 3);

// The columns each sweep visits: those holding light, then those beside them along x as well (a sweep
// carries light one column over), then those beside these along z.
const columnsForLayerSweep = new Uint8Array(NUM_COLUMNS);
const columnsForColSweep = new Uint8Array(NUM_COLUMNS);
const columnsForRowSweep = new Uint8Array(NUM_COLUMNS);

const LightBlockSmoothingUtil =
{
    // In place; 3 entries per sub-block. The direction field is smoothed in step with the light: it would
    // otherwise band, and its length must stay within the light's (see LightBlockPropagationUtil), which
    // also means it is dark wherever the light is. isOpen: see LightSubBlockUtil.markOpen.
    smooth(light: Float32Array, flux: Float32Array, isOpen: Uint8Array)
    {
        if (!markLitColumns(light, columnsForLayerSweep))
            return;
        spreadColumns(columnsForLayerSweep, columnsForColSweep, 1, NUM_VOXEL_SUB_COLS);
        spreadColumns(columnsForColSweep, columnsForRowSweep, NUM_VOXEL_SUB_COLS, NUM_VOXEL_SUB_ROWS);

        // A sweep writes only the columns it visits, so its target must already be dark everywhere else.
        // The fields are; the scratch still holds the last run's light.
        lightScratch.fill(0);
        fluxScratch.fill(0);

        sweep(light, lightScratch, flux, fluxScratch, isOpen, columnsForLayerSweep,
            LAYER_STRIDE, NUM_COLLISION_LAYERS);
        sweep(lightScratch, light, fluxScratch, flux, isOpen, columnsForColSweep,
            COL_STRIDE, NUM_VOXEL_SUB_COLS);
        sweep(light, lightScratch, flux, fluxScratch, isOpen, columnsForRowSweep,
            ROW_STRIDE, NUM_VOXEL_SUB_ROWS);
        light.set(lightScratch);
        flux.set(fluxScratch);
    },
}

// Returns whether any column holds light at all.
function markLitColumns(light: Float32Array, outColumns: Uint8Array): boolean
{
    const entriesPerColumn = NUM_COLLISION_LAYERS * 3;
    let anyIsLit = false;
    for (let column = 0; column < NUM_COLUMNS; ++column)
    {
        const first = column * entriesPerColumn;
        let isLit = 0;
        for (let entry = first; entry < first + entriesPerColumn; ++entry)
        {
            if (light[entry] !== 0)
            {
                isLit = 1;
                anyIsLit = true;
                break;
            }
        }
        outColumns[column] = isLit;
    }
    return anyIsLit;
}

// Adds to a set of columns those next to them along x or z. columnStride: how far apart, in columns, two
// such neighbours are.
function spreadColumns(columns: Uint8Array, outColumns: Uint8Array, columnStride: number, axisLength: number)
{
    for (let column = 0; column < NUM_COLUMNS; ++column)
    {
        // Prevents wrapping across the grid edge.
        const positionAlongAxis = Math.floor(column / columnStride) % axisLength;
        outColumns[column] = (columns[column] !== 0 ||
            (positionAlongAxis > 0 && columns[column - columnStride] !== 0) ||
            (positionAlongAxis < axisLength - 1 && columns[column + columnStride] !== 0)) ? 1 : 0;
    }
}

// One axis of the kernel, over both fields at once (they share every test of openness). Solid sub-blocks
// are excluded and weights renormalized, so light never crosses walls while smoothing.
function sweep(sourceLight: Float32Array, targetLight: Float32Array,
    sourceFlux: Float32Array, targetFlux: Float32Array, isOpen: Uint8Array, columns: Uint8Array,
    stride: number, axisLength: number)
{
    const entryStride = stride * 3;
    for (let column = 0; column < NUM_COLUMNS; ++column)
    {
        if (columns[column] === 0)
            continue;

        const firstSubBlockIndex = column * NUM_COLLISION_LAYERS;
        // Along x or z a column lies at one position; along y each of its layers is one.
        const columnPosition = Math.floor(firstSubBlockIndex / stride) % axisLength;
        for (let layer = 0; layer < NUM_COLLISION_LAYERS; ++layer)
        {
            const subBlockIndex = firstSubBlockIndex + layer;
            const at = subBlockIndex * 3;
            if (isOpen[subBlockIndex] === 0)
            {
                targetLight[at] = 0;
                targetLight[at + 1] = 0;
                targetLight[at + 2] = 0;
                targetFlux[at] = 0;
                targetFlux[at + 1] = 0;
                targetFlux[at + 2] = 0;
                continue;
            }

            let lightR = sourceLight[at] * CENTER_WEIGHT;
            let lightG = sourceLight[at + 1] * CENTER_WEIGHT;
            let lightB = sourceLight[at + 2] * CENTER_WEIGHT;
            let fluxX = sourceFlux[at] * CENTER_WEIGHT;
            let fluxY = sourceFlux[at + 1] * CENTER_WEIGHT;
            let fluxZ = sourceFlux[at + 2] * CENTER_WEIGHT;

            // Prevents wrapping across the grid edge.
            const positionAlongAxis = (stride === LAYER_STRIDE) ? layer : columnPosition;
            let numNeighbors = 0;
            if (positionAlongAxis > 0 && isOpen[subBlockIndex - stride] !== 0)
            {
                const lower = at - entryStride;
                lightR += sourceLight[lower] * NEIGHBOR_WEIGHT;
                lightG += sourceLight[lower + 1] * NEIGHBOR_WEIGHT;
                lightB += sourceLight[lower + 2] * NEIGHBOR_WEIGHT;
                fluxX += sourceFlux[lower] * NEIGHBOR_WEIGHT;
                fluxY += sourceFlux[lower + 1] * NEIGHBOR_WEIGHT;
                fluxZ += sourceFlux[lower + 2] * NEIGHBOR_WEIGHT;
                ++numNeighbors;
            }
            if (positionAlongAxis < axisLength - 1 && isOpen[subBlockIndex + stride] !== 0)
            {
                const upper = at + entryStride;
                lightR += sourceLight[upper] * NEIGHBOR_WEIGHT;
                lightG += sourceLight[upper + 1] * NEIGHBOR_WEIGHT;
                lightB += sourceLight[upper + 2] * NEIGHBOR_WEIGHT;
                fluxX += sourceFlux[upper] * NEIGHBOR_WEIGHT;
                fluxY += sourceFlux[upper + 1] * NEIGHBOR_WEIGHT;
                fluxZ += sourceFlux[upper + 2] * NEIGHBOR_WEIGHT;
                ++numNeighbors;
            }

            const normalize = NORMALIZE_BY_NUM_NEIGHBORS[numNeighbors];
            targetLight[at] = lightR * normalize;
            targetLight[at + 1] = lightG * normalize;
            targetLight[at + 2] = lightB * normalize;
            targetFlux[at] = fluxX * normalize;
            targetFlux[at + 1] = fluxY * normalize;
            targetFlux[at + 2] = fluxZ * normalize;
        }
    }
}

export default LightBlockSmoothingUtil;
