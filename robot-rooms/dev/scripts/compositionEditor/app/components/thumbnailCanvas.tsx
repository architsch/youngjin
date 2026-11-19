import { useEffect, useRef } from "react";

// Draws a rendered thumbnail at a display size, in device pixels. Until the next drawing arrives it keeps
// showing the last one rather than going blank.
export default function ThumbnailCanvas({ bitmap, size }: Props)
{
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pixelSize = Math.round(size * (window.devicePixelRatio || 1));

    useEffect(() => {
        if (bitmap == undefined)
            return;
        let cancelled = false;
        // Resampled up front rather than by drawImage, whose filtering changes once the browser has drawn the
        // same bitmap at other sizes (the inspector's previews), so an unchanged thumbnail would shift.
        createImageBitmap(bitmap, {resizeWidth: pixelSize, resizeHeight: pixelSize, resizeQuality: "high"})
            .then((resized) => {
                const context = canvasRef.current?.getContext("2d");
                if (!cancelled && context != undefined)
                {
                    context.clearRect(0, 0, pixelSize, pixelSize);
                    context.drawImage(resized, 0, 0);
                }
                resized.close();
            })
            .catch(() => {
                // Released after being replaced; its replacement is on its way.
            });
        return () => {
            cancelled = true;
        };
    }, [bitmap, pixelSize]);

    return <canvas ref={canvasRef} className="thumbnail-canvas" width={pixelSize} height={pixelSize}
        style={{width: size, height: size}} />;
}

interface Props
{
    bitmap?: ImageBitmap;
    size: number; // in CSS pixels
}
