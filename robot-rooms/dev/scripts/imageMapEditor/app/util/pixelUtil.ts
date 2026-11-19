import RgbaImage from "../../core/rgbaImage";

// Between the browser's images and the processing core's pixels (see ImageProcessingUtil).
const PixelUtil =
{
    // Upright (as its EXIF says), no larger than maxSide; with the size it has upright.
    decode: async (blob: Blob, maxSide: number): Promise<{image: RgbaImage, width: number, height: number}> =>
    {
        const bitmap = await createImageBitmap(blob, {imageOrientation: "from-image"});
        const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));
        const context = createContext(width, height);
        context.imageSmoothingQuality = "high";
        context.drawImage(bitmap, 0, 0, width, height);
        const decoded = {image: {width, height, data: context.getImageData(0, 0, width, height).data},
            width: bitmap.width, height: bitmap.height};
        bitmap.close();
        return decoded;
    },

    toCanvas: (image: RgbaImage): HTMLCanvasElement =>
    {
        const context = createContext(image.width, image.height);
        context.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
        return context.canvas;
    },
}

function createContext(width: number, height: number): CanvasRenderingContext2D
{
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", {willReadFrequently: true});
    if (context == null)
        throw new Error("Failed to acquire a 2D canvas context");
    return context;
}

export default PixelUtil;
