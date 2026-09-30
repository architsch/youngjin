import * as THREE from "three";
import TextureFactory from "../../factories/textureFactory";
import TextureAtlasAllocator from "../../types/texture/textureAtlasAllocator";
import TextureAtlasRegion from "../../types/texture/textureAtlasRegion";
import ParticleAtlasSprite from "../types/particleAtlasSprite";

// Procedural sprites for particles and animated sprites, drawn once into one canvas texture and packed
// with TextureAtlasAllocator, so nothing is downloaded. Soft shapes are white (particles tint them); the
// fan's blades are shaded, because they are a surface. Uploaded premultiplied and linear: premultiplied
// mipmaps don't darken edges, and white shapes need no color conversion (see particleShader).

const CELL_SIZE = 64; // texels
const ATLAS_COLS = 16;
const ATLAS_ROWS = 8;
// Every drawing stays this far inside its frame, so mipmaps never blend neighbouring sprites together.
const GUTTER = 3;

interface SpriteEntry
{
    id: string;
    frameCols: number; // cells per frame, across
    frameRows: number; // cells per frame, up
    frames: number;
    draw: (ctx: CanvasRenderingContext2D, width: number, height: number, frame: number) => void;
}

const SPRITE_ENTRIES: SpriteEntry[] = [
    {id: "softDot", frameCols: 1, frameRows: 1, frames: 1, draw: drawSoftDot},
    {id: "spark", frameCols: 1, frameRows: 1, frames: 1, draw: drawSpark},
    {id: "ring", frameCols: 1, frameRows: 1, frames: 1, draw: drawRing},
    {id: "chip", frameCols: 1, frameRows: 1, frames: 1, draw: drawChip},
    {id: "puff", frameCols: 2, frameRows: 2, frames: 1, draw: drawPuff},
    {id: "streak", frameCols: 1, frameRows: 2, frames: 1, draw: drawStreak},
    {id: "flame", frameCols: 1, frameRows: 2, frames: 4, draw: drawFlame},
    {id: "fanBlades", frameCols: 4, frameRows: 4, frames: 1, draw: drawFanBlades},
];

const spriteById: {[id: string]: ParticleAtlasSprite} = {};
let atlasTexture: THREE.Texture | undefined;

const ParticleAtlasUtil =
{
    // Draws and packs every sprite, once.
    build: (): THREE.Texture =>
    {
        if (atlasTexture != undefined)
            return atlasTexture;

        const regions = packRegions();
        atlasTexture = TextureFactory.loadCanvasTexture("ParticleAtlas", ATLAS_COLS * CELL_SIZE,
            ATLAS_ROWS * CELL_SIZE, (ctx) => drawSprites(ctx, regions),
            {colorSpace: THREE.NoColorSpace, premultiplyAlpha: true});

        for (const entry of SPRITE_ENTRIES)
        {
            const region = regions[entry.id];
            spriteById[entry.id] = {
                u: region.col / ATLAS_COLS,
                v: region.row / ATLAS_ROWS,
                width: entry.frameCols / ATLAS_COLS,
                height: entry.frameRows / ATLAS_ROWS,
                frames: entry.frames,
            };
        }
        return atlasTexture;
    },
    getSprite: (id: string): ParticleAtlasSprite =>
    {
        const sprite = spriteById[id];
        if (sprite == undefined)
            throw new Error(`Unknown particle atlas sprite (id = ${id})`);
        return sprite;
    },
    // Known before the atlas is built.
    getSpriteIds: (): string[] =>
    {
        return SPRITE_ENTRIES.map(entry => entry.id);
    },
}

// Largest first, as TextureAtlasAllocator packs best.
function packRegions(): {[id: string]: TextureAtlasRegion}
{
    const allocator = new TextureAtlasAllocator(ATLAS_COLS, ATLAS_ROWS);
    const regions: {[id: string]: TextureAtlasRegion} = {};
    const bySize = [...SPRITE_ENTRIES].sort((a, b) =>
        b.frameCols * b.frames * b.frameRows - a.frameCols * a.frames * a.frameRows);
    for (const entry of bySize)
    {
        const region = allocator.allocate(entry.frameCols * entry.frames, entry.frameRows);
        if (region == undefined)
            throw new Error(`The particle atlas is too small for its sprites (id = ${entry.id})`);
        regions[entry.id] = region;
    }
    return regions;
}

// Regions count rows up from the bottom, as UVs do; the canvas counts down from the top.
function drawSprites(ctx: CanvasRenderingContext2D, regions: {[id: string]: TextureAtlasRegion})
{
    for (const entry of SPRITE_ENTRIES)
    {
        const region = regions[entry.id];
        const frameWidth = entry.frameCols * CELL_SIZE;
        const frameHeight = entry.frameRows * CELL_SIZE;
        const top = (ATLAS_ROWS - region.row - region.numRows) * CELL_SIZE;
        for (let frame = 0; frame < entry.frames; ++frame)
        {
            const left = region.col * CELL_SIZE + frame * frameWidth;
            ctx.save();
            ctx.translate(left + GUTTER, top + GUTTER);
            entry.draw(ctx, frameWidth - 2 * GUTTER, frameHeight - 2 * GUTTER, frame);
            ctx.restore();
        }
    }
}

// A round, soft-edged blob fading from its middle.
function drawSoftDot(ctx: CanvasRenderingContext2D, width: number, height: number)
{
    const r = 0.5 * Math.min(width, height);
    const gradient = ctx.createRadialGradient(0.5 * width, 0.5 * height, 0, 0.5 * width, 0.5 * height, r);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.35, "rgba(255,255,255,0.6)");
    gradient.addColorStop(0.7, "rgba(255,255,255,0.15)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
}

// A small hot core with a quick falloff, for sparks and embers.
function drawSpark(ctx: CanvasRenderingContext2D, width: number, height: number)
{
    const r = 0.5 * Math.min(width, height);
    const gradient = ctx.createRadialGradient(0.5 * width, 0.5 * height, 0, 0.5 * width, 0.5 * height, r);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.2, "rgba(255,255,255,0.9)");
    gradient.addColorStop(0.45, "rgba(255,255,255,0.2)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
}

// A soft band around the middle, for shockwaves.
function drawRing(ctx: CanvasRenderingContext2D, width: number, height: number)
{
    const r = 0.5 * Math.min(width, height);
    const gradient = ctx.createRadialGradient(0.5 * width, 0.5 * height, 0, 0.5 * width, 0.5 * height, r);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(0.6, "rgba(255,255,255,0.1)");
    gradient.addColorStop(0.82, "rgba(255,255,255,1)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
}

// A lumpy cloud of overlapping blobs, for dust and smoke.
function drawPuff(ctx: CanvasRenderingContext2D, width: number, height: number)
{
    const blobs = [
        [0.5, 0.52, 0.3, 0.55], [0.36, 0.44, 0.2, 0.45], [0.64, 0.42, 0.21, 0.45],
        [0.42, 0.64, 0.19, 0.4], [0.62, 0.63, 0.18, 0.4], [0.5, 0.34, 0.17, 0.35],
    ];
    const size = Math.min(width, height);
    for (const [x, y, r, alpha] of blobs)
    {
        const cx = x * width, cy = y * height, radius = r * size;
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
        gradient.addColorStop(0.6, `rgba(255,255,255,${0.5 * alpha})`);
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }
}

// An irregular shard of debris, with a lighter facet so a spinning chip reads as solid. The facet is drawn
// over the whole shard, so no seam shows between them.
function drawChip(ctx: CanvasRenderingContext2D, width: number, height: number)
{
    const facets: [number, [number, number][]][] = [
        [190, [[0.2, 0.34], [0.58, 0.12], [0.84, 0.42], [0.68, 0.86], [0.3, 0.78]]],
        [255, [[0.2, 0.34], [0.58, 0.12], [0.84, 0.42], [0.5, 0.52]]],
    ];
    for (const [shade, points] of facets)
    {
        ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
        ctx.beginPath();
        points.forEach(([x, y], i) => (i == 0) ? ctx.moveTo(x * width, y * height) : ctx.lineTo(x * width, y * height));
        ctx.closePath();
        ctx.fill();
    }
}

// A thin line fading at both ends, drawn upright: stretched particles lay it along their motion.
function drawStreak(ctx: CanvasRenderingContext2D, width: number, height: number)
{
    const along = ctx.createLinearGradient(0, 0, 0, height);
    along.addColorStop(0, "rgba(255,255,255,0)");
    along.addColorStop(0.5, "rgba(255,255,255,1)");
    along.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = along;
    const lineWidth = 0.22 * width;
    ctx.fillRect(0.5 * (width - lineWidth), 0, lineWidth, height);
    // Soften the sides by drawing a wider, fainter pass underneath.
    ctx.globalAlpha = 0.35;
    ctx.fillRect(0.5 * (width - 2.2 * lineWidth), 0, 2.2 * lineWidth, height);
    ctx.globalAlpha = 1;
}

// A flickering teardrop flame; each frame leans and stretches a little differently.
function drawFlame(ctx: CanvasRenderingContext2D, width: number, height: number, frame: number)
{
    const lean = [0, 0.06, -0.04, 0.03][frame % 4] * width;
    const stretch = [1, 0.93, 0.97, 0.9][frame % 4];
    const baseY = 0.92 * height;
    const tipY = baseY - 0.85 * height * stretch;
    const halfWidth = 0.34 * width;
    ctx.beginPath();
    ctx.moveTo(0.5 * width + lean, tipY);
    ctx.bezierCurveTo(0.5 * width + halfWidth, baseY - 0.45 * (baseY - tipY),
        0.5 * width + halfWidth, baseY, 0.5 * width, baseY);
    ctx.bezierCurveTo(0.5 * width - halfWidth, baseY,
        0.5 * width - halfWidth, baseY - 0.45 * (baseY - tipY), 0.5 * width + lean, tipY);
    const gradient = ctx.createRadialGradient(0.5 * width, 0.72 * height, 0, 0.5 * width, 0.72 * height,
        0.6 * height);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.5, "rgba(255,255,255,0.75)");
    gradient.addColorStop(1, "rgba(255,255,255,0.1)");
    ctx.fillStyle = gradient;
    ctx.fill();
}

// Four swept blades around a hub, as a cut-out surface: opaque inside, a one-texel soft edge outside.
function drawFanBlades(ctx: CanvasRenderingContext2D, width: number, height: number)
{
    const cx = 0.5 * width, cy = 0.5 * height;
    const r = 0.5 * Math.min(width, height);
    ctx.fillStyle = "rgb(214,214,214)";
    for (let i = 0; i < 4; ++i)
    {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(i * 0.5 * Math.PI);
        ctx.beginPath();
        ctx.moveTo(0.1 * r, -0.08 * r);
        ctx.bezierCurveTo(0.45 * r, -0.34 * r, 0.9 * r, -0.3 * r, 0.96 * r, -0.08 * r);
        ctx.bezierCurveTo(0.99 * r, 0.1 * r, 0.7 * r, 0.24 * r, 0.1 * r, 0.1 * r);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
    // The hub, a little darker, with a lighter cap.
    ctx.fillStyle = "rgb(150,150,150)";
    ctx.beginPath();
    ctx.arc(cx, cy, 0.2 * r, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "rgb(190,190,190)";
    ctx.beginPath();
    ctx.arc(cx, cy, 0.1 * r, 0, 2 * Math.PI);
    ctx.fill();
}

export default ParticleAtlasUtil;
