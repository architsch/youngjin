import LabelTextSpan from "../../../shared/object/types/labelTextSpan";
import LabelTextStyle from "../../../shared/object/types/labelTextStyle";
import LabelTextLine from "../types/labelTextLine";
import LabelTextWord from "../types/labelTextWord";

// Line breaking and font sizing for label text (see LabelText), apart from any canvas so it can be tested.
// Widths come from measureWidth: a string's width in a style at a font size of 1, the style's own scale
// included, since widths scale with the size. A line break in the text always starts a new line, and a
// line is as tall as its largest lettering.

const LINE_SPACING = 1.15;

// Enough halvings to settle a font size (or a line width) well below a pixel.
const NUM_SEARCH_STEPS = 32;

// A line break, a run of other whitespace, or a run of anything else.
const TOKEN_PATTERN = /\r\n|\r|\n|[^\S\r\n]+|\S+/g;

const LabelTextLayoutUtil =
{
    lineSpacing: LINE_SPACING,

    // Auto size: the largest size at which the whole text fits in width x height, words kept whole, with the
    // words then spread evenly over its lines (so none is stranded alone on the last). Otherwise: the given
    // size, a word wider than a line broken between characters, and the lines that don't fit left for the
    // caller to cut off.
    layOut: (spans: LabelTextSpan[], width: number, height: number, autoSize: boolean, fontSize: number,
        measureWidth: (str: string, style: LabelTextStyle) => number): {lines: LabelTextLine[], fontSize: number} =>
    {
        const paragraphs = toParagraphs(spans);
        if (paragraphs.length == 0 || width <= 0 || height <= 0)
            return {lines: [], fontSize};
        return autoSize
            ? layOutToFit(paragraphs, width, height, measureWidth)
            : {lines: paragraphs.flatMap(words => wrapBreakingWords(words, width / fontSize, measureWidth)), fontSize};
    },
}

function layOutToFit(paragraphs: LabelTextWord[][], width: number, height: number,
    measureWidth: (str: string, style: LabelTextStyle) => number): {lines: LabelTextLine[], fontSize: number}
{
    const measuredParagraphs = paragraphs.map(words => ({
        widths: words.map(word => measureLine(word.pieces, measureWidth)),
        spaceWidths: words.map(word => (word.space != undefined) ? measureLine([word.space], measureWidth) : 0),
        heights: words.map(word => getHeight(word.pieces)),
        spacedHeights: words.map(word => getHeight(withSpace(word))),
    }));
    const getTextHeight = (lineWidth: number) => measuredParagraphs.reduce((sum, measured) =>
        sum + getGreedyHeight(measured, lineWidth), 0);
    const widestWord = Math.max(...measuredParagraphs.flatMap(measured => measured.widths));

    // More lines can't make a larger size fit, so whether a size fits flips once as it grows.
    const fits = (size: number) => getTextHeight(width / size) * size <= height;
    let fitting = 0;
    let tooLarge = Math.min(height / getTextHeight(Infinity), width / widestWord) * (1 + 1e-9);
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

    // The narrowest line width that still makes the text no taller, which evens the lines out.
    const fittedHeight = getTextHeight(width / fitting);
    let narrowEnough = width / fitting;
    let tooNarrow = widestWord * (1 - 1e-9);
    for (let i = 0; i < NUM_SEARCH_STEPS; ++i)
    {
        const lineWidth = 0.5 * (narrowEnough + tooNarrow);
        if (getTextHeight(lineWidth) <= fittedHeight)
            narrowEnough = lineWidth;
        else
            tooNarrow = lineWidth;
    }
    const lines = paragraphs.flatMap((words, i) => wrapWholeWords(words, measuredParagraphs[i], narrowEnough));

    // Evened-out lines are narrower, so the size may grow; measured whole, so kerning is counted.
    const widestLine = Math.max(...lines.map(line => measureLine(line.segments, measureWidth)));
    const textHeight = lines.reduce((sum, line) => sum + line.height, 0);
    return {lines, fontSize: Math.min(height / textHeight, width / widestLine)};
}

// One paragraph filled greedily into lines, as wrapWholeWords does, measuring only their total height.
function getGreedyHeight(measured: {widths: number[], spaceWidths: number[], heights: number[],
    spacedHeights: number[]}, lineWidth: number): number
{
    const {widths, spaceWidths, heights, spacedHeights} = measured;
    let textHeight = 0;
    let lineHeight = heights[0];
    let currWidth = widths[0];
    for (let i = 1; i < widths.length; ++i)
    {
        if (currWidth + spaceWidths[i] + widths[i] <= lineWidth)
        {
            currWidth += spaceWidths[i] + widths[i];
            lineHeight = Math.max(lineHeight, spacedHeights[i]);
        }
        else
        {
            textHeight += lineHeight;
            lineHeight = heights[i];
            currWidth = widths[i];
        }
    }
    return textHeight + lineHeight;
}

function wrapWholeWords(words: LabelTextWord[], measured: {widths: number[], spaceWidths: number[]},
    lineWidth: number): LabelTextLine[]
{
    const {widths, spaceWidths} = measured;
    const lines: LabelTextSpan[][] = [[...words[0].pieces]];
    let currWidth = widths[0];
    for (let i = 1; i < words.length; ++i)
    {
        if (currWidth + spaceWidths[i] + widths[i] <= lineWidth)
        {
            lines[lines.length - 1].push(...withSpace(words[i]));
            currWidth += spaceWidths[i] + widths[i];
        }
        else
        {
            lines.push([...words[i].pieces]);
            currWidth = widths[i];
        }
    }
    return lines.map(toLine);
}

// Greedy, measuring each candidate line whole. Only a word's first chunk can join a line; the rest of a
// word too wide for one each fill a line of their own.
function wrapBreakingWords(words: LabelTextWord[], lineWidth: number,
    measureWidth: (str: string, style: LabelTextStyle) => number): LabelTextLine[]
{
    const lines: LabelTextSpan[][] = [];
    let currLine: LabelTextSpan[] = [];
    for (const word of words)
    {
        const [firstChunk, ...otherChunks] = splitToFit(word.pieces, lineWidth, measureWidth);
        if (currLine.length == 0)
        {
            currLine = firstChunk;
        }
        else
        {
            const joined = [...currLine, ...withSpace({space: word.space, pieces: firstChunk})];
            if (measureLine(joined, measureWidth) <= lineWidth)
            {
                currLine = joined;
            }
            else
            {
                lines.push(currLine);
                currLine = firstChunk;
            }
        }
        for (const chunk of otherChunks)
        {
            lines.push(currLine);
            currLine = chunk;
        }
    }
    lines.push(currLine);
    return lines.map(toLine);
}

// A word too wide for any line is split into chunks that fit (at least one character each, so a line
// narrower than a character still makes progress).
function splitToFit(pieces: LabelTextSpan[], lineWidth: number,
    measureWidth: (str: string, style: LabelTextStyle) => number): LabelTextSpan[][]
{
    if (measureLine(pieces, measureWidth) <= lineWidth)
        return [pieces];
    const chunks: LabelTextSpan[][] = [];
    let currChunk: LabelTextSpan[] = [];
    for (const {text, style} of pieces)
    {
        for (const char of Array.from(text)) // by code point, so a surrogate pair stays whole
        {
            const extended = appendText(currChunk, char, style);
            if (currChunk.length > 0 && measureLine(extended, measureWidth) > lineWidth)
            {
                chunks.push(currChunk);
                currChunk = [{text: char, style}];
            }
            else
            {
                currChunk = extended;
            }
        }
    }
    chunks.push(currChunk);
    return chunks;
}

// The text's paragraphs (split at line breaks) as words. A word's space is the whitespace before it, in
// that whitespace's style. A blank paragraph is one empty word, as tall as its line break; blank ones at
// either end are dropped.
function toParagraphs(spans: LabelTextSpan[]): LabelTextWord[][]
{
    const paragraphs: LabelTextWord[][] = [];
    let words: LabelTextWord[] = [];
    let pieces: LabelTextSpan[] = []; // of the word being read
    let space: LabelTextSpan | undefined; // since the last word
    const endWord = () => {
        if (pieces.length == 0)
            return;
        words.push({space: (words.length > 0) ? space : undefined, pieces});
        pieces = [];
        space = undefined;
    };

    for (const {text, style} of spans)
    {
        for (const token of text.match(TOKEN_PATTERN) ?? [])
        {
            if (token[0] == "\n" || token[0] == "\r")
            {
                endWord();
                if (words.length > 0 || paragraphs.length > 0)
                    paragraphs.push((words.length > 0) ? words : [{space: undefined, pieces: [{text: "", style}]}]);
                words = [];
                space = undefined;
            }
            else if (/\s/.test(token[0]))
            {
                endWord();
                space = space ?? {text: " ", style};
            }
            else
            {
                pieces = appendText(pieces, token, style);
            }
        }
    }
    endWord();
    paragraphs.push(words);
    while (paragraphs.length > 0 && isBlank(paragraphs[paragraphs.length - 1]))
        paragraphs.pop();
    return paragraphs;
}

function isBlank(words: LabelTextWord[]): boolean
{
    return words.every(word => word.pieces.every(piece => piece.text.length == 0));
}

function withSpace(word: LabelTextWord): LabelTextSpan[]
{
    return (word.space != undefined) ? [word.space, ...word.pieces] : word.pieces;
}

function toLine(pieces: LabelTextSpan[]): LabelTextLine
{
    return {segments: pieces.reduce((joined, {text, style}) => appendText(joined, text, style),
        [] as LabelTextSpan[]), height: getHeight(pieces)};
}

function getHeight(pieces: LabelTextSpan[]): number
{
    return Math.max(...pieces.map(piece => piece.style.scale)) * LINE_SPACING;
}

// Each run of one style measured whole, so kerning within it is counted.
function measureLine(pieces: LabelTextSpan[],
    measureWidth: (str: string, style: LabelTextStyle) => number): number
{
    return pieces.reduce((joined, {text, style}) => appendText(joined, text, style), [] as LabelTextSpan[])
        .reduce((width, {text, style}) => width + measureWidth(text, style), 0);
}

// Joins the last piece when the style is the same.
function appendText(pieces: LabelTextSpan[], text: string, style: LabelTextStyle): LabelTextSpan[]
{
    const last = pieces[pieces.length - 1];
    if (last != undefined && isSameStyle(last.style, style))
        return [...pieces.slice(0, -1), {text: last.text + text, style}];
    return [...pieces, {text, style}];
}

function isSameStyle(a: LabelTextStyle, b: LabelTextStyle): boolean
{
    return a.bold == b.bold && a.italic == b.italic && a.underline == b.underline
        && a.strikethrough == b.strikethrough && a.scale == b.scale && a.fontFace == b.fontFace;
}

export default LabelTextLayoutUtil;
