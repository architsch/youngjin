import { useEffect, useRef } from "react";
import ParticleAtlasUtil from "../../../../../src/client/graphics/particle/util/particleAtlasUtil";

// A sprite's first frame, drawn from the game's atlas canvas (white shapes, tinted by particles).
export default function SpriteThumbnail({ sprite, size }: Props)
{
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (canvas == null || ctx == null)
            return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!ParticleAtlasUtil.getSpriteIds().includes(sprite))
            return;
        const atlas = ParticleAtlasUtil.build().image as HTMLCanvasElement;
        const region = ParticleAtlasUtil.getSprite(sprite);
        // Regions count rows up from the bottom, as UVs do; the canvas counts down from the top.
        const width = region.width * atlas.width;
        const height = region.height * atlas.height;
        const scale = Math.min(canvas.width / width, canvas.height / height);
        ctx.drawImage(atlas, region.u * atlas.width, (1 - region.v - region.height) * atlas.height, width, height,
            0.5 * (canvas.width - width * scale), 0.5 * (canvas.height - height * scale), width * scale, height * scale);
    }, [sprite]);

    return <canvas ref={canvasRef} className="sprite-thumbnail" width={2 * size} height={2 * size}
        style={{width: size, height: size}} />;
}

interface Props
{
    sprite: string;
    size: number; // CSS pixels
}
