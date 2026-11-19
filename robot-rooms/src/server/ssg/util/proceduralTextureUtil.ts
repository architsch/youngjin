import RandomNumberGenerator from "../../../shared/math/types/randomNumberGenerator";
import Vec3 from "../../../shared/math/types/vec3";
import ColorUtil from "../../../shared/math/util/colorUtil";
import ProceduralTextureSpec from "../types/proceduralTextureSpec";

// Draws textures from a spec and a seed alone, so a build redraws the same pixels every time. Every pattern
// wraps at the texture's edges, which is what lets it tile without a seam.

// Strengths are shares of full brightness, lengths, thicknesses and radii are in pixels, and gloss is in color
// levels.
const METAL_PARAMS = {lines: 0.04, streakCols: 3, streakRows: 50, streakMinLength: 24, streakMaxLength: 110,
    streakMinThickness: 0.6, streakMaxThickness: 1.4, streakMinStrength: 0.45, streaks: 0.19, bandRadius: 4,
    gloss: 135};
const CONCRETE_PARAMS = {
    paintedConcrete: {broadRelief: 0.14, fineCells: 12, fineRelief: 0.05, poresPerSide: 30, poreMinRadius: 0.3,
        poreMaxRadius: 0.9, poreRelief: 0.07, poreShadow: 0.07, mottle: 0.03, grain: 0.012, tint: 0, gloss: 130},
    rawConcrete: {broadRelief: 0.12, fineCells: 16, fineRelief: 0.06, poresPerSide: 15, poreMinRadius: 0.3,
        poreMaxRadius: 1.5, poreRelief: 0.12, poreShadow: 0.16, mottle: 0.09, grain: 0.035, tint: 0.012, gloss: 0},
};

const ProceduralTextureUtil =
{
    // A square cell of raw RGB bytes, rows from the top. The texture tiles at the cell's size less its margins, and
    // the margin all round is its own continuation: what a lossy atlas bleeds in from the next cell stays there.
    generateCell: (spec: ProceduralTextureSpec, cellSize: number, margin: number, seed: number): Uint8Array =>
    {
        const period = cellSize - 2 * margin;
        const tile = drawTile(spec, period, seed);
        const cell = new Uint8Array(cellSize * cellSize * 3);
        for (let y = 0; y < cellSize; ++y)
        {
            const tileY = wrap(y - margin, period);
            for (let x = 0; x < cellSize; ++x)
            {
                const from = (tileY * period + wrap(x - margin, period)) * 3;
                cell.set(tile.subarray(from, from + 3), (y * cellSize + x) * 3);
            }
        }
        return cell;
    },
}

function drawTile(spec: ProceduralTextureSpec, size: number, seed: number): Uint8Array
{
    const rand = new RandomNumberGenerator(seed);
    const color = ColorUtil.hexToRGB(spec.colorHex);
    return (spec.surface == "metal")
        ? drawMetal(rand, size, color)
        : drawConcrete(rand, size, color, CONCRETE_PARAMS[spec.surface]);
}

// Brushed along x: a fine line to every row, under thin bright streaks where the grooves catch the light. All of
// its shine is in those: a sheen any broader would show as a pattern where the texture repeats.
function drawMetal(rand: RandomNumberGenerator, size: number, color: Vec3): Uint8Array
{
    const params = METAL_PARAMS;
    // A line to a row of pixels, running the whole width and changing only slowly along it.
    const lines = sumLayers(rand, size, [[1, size, 0.6], [2, size, 0.4]], valueNoise);
    const streaks = drawStreaks(rand, size, params);
    const shine = new Float32Array(size * size);
    for (let i = 0; i < shine.length; ++i)
        shine[i] = lines[i] * params.lines + streaks[i] * params.streaks;

    const brightness = new Float32Array(size * size);
    const gloss = new Float32Array(size * size);
    for (let y = 0; y < size; ++y)
    {
        for (let x = 0; x < size; ++x)
        {
            const i = y * size + x;
            // Less the average of the rows around it: random rows also drift in broad bands, which would stand
            // out where the texture repeats.
            let nearby = 0;
            for (let offset = -params.bandRadius; offset <= params.bandRadius; ++offset)
                nearby += shine[wrap(y + offset, size) * size + x];
            const value = shine[i] - nearby / (2 * params.bandRadius + 1);
            brightness[i] = 1 + value;
            // Partly added rather than multiplied, so that a dark metal shines too.
            gloss[i] = value * params.gloss;
        }
    }
    return toPixels(color, brightness, gloss);
}

// How bright each pixel is with the streak along x that crosses it, [0,1]. One streak to a cell of a grid, anywhere
// within it (spread evenly, as the pores are), fading towards both its ends.
function drawStreaks(rand: RandomNumberGenerator, size: number, params: typeof METAL_PARAMS): Float32Array
{
    const streaks = new Float32Array(size * size);
    const spacingX = size / params.streakCols;
    const spacingY = size / params.streakRows;
    for (let row = 0; row < params.streakRows; ++row)
    {
        for (let col = 0; col < params.streakCols; ++col)
        {
            const centerX = (col + rand.randomFloat(0, 1)) * spacingX;
            const centerY = (row + rand.randomFloat(0, 1)) * spacingY;
            const halfLength = rand.randomFloat(params.streakMinLength, params.streakMaxLength) / 2;
            const halfThickness = rand.randomFloat(params.streakMinThickness, params.streakMaxThickness) / 2;
            const strength = rand.randomFloat(params.streakMinStrength, 1);
            const reachX = Math.ceil(halfLength);
            const reachY = Math.ceil(halfThickness + 1);
            for (let dy = -reachY; dy <= reachY; ++dy)
            {
                const y = Math.floor(centerY) + dy;
                // Its edge fades over a pixel, so one thinner than a row of pixels is fainter rather than narrower.
                const across = Math.min(1, halfThickness + 0.5 - Math.abs(y + 0.5 - centerY));
                if (across <= 0)
                    continue;
                for (let dx = -reachX; dx <= reachX; ++dx)
                {
                    const x = Math.floor(centerX) + dx;
                    const along = 1 - ((x + 0.5 - centerX) / halfLength) ** 2;
                    if (along <= 0)
                        continue;
                    const i = wrap(y, size) * size + wrap(x, size);
                    streaks[i] = Math.max(streaks[i], strength * across * along * along * along);
                }
            }
        }
    }
    return streaks;
}

// A height field (broad unevenness, a fine texture, pores) lit from the upper left, over a mottled surface.
function drawConcrete(rand: RandomNumberGenerator, size: number, color: Vec3,
    params: typeof CONCRETE_PARAMS.paintedConcrete): Uint8Array
{
    const numPixels = size * size;
    const broad = fractalNoise(rand, size, 2, 3, 0.5);
    const fine = fractalNoise(rand, size, params.fineCells, 2, 0.7);
    const pores = drawPores(rand, size, params);
    const height = new Float32Array(numPixels);
    for (let i = 0; i < numPixels; ++i)
        height[i] = broad[i] * params.broadRelief + fine[i] * params.fineRelief - pores[i] * params.poreRelief;

    const mottle = fractalNoise(rand, size, 2, 3, 0.6);
    const grain = valueNoise(rand, size, size, size);
    const tint = (params.tint > 0)
        ? fractalNoise(rand, size, 2, 2, 0.5).map(value => value * params.tint) : undefined;

    const brightness = new Float32Array(numPixels);
    const gloss = new Float32Array(numPixels);
    for (let y = 0; y < size; ++y)
    {
        const rowAbove = wrap(y - 1, size) * size;
        const rowBelow = wrap(y + 1, size) * size;
        for (let x = 0; x < size; ++x)
        {
            const i = y * size + x;
            const slopeX = height[y * size + wrap(x + 1, size)] - height[y * size + wrap(x - 1, size)];
            const slopeY = height[rowBelow + x] - height[rowAbove + x];
            const shade = 1 + 0.5 * (slopeX + slopeY);
            brightness[i] = Math.max(0.05, shade * (1 + mottle[i] * params.mottle + grain[i] * params.grain)
                * (1 - pores[i] * params.poreShadow));
            // A paint's sheen is as bright on a dark color as on a light one, which is what shows a dark wall's
            // relief.
            gloss[i] = (shade - 1) * params.gloss;
        }
    }
    return toPixels(color, brightness, gloss, tint);
}

// How deep into a pore each pixel is, [0,1]. One pore to a square of a grid, anywhere within it: spread evenly,
// so that no cluster of them marks where the texture repeats.
function drawPores(rand: RandomNumberGenerator, size: number,
    params: typeof CONCRETE_PARAMS.paintedConcrete): Float32Array
{
    const pores = new Float32Array(size * size);
    const spacing = size / params.poresPerSide;
    for (let row = 0; row < params.poresPerSide; ++row)
    {
        for (let col = 0; col < params.poresPerSide; ++col)
        {
            const centerX = (col + rand.randomFloat(0, 1)) * spacing;
            const centerY = (row + rand.randomFloat(0, 1)) * spacing;
            const radius = rand.randomFloat(params.poreMinRadius, params.poreMaxRadius);
            const reach = Math.ceil(radius + 1);
            for (let dy = -reach; dy <= reach; ++dy)
            {
                for (let dx = -reach; dx <= reach; ++dx)
                {
                    const x = Math.floor(centerX) + dx;
                    const y = Math.floor(centerY) + dy;
                    // Its edge fades over a pixel, which is what keeps one this small round.
                    const depth = Math.min(1, radius + 0.5 - Math.hypot(x + 0.5 - centerX, y + 0.5 - centerY));
                    if (depth <= 0)
                        continue;
                    const i = wrap(y, size) * size + wrap(x, size);
                    pores[i] = Math.max(pores[i], depth);
                }
            }
        }
    }
    return pores;
}

// RGB bytes of a color under a brightness per pixel, which is scaled to average 1 so the texture keeps its color
// overall; gloss adds to every channel alike (about its own average), and tint warms where positive.
function toPixels(color: Vec3, brightness: Float32Array, gloss?: Float32Array, tint?: Float32Array): Uint8Array
{
    const numPixels = brightness.length;
    let brightnessMean = 0;
    let glossMean = 0;
    for (let i = 0; i < numPixels; ++i)
    {
        brightnessMean += brightness[i];
        glossMean += gloss ? gloss[i] : 0;
    }
    brightnessMean /= numPixels;
    glossMean /= numPixels;

    const pixels = new Uint8Array(numPixels * 3);
    for (let i = 0; i < numPixels; ++i)
    {
        const b = brightness[i] / brightnessMean;
        const g = gloss ? gloss[i] - glossMean : 0;
        const t = tint ? tint[i] : 0;
        pixels[i * 3] = toByte(color.x * b * (1 + t) + g);
        pixels[i * 3 + 1] = toByte(color.y * b + g);
        pixels[i * 3 + 2] = toByte(color.z * b * (1 - t) + g);
    }
    return pixels;
}

// Layers of one kind of noise, each [cells along x, cells along y, weight], summed by weight.
function sumLayers(rand: RandomNumberGenerator, size: number, layers: number[][],
    noise: (rand: RandomNumberGenerator, size: number, cellsX: number, cellsY: number) => Float32Array): Float32Array
{
    const field = new Float32Array(size * size);
    for (const [cellsX, cellsY, weight] of layers)
    {
        const layer = noise(rand, size, cellsX, cellsY);
        for (let i = 0; i < field.length; ++i)
            field[i] += layer[i] * weight;
    }
    return field;
}

// Octaves of gradient noise, each twice as fine as the one before and `gain` as strong; about [-1,1].
function fractalNoise(rand: RandomNumberGenerator, size: number, cells: number, numOctaves: number,
    gain: number): Float32Array
{
    const field = new Float32Array(size * size);
    let amplitude = 1;
    let totalAmplitude = 0;
    for (let octave = 0; octave < numOctaves; ++octave)
    {
        const layer = gradientNoise(rand, size, cells << octave, cells << octave);
        for (let i = 0; i < field.length; ++i)
            field[i] += layer[i] * amplitude;
        totalAmplitude += amplitude;
        amplitude *= gain;
    }
    for (let i = 0; i < field.length; ++i)
        field[i] /= totalAmplitude;
    return field;
}

// Smooth noise in about [-1,1], from random gradients on a lattice of cellsX by cellsY cells that wraps.
function gradientNoise(rand: RandomNumberGenerator, size: number, cellsX: number, cellsY: number): Float32Array
{
    const gradientX = new Float32Array(cellsX * cellsY);
    const gradientY = new Float32Array(cellsX * cellsY);
    for (let i = 0; i < gradientX.length; ++i)
    {
        const angle = rand.randomFloat(0, 2 * Math.PI);
        gradientX[i] = Math.cos(angle);
        gradientY[i] = Math.sin(angle);
    }

    const field = new Float32Array(size * size);
    for (let y = 0; y < size; ++y)
    {
        const v = (y + 0.5) * cellsY / size;
        const y0 = Math.floor(v);
        const y1 = (y0 + 1) % cellsY;
        const fy = v - y0;
        for (let x = 0; x < size; ++x)
        {
            const u = (x + 0.5) * cellsX / size;
            const x0 = Math.floor(u);
            const x1 = (x0 + 1) % cellsX;
            const fx = u - x0;
            const i00 = y0 * cellsX + x0, i10 = y0 * cellsX + x1;
            const i01 = y1 * cellsX + x0, i11 = y1 * cellsX + x1;
            const top = lerp(gradientX[i00] * fx + gradientY[i00] * fy,
                gradientX[i10] * (fx - 1) + gradientY[i10] * fy, fade(fx));
            const bottom = lerp(gradientX[i01] * fx + gradientY[i01] * (fy - 1),
                gradientX[i11] * (fx - 1) + gradientY[i11] * (fy - 1), fade(fx));
            field[y * size + x] = lerp(top, bottom, fade(fy)) * Math.SQRT2;
        }
    }
    return field;
}

// Noise in [-1,1] from random values on a lattice that wraps; a lattice as fine as the pixels is white noise.
function valueNoise(rand: RandomNumberGenerator, size: number, cellsX: number, cellsY: number): Float32Array
{
    const lattice = new Float32Array(cellsX * cellsY);
    for (let i = 0; i < lattice.length; ++i)
        lattice[i] = rand.randomFloat(-1, 1);

    const field = new Float32Array(size * size);
    for (let y = 0; y < size; ++y)
    {
        const v = y * cellsY / size;
        const y0 = Math.floor(v);
        const y1 = (y0 + 1) % cellsY;
        for (let x = 0; x < size; ++x)
        {
            const u = x * cellsX / size;
            const x0 = Math.floor(u);
            const x1 = (x0 + 1) % cellsX;
            field[y * size + x] = lerp(
                lerp(lattice[y0 * cellsX + x0], lattice[y0 * cellsX + x1], fade(u - x0)),
                lerp(lattice[y1 * cellsX + x0], lattice[y1 * cellsX + x1], fade(u - x0)), fade(v - y0));
        }
    }
    return field;
}

function fade(t: number): number
{
    return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number
{
    return a + (b - a) * t;
}

function wrap(n: number, period: number): number
{
    return ((n % period) + period) % period;
}

function toByte(value: number): number
{
    return Math.max(0, Math.min(255, Math.round(value)));
}

export default ProceduralTextureUtil;
