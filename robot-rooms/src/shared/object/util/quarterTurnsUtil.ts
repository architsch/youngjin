import { ObjectMetadata } from "../types/objectMetadata";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";
import StringUtil from "../../math/util/stringUtil";
import Vec2 from "../../math/types/vec2";
import Vec3 from "../../math/types/vec3";
import Geometry3DUtil from "../../math/util/geometry3DUtil";
import Vector3DUtil from "../../math/util/vector3DUtil";

// How far along a direction a point is projected to find which way it runs on screen: short, so perspective
// bends it little.
const SCREEN_DIRECTION_STEP = 0.25; // in world units

// An object's QuarterTurns: how its content is turned on the face it is attached to, clockwise as seen from the
// front. Stored as one base-94 character (see StringUtil); decoding is total (any string, including "", reads
// as a turn count), so the value needs no validation beyond canonicalize.
const QuarterTurnsUtil =
{
    decode: (str: string): number =>
    {
        return StringUtil.convertVisibleASCIIToRawNumber(str, 0, 0) % 4;
    },
    encode: (quarterTurns: number): string =>
    {
        return StringUtil.convertRawNumberToVisibleASCII(((quarterTurns % 4) + 4) % 4);
    },
    canonicalize: (str: string): string =>
    {
        return QuarterTurnsUtil.encode(QuarterTurnsUtil.decode(str));
    },
    // Of an object, or of metadata not yet applied to one ({metadata}).
    getQuarterTurns: (obj: {metadata: ObjectMetadata}): number =>
    {
        return QuarterTurnsUtil.decode(obj.metadata[ObjectMetadataKeyEnumMap.QuarterTurns]?.str ?? "");
    },

    // The world direction the content's top points in on a face (see Geometry3DUtil.getAxisFacingBasis): up,
    // then right, down and left as the turns go clockwise.
    getContentUp: (dir: Vec3, quarterTurns: number): Vec3 =>
    {
        const {right, up} = Geometry3DUtil.getAxisFacingBasis(dir);
        switch (((quarterTurns % 4) + 4) % 4)
        {
            case 1: return right;
            case 2: return Vector3DUtil.scale(up, -1);
            case 3: return Vector3DUtil.scale(right, -1);
            default: return up;
        }
    },

    // The turn content keeps when its object moves: the same on the same face, and on another whatever looks
    // the same on screen (see pickQuarterTurnsOnScreen). Asked of where a move started, not of each step, so the
    // path taken doesn't matter.
    getMovedQuarterTurns: (from: {pos: Vec3, dir: Vec3}, quarterTurns: number, to: {pos: Vec3, dir: Vec3},
        project: (point: Vec3) => Vec2 | null): number =>
    {
        const fromNormal = Geometry3DUtil.getAxisFacingBasis(from.dir).normal;
        if (Vector3DUtil.equal(fromNormal, Geometry3DUtil.getAxisFacingBasis(to.dir).normal))
            return quarterTurns;
        return QuarterTurnsUtil.pickQuarterTurnsOnScreen(from.pos,
            QuarterTurnsUtil.getContentUp(from.dir, quarterTurns), to.pos, to.dir, project);
    },

    // The turn content on a face (facing dir, at pos) needs for its top to look the way a top pointing along
    // fromUp at fromPos looks: e.g. where the object was before a move, or world up for upright. project maps a
    // world point to the screen (any 2D frame, since only directions are compared), or null if it can't. 0 when
    // nothing can be projected.
    pickQuarterTurnsOnScreen: (fromPos: Vec3, fromUp: Vec3, pos: Vec3, dir: Vec3,
        project: (point: Vec3) => Vec2 | null): number =>
    {
        const target = getScreenDirection(fromPos, fromUp, project);
        if (target == undefined)
            return 0;
        let bestQuarterTurns = 0;
        let bestAlignment = -Infinity;
        for (let quarterTurns = 0; quarterTurns < 4; ++quarterTurns)
        {
            const candidate = getScreenDirection(pos, QuarterTurnsUtil.getContentUp(dir, quarterTurns), project);
            if (candidate == undefined)
                continue;
            const alignment = candidate.x * target.x + candidate.y * target.y;
            if (alignment > bestAlignment)
            {
                bestAlignment = alignment;
                bestQuarterTurns = quarterTurns;
            }
        }
        return bestQuarterTurns;
    },
}

// Which way a direction at a point runs on screen, normalized; undefined where it can't be told.
function getScreenDirection(pos: Vec3, direction: Vec3, project: (point: Vec3) => Vec2 | null): Vec2 | undefined
{
    const start = project(pos);
    const end = project(Vector3DUtil.add(pos, Vector3DUtil.scale(direction, SCREEN_DIRECTION_STEP)));
    if (start == null || end == null)
        return undefined;
    const x = end.x - start.x;
    const y = end.y - start.y;
    const length = Math.sqrt(x * x + y * y);
    return (length > 1e-9) ? {x: x / length, y: y / length} : undefined;
}

export default QuarterTurnsUtil;
