import RgbaImage from "../core/rgbaImage";
import SampleRenderUtil from "../core/sampleRenderUtil";
import PreviewMessage from "./types/previewMessage";
import PreviewResult from "./types/previewResult";

// How what was taken out is tinted when shown (see PreviewMessage.showRemoved).
const REMOVED_TINT = [255, 0, 90];
const REMOVED_TINT_WEIGHT = 0.55;
const REMOVED_ALPHA = 220;

// Renders a draft's previews off the page's thread (see usePreview). Only the newest render asked for is worked
// on, so edits that come faster than renders never queue up behind each other. A source given by its address is
// fetched and decoded here, at the size the server samples from, so the page never decodes the full photo.
let source: {sha1: string, image: RgbaImage} | undefined;
let loadingSha1: string | undefined;
let latest: Extract<PreviewMessage, {kind: "render"}> | undefined;
let scheduled = false;

self.onmessage = (event: MessageEvent<PreviewMessage>) => {
    const message = event.data;
    if (message.kind == "source")
    {
        source = {sha1: message.sha1, image: message.source};
        loadingSha1 = undefined;
        schedule();
        return;
    }
    if (message.kind == "sourceUrl")
    {
        loadingSha1 = message.sha1;
        void load(message.sha1, message.url);
        return;
    }
    latest = message;
    schedule();
};

// After every message already waiting, so the newest of them is the one rendered.
function schedule(): void
{
    if (scheduled)
        return;
    scheduled = true;
    setTimeout(render, 0);
}

async function load(sha1: string, url: string): Promise<void>
{
    try
    {
        const response = await fetch(url);
        if (!response.ok)
            throw new Error(`${response.status} ${response.statusText}`);
        const bitmap = await createImageBitmap(await response.blob(), {imageOrientation: "from-image"});
        const {width, height} = SampleRenderUtil.getWorkedSourceSize(bitmap.width, bitmap.height);
        const context = new OffscreenCanvas(width, height).getContext("2d", {willReadFrequently: true})!;
        context.imageSmoothingQuality = "high";
        context.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();
        // A later source asked for meanwhile wins.
        if (loadingSha1 != sha1)
            return;
        source = {sha1, image: {width, height, data: context.getImageData(0, 0, width, height).data}};
        loadingSha1 = undefined;
        schedule();
    }
    catch (error)
    {
        console.warn(`The preview couldn't load ${url}:`, error);
    }
}

function render(): void
{
    scheduled = false;
    const request = latest;
    if (request == undefined || source == undefined || source.sha1 != request.sha1)
        return;
    latest = undefined;

    const {sample, keep} = SampleRenderUtil.renderSampleWithKeepMask(source.image, request.recipe, request.maxSide);
    const gameImage = request.withGameImage ? SampleRenderUtil.renderGameImage(sample, request.recipe, request.cellSize)
        : undefined;
    const shown = (request.showRemoved && keep != undefined) ? tintRemoved(sample, keep) : sample;
    const result: PreviewResult = {id: request.id, sha1: request.sha1, shown, gameImage};
    (self as unknown as Worker).postMessage(result,
        [shown.data.buffer, ...(gameImage != undefined ? [gameImage.data.buffer] : [])]);
}

function tintRemoved(sample: RgbaImage, keep: Uint8Array): RgbaImage
{
    const shown = {width: sample.width, height: sample.height, data: new Uint8ClampedArray(sample.data)};
    for (let i = 0; i < keep.length; ++i)
    {
        if (keep[i])
            continue;
        for (let channel = 0; channel < 3; ++channel)
        {
            shown.data[i * 4 + channel] = shown.data[i * 4 + channel] * (1 - REMOVED_TINT_WEIGHT)
                + REMOVED_TINT[channel] * REMOVED_TINT_WEIGHT;
        }
        shown.data[i * 4 + 3] = REMOVED_ALPHA;
    }
    return shown;
}
