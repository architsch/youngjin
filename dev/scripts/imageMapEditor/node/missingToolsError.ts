// A cut-out asked for while the model that makes it isn't on this machine yet (see Segmenter), by a request that
// didn't allow fetching it. Its message is the question put to whoever asked.
export default class MissingToolsError extends Error
{
    constructor()
    {
        super("Cutting a thing out takes ONNX Runtime (MIT, about 115 MB) and Segment Anything 2 (Apache-2.0, about "
            + "910 MB), which aren't on this machine yet. Fetch them into temp/image_prep/tools now? It takes a few "
            + "minutes.");
    }
}
