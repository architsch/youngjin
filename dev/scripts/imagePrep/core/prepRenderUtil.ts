import RgbaImage from "../../imageMapEditor/core/rgbaImage";
import ImageProcessingUtil from "../../imageMapEditor/core/imageProcessingUtil";
import SelectionGeometryUtil from "../../imageMapEditor/core/selectionGeometryUtil";
import { MAX_SOURCE_SIDE } from "../../imageMapEditor/core/sampleRenderUtil";
import PrepOrder from "./prepOrder";
import PrepCutOut from "./prepCutOut";
import PrepSquare from "./prepSquare";
import PrepRound from "./prepRound";
import PrepCover from "./prepCover";
import PrepKeep from "./prepKeep";
import PlaneGeometryUtil from "./planeGeometryUtil";
import CutoutUtil from "./cutoutUtil";
import CoverUtil from "./coverUtil";

type Point = [number, number];

// How far outside the picture a position may be given, in fractions: a corner the picture cuts off, at most; and a
// part kept, by a hair (a position read off a survey's grid).
const MAX_OVERSHOOT = 1;
const EDGE_SLACK = 0.002;
// The see-through border a picture is given where it is sampled past its edge, in pixels, so that nothing of its
// edge is carried on there (see ImageProcessingUtil.warp).
const BORDER = 2;
const MIN_ASPECT = 0.05;
const MAX_ASPECT = 20;
// The longest a result's sides may be, in pixels: twice the largest image a prop shows, past which a result is only
// a heavier file.
export const MAX_RESULT_SIDE = 512;

// How an order re-maps a picture, on plain RGBA pixels: squared or rounded, parts of it painted over, and cut to the
// part kept. Cutting it out, tidying and upscaling come before it, and fitting the result to its size after (see
// PrepCommands.run).
const PrepRenderUtil =
{
    // Throws, saying what is wrong, if the order can't be carried out as written.
    validate: (order: PrepOrder): void =>
    {
        if (typeof order.source != "string" || order.source.length == 0)
            throw new Error("it names no source");
        if (order.name != undefined && !/^[\w.-]+$/.test(order.name))
            throw new Error(`its name "${order.name}" must be a plain file name`);
        if (order.square != undefined && order.round != undefined)
            throw new Error("it is squared or rounded, one of the two");
        if (order.maxSide != undefined && !(order.maxSide >= 1 && order.maxSide <= MAX_RESULT_SIDE))
            throw new Error(`maxSide is a number of pixels, ${MAX_RESULT_SIDE} at most: no result is larger`);
        if (order.cutOut != undefined)
        {
            if (!Array.isArray(order.cutOut) || order.cutOut.length == 0)
                throw new Error("cutOut takes a list of parts, each a thing kept");
            order.cutOut.forEach(validateCutOut);
            if (order.cutOut[0].drop)
                throw new Error("the first part of a cut-out is one kept: nothing is there yet to drop it from");
        }

        const square = order.square;
        if (square != undefined)
        {
            if ((square.corners == undefined) == (square.sides == undefined))
                throw new Error("square takes corners or sides, one of the two");
            if (square.corners != undefined && (square.corners.length != 4 || !arePoints(square.corners)))
                throw new Error("square takes four corners (top-left, top-right, bottom-right, bottom-left), on the picture"
                    + " or near it");
            if (square.sides != undefined)
            {
                for (const side of ["left", "right", "top", "bottom"] as const)
                {
                    const stretches = square.sides[side];
                    if (!Array.isArray(stretches) || stretches.length == 0 || !stretches.every(isStretch))
                        throw new Error(`the ${side} side takes stretches of the outline, each from and to along it`);
                }
            }
            if (square.aspect != undefined && square.circle != undefined)
                throw new Error("square takes an aspect or a circle, one of the two");
            if (square.aspect != undefined && !(square.aspect >= MIN_ASPECT && square.aspect <= MAX_ASPECT))
                throw new Error("the aspect is the face's width over its height");
            if (square.circle != undefined && (square.circle.length < 5 || !arePoints(square.circle)))
                throw new Error("the circle takes five points or more on the round thing's outline");
            if (square.extend != undefined && (square.extend.length != 4 || !square.extend.every(share => share >= 0)))
                throw new Error("extend takes the room kept past the left, top, right and bottom edges, none below zero");
        }
        if (order.round != undefined && (!arePoints(order.round.outline) || order.round.outline.length < 5))
            throw new Error("round takes five points or more on the outline");
        if (order.cover != undefined && !Array.isArray(order.cover))
            throw new Error("cover takes a list of parts");
        (order.cover ?? []).forEach(validateCover);

        const keep = order.keep;
        if (keep != undefined)
        {
            if (keep.shape != "rect" && keep.shape != "ellipse")
                throw new Error("keep takes a rect or an ellipse");
            const [x, y, w, h] = keep.rect ?? [];
            const within = x >= -EDGE_SLACK && y >= -EDGE_SLACK && x + w <= 1 + EDGE_SLACK && y + h <= 1 + EDGE_SLACK;
            if (!(w > 0 && h > 0 && within))
                throw new Error("the part kept is x, y, width and height within the re-mapped picture, in fractions of it");
        }
    },

    // The picture as the order re-maps it, with a line for each thing found on the way (the corners, the shape).
    render: (picture: RgbaImage, order: PrepOrder): {image: RgbaImage, notes: string[]} =>
    {
        PrepRenderUtil.validate(order);
        const notes: string[] = [];
        let image = picture;
        if (order.square != undefined)
            image = squareUp(image, order.square, notes);
        else if (order.round != undefined)
            image = makeRound(image, order.round, notes);
        for (const cover of order.cover ?? [])
        {
            const painted = CoverUtil.paintOver(image, cover);
            image = painted.image;
            const how = (typeof cover.from != "string")
                ? `from ${cover.from.join(", ")}, shaded by ${painted.patches} patches of its surroundings`
                : (cover.from == "mirror") ? `from its mirror, shaded by ${painted.patches} patches of its surroundings`
                : `with the surface beside it run ${cover.from}`;
            notes.push(`covered: ${cover.shape} at ${cover.rect.join(", ")} ${how}`
                + ((painted.unsourced > 0) ? `; ${painted.unsourced} pixels had no source in the picture and stay` : ""));
        }
        if (order.keep != undefined)
            image = cutToKept(image, order.keep);
        return {image, notes};
    },
}

function squareUp(picture: RgbaImage, square: PrepSquare, notes: string[]): RgbaImage
{
    const toPixels = ([x, y]: [number, number]): Point => [x * picture.width, y * picture.height];
    const corners = (square.corners != undefined) ? square.corners.map(toPixels) : findCorners(picture, square.sides!);
    const fromSides = PlaneGeometryUtil.getAspectFromSides(corners);
    const fromCircle = (square.circle != undefined)
        ? PlaneGeometryUtil.getAspectFromCircle(corners, square.circle.map(toPixels)) : undefined;
    const aspect = square.aspect ?? fromCircle ?? fromSides;
    if (!(aspect >= MIN_ASPECT && aspect <= MAX_ASPECT))
        throw new Error(`its face came out ${aspect.toFixed(3)} wide per high: check the corners and the circle`);

    const map = PlaneGeometryUtil.getQuadMap(corners);
    const [left, top, right, bottom] = square.extend ?? [0, 0, 0, 0];
    const reach: Point[] = [[-left, -top], [1 + right, -top], [1 + right, 1 + bottom], [-left, 1 + bottom]];
    if (!reach.every(([u, v]) => map.inFront(u, v)))
        throw new Error("the room kept past the face runs on behind the viewer: extend it less");

    // As large as keeps every side of the face no less sharp than the picture has it.
    const across = Math.max(distance(corners[0], corners[1]), distance(corners[3], corners[2]));
    const down = Math.max(distance(corners[0], corners[3]), distance(corners[1], corners[2]));
    const faceWidth = Math.max(across, down * aspect);
    const width = faceWidth * (1 + left + right), height = faceWidth / aspect * (1 + top + bottom);
    const scale = Math.min(1, MAX_SOURCE_SIDE / Math.max(width, height));

    const found = corners.map(([x, y]) => `(${(x / picture.width).toFixed(3)}, ${(y / picture.height).toFixed(3)})`);
    const how = (square.aspect != undefined) ? "as given" : (fromCircle != undefined) ? "by its circle" : "by its sides";
    notes.push(`squared: corners ${found.join(" ")}; ${aspect.toFixed(3)} wide per high, ${how}`
        + ((how == "by its sides") ? "" : ` (its sides alone say ${fromSides.toFixed(3)})`));
    return sampleQuad(picture, reach.map(([u, v]) => map.toQuad(u, v)), Math.max(1, Math.round(width * scale)),
        Math.max(1, Math.round(height * scale)));
}

// The face's corners, where the lines along a cut-out's four sides meet.
function findCorners(picture: RgbaImage, sides: NonNullable<PrepSquare["sides"]>): Point[]
{
    if (!ImageProcessingUtil.hasTransparency(picture))
        throw new Error("sides are read off a cut-out's outline: give corners for a picture that isn't cut out");
    const left = CutoutUtil.fitSide(picture, "left", sides.left), right = CutoutUtil.fitSide(picture, "right", sides.right);
    const top = CutoutUtil.fitSide(picture, "top", sides.top), bottom = CutoutUtil.fitSide(picture, "bottom", sides.bottom);
    return [PlaneGeometryUtil.intersect(top, left), PlaneGeometryUtil.intersect(top, right),
        PlaneGeometryUtil.intersect(bottom, right), PlaneGeometryUtil.intersect(bottom, left)];
}

function makeRound(picture: RgbaImage, round: PrepRound, notes: string[]): RgbaImage
{
    const {width, height} = picture;
    const ellipse = PlaneGeometryUtil.fitEllipse(round.outline.map(([x, y]): Point => [x * width, y * height]));
    const [cx, cy] = ellipse.center;
    const stretch = ellipse.major / ellipse.minor;
    const cos = Math.cos(ellipse.angle), sin = Math.sin(ellipse.angle);
    const turn = (round.turn ?? 0) * Math.PI / 180;
    const turnCos = Math.cos(turn), turnSin = Math.sin(turn);

    // About the ellipse's middle: stretched across its short axis where it stands, then turned.
    const toResult = ([x, y]: Point): Point => {
        const along = (x - cx) * cos + (y - cy) * sin, across = (-(x - cx) * sin + (y - cy) * cos) * stretch;
        const sx = along * cos - across * sin, sy = along * sin + across * cos;
        return [sx * turnCos - sy * turnSin, sx * turnSin + sy * turnCos];
    };
    const toPicture = ([x, y]: Point): Point => {
        const sx = x * turnCos + y * turnSin, sy = -x * turnSin + y * turnCos;
        const along = sx * cos + sy * sin, across = (-sx * sin + sy * cos) / stretch;
        return [cx + along * cos - across * sin, cy + along * sin + across * cos];
    };

    const frame = ([[0, 0], [width, 0], [width, height], [0, height]] as Point[]).map(toResult);
    const minX = Math.min(...frame.map(([x]) => x)), maxX = Math.max(...frame.map(([x]) => x));
    const minY = Math.min(...frame.map(([, y]) => y)), maxY = Math.max(...frame.map(([, y]) => y));
    const scale = Math.min(1, MAX_SOURCE_SIDE / Math.max(maxX - minX, maxY - minY));
    const quad = ([[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]] as Point[]).map(toPicture);
    const result = sampleQuad(picture, quad, Math.max(1, Math.round((maxX - minX) * scale)),
        Math.max(1, Math.round((maxY - minY) * scale)));

    notes.push(`rounded: seen as ${(2 * ellipse.major).toFixed(0)} x ${(2 * ellipse.minor).toFixed(0)} px, its long axis at `
        + `${(ellipse.angle * 180 / Math.PI % 180).toFixed(1)} degrees; stretched ${stretch.toFixed(3)} across it`);
    // The picture's frame came out a slanted one: what is left see-through around the object is cut away.
    const bounds = CutoutUtil.getBounds(result);
    return (bounds == undefined) ? result : crop(result, bounds.x, bounds.y, bounds.width, bounds.height);
}

// The quad (in the picture's pixels) sampled onto a width x height image. Where it reaches past the picture the
// result is see-through, and a cut-out's edge is sampled over the object's own colors (see CutoutUtil.carryColors).
function sampleQuad(picture: RgbaImage, quad: Point[], width: number, height: number): RgbaImage
{
    const outside = quad.some(([x, y]) => x < 0 || y < 0 || x > picture.width || y > picture.height);
    if (!outside && !ImageProcessingUtil.hasTransparency(picture))
        return ImageProcessingUtil.warp(picture, quad, width, height);

    const border = outside ? BORDER : 0;
    const source = ImageProcessingUtil.pad(picture, picture.width + 2 * border, picture.height + 2 * border, border, border,
        [0, 0, 0, 0]);
    // As far as a pixel of the result reaches across the picture, and the border besides.
    const span = Math.max(distance(quad[0], quad[1]) / width, distance(quad[3], quad[2]) / width,
        distance(quad[0], quad[3]) / height, distance(quad[1], quad[2]) / height);
    CutoutUtil.carryColors(source, Math.ceil(span) + BORDER);
    return ImageProcessingUtil.warp(source, quad.map(([x, y]): Point => [x + border, y + border]), width, height);
}

// Cut to the part's rect, with what lies outside its shape made see-through.
function cutToKept(image: RgbaImage, keep: PrepKeep): RgbaImage
{
    const inside = SelectionGeometryUtil.getTest({shape: keep.shape, rect: keep.rect, radius: keep.radius ?? 0},
        image.width, image.height);
    const [x, y, w, h] = keep.rect;
    const left = clamp(Math.round(x * image.width), 0, image.width - 1);
    const top = clamp(Math.round(y * image.height), 0, image.height - 1);
    const result = crop(image, left, top, clamp(Math.round((x + w) * image.width), left + 1, image.width) - left,
        clamp(Math.round((y + h) * image.height), top + 1, image.height) - top);
    for (let row = 0; row < result.height; ++row)
    {
        for (let column = 0; column < result.width; ++column)
        {
            if (!inside(left + column + 0.5, top + row + 0.5))
                result.data[(row * result.width + column) * 4 + 3] = 0;
        }
    }
    return result;
}

// A part cut out is shown to the model where it lies on the picture itself.
function validateCutOut(part: PrepCutOut): void
{
    const onPicture = (points: unknown) => Array.isArray(points) && points.every(point => Array.isArray(point)
        && point.length == 2 && point.every(value => typeof value == "number" && value >= 0 && value <= 1));
    if ((part.on != undefined && !onPicture(part.on)) || (part.off != undefined && !onPicture(part.off)))
        throw new Error("a part cut out takes its points as positions on the picture, in fractions of it");
    const on = part.on ?? [];
    if (part.rect == undefined)
    {
        if (on.length == 0)
            throw new Error("a part cut out takes a rect around the thing, points on it, or both");
        return;
    }
    const [x, y, w, h] = part.rect;
    const within = x >= -EDGE_SLACK && y >= -EDGE_SLACK && x + w <= 1 + EDGE_SLACK && y + h <= 1 + EDGE_SLACK;
    if (part.rect.length != 4 || !(w > 0 && h > 0 && within))
        throw new Error("a part cut out takes its rect as x, y, width and height within the picture, in fractions of it");
    if (on.some(([px, py]) => px < x || px > x + w || py < y || py > y + h))
        throw new Error("a point on a thing cut out lies within the rect around it");
}

// A part painted over takes its surface from elsewhere, never from where it lies itself.
function validateCover(cover: PrepCover): void
{
    if (cover.shape != "rect" && cover.shape != "ellipse")
        throw new Error("a part covered is a rect or an ellipse");
    const rect = cover.rect ?? [];
    const [x, y, w, h] = rect;
    if (rect.length != 4 || !(w > 0 && h > 0) || !arePoints([[x, y], [x + w, y + h]]))
        throw new Error("a part covered is x, y, width and height in fractions of the re-mapped picture, on it or near it");
    if (cover.from == "across" || cover.from == "down")
        return;
    if (cover.from == "mirror")
    {
        if (x < 0.5 && x + w > 0.5)
            throw new Error("a part covered from its mirror lies to one side of the picture's middle, not across it");
        return;
    }
    if (!arePoints([cover.from]))
        throw new Error(`a part is covered from "mirror", "across", "down", or the top-left corner of a region of its size`);
    const [fromX, fromY] = cover.from;
    if (Math.abs(fromX - x) < w && Math.abs(fromY - y) < h)
        throw new Error("a part covered takes its surface from elsewhere: its source lies over it");
}

function crop(image: RgbaImage, x: number, y: number, width: number, height: number): RgbaImage
{
    const result = ImageProcessingUtil.createImage(width, height);
    for (let row = 0; row < height; ++row)
    {
        const from = ((y + row) * image.width + x) * 4;
        result.data.set(image.data.subarray(from, from + width * 4), row * width * 4);
    }
    return result;
}

// Positions as fractions of the picture, on it or no further off it than a corner it cuts off would be.
function arePoints(points: unknown): boolean
{
    return Array.isArray(points) && points.every(point => Array.isArray(point) && point.length == 2
        && point.every(value => typeof value == "number" && value >= -MAX_OVERSHOOT && value <= 1 + MAX_OVERSHOOT));
}

function isStretch(stretch: unknown): boolean
{
    return Array.isArray(stretch) && stretch.length == 2 && stretch[0] >= 0 && stretch[1] <= 1 && stretch[0] < stretch[1];
}

function distance(a: Point, b: Point): number
{
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function clamp(value: number, min: number, max: number): number
{
    return Math.min(max, Math.max(min, value));
}

export default PrepRenderUtil;
