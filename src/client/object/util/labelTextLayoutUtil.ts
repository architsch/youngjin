// Line breaking and font sizing for label text (see LabelText), apart from any canvas so it can be tested.
// Widths come from measureWidth: a string's width at a font size of 1, since widths scale with the size.

const LINE_SPACING = 1.15;

// Enough halvings to settle a font size (or a line width) well below a pixel.
const NUM_SEARCH_STEPS = 32;

const LabelTextLayoutUtil =
{
    lineSpacing: LINE_SPACING,

    // Auto size: the largest size at which the whole text fits in width x height, words kept whole, with the
    // words then spread evenly over its lines (so none is stranded alone on the last). Otherwise: the given
    // size, a word wider than a line broken between characters, and the lines that don't fit left for the
    // caller to cut off.
    layOut: (text: string, width: number, height: number, autoSize: boolean, fontSize: number,
        measureWidth: (str: string) => number): {lines: string[], fontSize: number} =>
    {
        const words = text.split(/\s+/).filter(word => word.length > 0);
        if (words.length == 0 || width <= 0 || height <= 0)
            return {lines: [], fontSize};
        return autoSize
            ? layOutToFit(words, width, height, measureWidth)
            : {lines: wrapBreakingWords(words, width / fontSize, measureWidth), fontSize};
    },
}

function layOutToFit(words: string[], width: number, height: number,
    measureWidth: (str: string) => number): {lines: string[], fontSize: number}
{
    const wordWidths = words.map(measureWidth);
    const spaceWidth = measureWidth(" ");
    const widestWord = Math.max(...wordWidths);

    // More lines can't make a larger size fit, so whether a size fits flips once as it grows.
    const fits = (size: number) =>
        countGreedyLines(wordWidths, spaceWidth, width / size) * size * LINE_SPACING <= height;
    let fitting = 0;
    let tooLarge = Math.min(height / LINE_SPACING, width / widestWord) * (1 + 1e-9);
    for (let i = 0; i < NUM_SEARCH_STEPS; ++i)
    {
        const size = 0.5 * (fitting + tooLarge);
        if (fits(size))
            fitting = size;
        else
            tooLarge = size;
    }
    if (fitting <= 0)
        return {lines: [], fontSize: 0};

    // The narrowest line width that still needs no more lines, which evens the lines out.
    const numLines = countGreedyLines(wordWidths, spaceWidth, width / fitting);
    let narrowEnough = width / fitting;
    let tooNarrow = widestWord * (1 - 1e-9);
    for (let i = 0; i < NUM_SEARCH_STEPS; ++i)
    {
        const lineWidth = 0.5 * (narrowEnough + tooNarrow);
        if (countGreedyLines(wordWidths, spaceWidth, lineWidth) <= numLines)
            narrowEnough = lineWidth;
        else
            tooNarrow = lineWidth;
    }
    const lines = wrapWholeWords(words, wordWidths, spaceWidth, narrowEnough);

    // Evened-out lines are narrower, so the size may grow; measured whole, so kerning is counted.
    const widestLine = Math.max(...lines.map(measureWidth));
    return {lines, fontSize: Math.min(height / (lines.length * LINE_SPACING), width / widestLine)};
}

function countGreedyLines(wordWidths: number[], spaceWidth: number, lineWidth: number): number
{
    let numLines = 1;
    let currWidth = wordWidths[0];
    for (let i = 1; i < wordWidths.length; ++i)
    {
        if (currWidth + spaceWidth + wordWidths[i] <= lineWidth)
        {
            currWidth += spaceWidth + wordWidths[i];
        }
        else
        {
            ++numLines;
            currWidth = wordWidths[i];
        }
    }
    return numLines;
}

function wrapWholeWords(words: string[], wordWidths: number[], spaceWidth: number,
    lineWidth: number): string[]
{
    const lines: string[] = [words[0]];
    let currWidth = wordWidths[0];
    for (let i = 1; i < words.length; ++i)
    {
        if (currWidth + spaceWidth + wordWidths[i] <= lineWidth)
        {
            lines[lines.length - 1] += " " + words[i];
            currWidth += spaceWidth + wordWidths[i];
        }
        else
        {
            lines.push(words[i]);
            currWidth = wordWidths[i];
        }
    }
    return lines;
}

// Greedy, measuring each candidate line whole. A word too wide for any line is split into pieces that fit
// (at least one character each, so a line narrower than a character still makes progress).
function wrapBreakingWords(words: string[], lineWidth: number,
    measureWidth: (str: string) => number): string[]
{
    const lines: string[] = [];
    let currLine = "";
    for (const word of words)
    {
        for (const piece of splitToFit(word, lineWidth, measureWidth))
        {
            const candidate = (currLine.length > 0) ? `${currLine} ${piece}` : piece;
            if (currLine.length == 0 || measureWidth(candidate) <= lineWidth)
            {
                currLine = candidate;
            }
            else
            {
                lines.push(currLine);
                currLine = piece;
            }
        }
    }
    lines.push(currLine);
    return lines;
}

function splitToFit(word: string, lineWidth: number, measureWidth: (str: string) => number): string[]
{
    if (measureWidth(word) <= lineWidth)
        return [word];
    const pieces: string[] = [];
    let currPiece = "";
    for (const char of Array.from(word)) // by code point, so a surrogate pair stays whole
    {
        if (currPiece.length > 0 && measureWidth(currPiece + char) > lineWidth)
        {
            pieces.push(currPiece);
            currPiece = "";
        }
        currPiece += char;
    }
    pieces.push(currPiece);
    return pieces;
}

export default LabelTextLayoutUtil;
