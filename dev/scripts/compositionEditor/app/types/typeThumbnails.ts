// One object type's thumbnails, drawn together since its entries share one framing.
export default interface TypeThumbnails
{
    bitmapByEncoded: Map<string, ImageBitmap>;
    error?: string;
}
