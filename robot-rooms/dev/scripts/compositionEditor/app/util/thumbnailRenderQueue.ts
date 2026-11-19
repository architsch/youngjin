import { renderCompositionPixels } from "../../../../../src/client/graphics/thumbnail/compositionThumbnailRenderer";
import TypeThumbnails from "../types/typeThumbnails";

// Recent drawings kept per type, so stepping back to one (the end of a hover preview, an undo) is instant.
const MAX_CACHED_PER_TYPE = 4;
// A replaced drawing may still be on its way to a canvas.
const BITMAP_RELEASE_DELAY_MS = 2000;

// Draws each object type's entries with the build's own thumbnail renderer, one type at a time. A type asked
// for again while waiting is drawn once, from the latest request, however many edits came in between.
export default class ThumbnailRenderQueue
{
    private readonly cellSize: number;
    private readonly onDrawn: (objectType: string, thumbnails: TypeThumbnails) => void;
    private readonly pending = new Map<string, {key: string, encodedList: string[], view: {yawDeg: number, pitchDeg: number}}>();
    private readonly cacheByType = new Map<string, Map<string, TypeThumbnails>>();
    private readonly shownKeyByType = new Map<string, string>();
    private running = false;

    constructor(cellSize: number, onDrawn: (objectType: string, thumbnails: TypeThumbnails) => void)
    {
        this.cellSize = cellSize;
        this.onDrawn = onDrawn;
    }

    // encodedList: the type's entries, which share one framing (so each change redraws them all).
    request(objectType: string, encodedList: string[], view: {yawDeg: number, pitchDeg: number}): void
    {
        const uniqueList = [...new Set(encodedList)];
        const key = JSON.stringify({uniqueList, view});
        this.pending.delete(objectType);
        if (this.shownKeyByType.get(objectType) == key)
            return;

        const cached = this.takeFromCache(objectType, key);
        if (cached != undefined)
        {
            this.show(objectType, key, cached);
            return;
        }
        this.pending.set(objectType, {key, encodedList: uniqueList, view});
        if (!this.running)
            this.run();
    }

    private async run(): Promise<void>
    {
        this.running = true;
        while (this.pending.size > 0)
        {
            const [objectType, request] = this.pending.entries().next().value!;
            this.pending.delete(objectType);

            // Asked for again while the same drawing was under way.
            const cached = this.takeFromCache(objectType, request.key);
            if (cached != undefined)
            {
                this.show(objectType, request.key, cached);
                continue;
            }

            let thumbnails: TypeThumbnails;
            try
            {
                const pixelsList = await renderCompositionPixels(request.encodedList, this.cellSize, request.view);
                const bitmaps = await Promise.all(pixelsList.map(toBitmap));
                thumbnails = {bitmapByEncoded: new Map(request.encodedList.map((encoded, i) => [encoded, bitmaps[i]]))};
            }
            catch (err)
            {
                thumbnails = {bitmapByEncoded: new Map(), error: err instanceof Error ? err.message : String(err)};
            }
            this.addToCache(objectType, request.key, thumbnails);
            // A newer request for this type is already waiting, so this drawing is shown only if it was the last.
            if (!this.pending.has(objectType))
                this.show(objectType, request.key, thumbnails);
        }
        this.running = false;
    }

    private show(objectType: string, key: string, thumbnails: TypeThumbnails): void
    {
        this.shownKeyByType.set(objectType, key);
        this.onDrawn(objectType, thumbnails);
    }

    // Marked most recently used.
    private takeFromCache(objectType: string, key: string): TypeThumbnails | undefined
    {
        const cache = this.cacheByType.get(objectType);
        const cached = cache?.get(key);
        if (cache != undefined && cached != undefined)
        {
            cache.delete(key);
            cache.set(key, cached);
        }
        return cached;
    }

    private addToCache(objectType: string, key: string, thumbnails: TypeThumbnails): void
    {
        const cache = this.cacheByType.get(objectType) ?? new Map<string, TypeThumbnails>();
        this.cacheByType.set(objectType, cache);
        cache.set(key, thumbnails);
        while (cache.size > MAX_CACHED_PER_TYPE)
        {
            const [oldestKey, oldest] = cache.entries().next().value!;
            cache.delete(oldestKey);
            if (oldestKey != this.shownKeyByType.get(objectType))
                setTimeout(() => oldest.bitmapByEncoded.forEach(bitmap => bitmap.close()), BITMAP_RELEASE_DELAY_MS);
        }
    }
}

// The renderer's pixels run bottom row first.
function toBitmap(pixels: Uint8Array): Promise<ImageBitmap>
{
    const size = Math.round(Math.sqrt(pixels.length / 4));
    const rowLength = size * 4;
    const flipped = new Uint8ClampedArray(pixels.length);
    for (let row = 0; row < size; ++row)
        flipped.set(pixels.subarray(row * rowLength, (row + 1) * rowLength), (size - 1 - row) * rowLength);
    return createImageBitmap(new ImageData(flipped, size, size));
}
