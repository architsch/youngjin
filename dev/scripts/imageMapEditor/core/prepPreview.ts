// What a source would be preprocessed into (see SourcePreprocessor.preview), drawn small for the page.
export default interface PrepPreview
{
    // The result's own size, in pixels.
    width: number;
    height: number;
    // The result, as a data URL.
    image: string;
    // A tint to lay over the source where a cut-out takes it away, as a data URL; absent when nothing is cut out.
    cutAway?: string;
    // A line on each thing found on the way (see MaskUtil.cutOut, PrepRenderUtil.render).
    notes: string[];
}
