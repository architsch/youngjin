// Line breaking and font sizing for label text (see LabelText), apart from any canvas so it can be tested.
// Widths come from measureWidth: a string's width at a font size of 1, since widths scale with the size. A
// line break in the text always starts a new line.

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
        const paragraphs = toParagraphs(text);
        if (paragraphs.length == 0 || width <= 0 || height <= 0)
            return {lines: [], fontSize};
        return autoSize
            ? layOutToFit(paragraphs, width, height, measureWidth)
            : {lines: paragraphs.flatMap(words => wrapBreakingWords(words, width / fontSize, measureWidth)), fontSize};
    },
}

function layOutToFit(paragraphs: string[][], width: number, height: number,
    measureWidth: (str: string) => number): {lines: string[], fontSize: number}
{
    const wordWidths = paragraphs.map(words => words.map(measureWidth));
    const spaceWidth = measureWidth(" ");
    const countLines = (lineWidth: number) => wordWidths.reduce((sum, widths) =>
        sum + countGreedyLines(widths, spaceWidth, lineWidth), 0);
    const widestWord = Math.max(...wordWidths.flat());

    // More lines can't make a larger size fit, so whether a size fits flips once as it grows.
    const fits = (size: number) => countLines(width / size) * size * LINE_SPACING <= height;
    let fitting = 0;
    let tooLarge = Math.min(height / (paragraphs.length * LINE_SPACING), width / widestWord) * (1 + 1e-9);
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
    const numLines = countLines(width / fitting);
    let narrowEnough = width / fitting;
    let tooNarrow = widestWord * (1 - 1e-9);
    for (let i = 0; i < NUM_SEARCH_STEPS; ++i)
    {
        const lineWidth = 0.5 * (narrowEnough + tooNarrow);
        if (countLines(lineWidth) <= numLines)
            narrowEnough = lineWidth;
        else
            tooNarrow = lineWidth;
    }
    const lines = paragraphs.flatMap((words, i) => wrapWholeWords(words, wordWidths[i], spaceWidth, narrowEnough));

    // Evened-out lines are narrower, so the size may grow.
    const widestLine = Math.max(...lines.map(measureWidth));
    return {lines, fontSize: Math.min(height / (lines.length * LINE_SPACING), width / widestLine)};
}

// One paragraph filled greedily into lines, as wrapWholeWords does, only counting them.
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

// Greedy. Only a word's first chunk can join a line; the rest of a word too wide for one each fill a line of
// their own.
function wrapBreakingWords(words: string[], lineWidth: number, measureWidth: (str: string) => number): string[]
{
    const lines: string[] = [];
    let currLine = "";
    for (const word of words)
    {
        const [firstChunk, ...otherChunks] = splitToFit(word, lineWidth, measureWidth);
        if (currLine.length == 0)
        {
            currLine = firstChunk;
        }
        else if (measureWidth(`${currLine} ${firstChunk}`) <= lineWidth)
        {
            currLine = `${currLine} ${firstChunk}`;
        }
        else
        {
            lines.push(currLine);
            currLine = firstChunk;
        }
        for (const chunk of otherChunks)
        {
            lines.push(currLine);
            currLine = chunk;
        }
    }
    lines.push(currLine);
    return lines;
}

// A word too wide for any line is split into chunks that fit (at least one character each, so a line
// narrower than a character still makes progress).
function splitToFit(word: string, lineWidth: number, measureWidth: (str: string) => number): string[]
{
    if (measureWidth(word) <= lineWidth)
        return [word];
    const chunks: string[] = [];
    let currChunk = "";
    for (const char of Array.from(word)) // by code point, so a surrogate pair stays whole
    {
        if (currChunk.length > 0 && measureWidth(currChunk + char) > lineWidth)
        {
            chunks.push(currChunk);
            currChunk = "";
        }
        currChunk += char;
    }
    chunks.push(currChunk);
    return chunks;
}

// The text's paragraphs (split at line breaks) as words. A blank paragraph is one empty word, so it still
// takes a line; blank ones at either end are dropped.
function toParagraphs(text: string): string[][]
{
    const paragraphs = text.split(/\r\n|\r|\n/).map(paragraph => {
        const words = paragraph.split(/\s+/).filter(word => word.length > 0);
        return (words.length > 0) ? words : [""];
    });
    const isBlank = (words: string[]) => words[0].length == 0;
    let first = 0;
    let end = paragraphs.length;
    while (first < end && isBlank(paragraphs[first]))
        ++first;
    while (end > first && isBlank(paragraphs[end - 1]))
        --end;
    return paragraphs.slice(first, end);
}

export default LabelTextLayoutUtil;
