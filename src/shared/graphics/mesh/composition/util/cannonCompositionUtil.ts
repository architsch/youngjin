import Vec3 from "../../../../math/types/vec3";
import Geometry3DUtil from "../../../../math/util/geometry3DUtil";
import Vector3DUtil from "../../../../math/util/vector3DUtil";
import { INSTANCED_EMISSIVE_MATERIAL_ID, INSTANCED_TIN_MATERIAL_ID, RELIEF_STEP } from "../../../../system/sharedConstants";
import CannonCompositionConstants from "../types/compositionConstants/cannonCompositionConstants";
import InstancedMeshCompositionPart from "../types/instancedMeshCompositionPart";

const C = CannonCompositionConstants;
// The sides of the pillar its counters are on, in the face's frame.
const COUNTER_SIDES: Vec3[] = [{x: 1, y: 0, z: 0}, {x: -1, y: 0, z: 0}, {x: 0, y: 1, z: 0}, {x: 0, y: -1, z: 0}];
const OUT: Vec3 = {x: 0, y: 0, z: 1};
const NUM_SEGMENTS = C.numCounters * C.digitsPerCounter * C.segmentsPerDigit;
// A digit's segments, as a digital display numbers them: the top bar, upper right, lower right, bottom bar, lower left,
// upper left and middle bar. Each lies between the others' ends, which leaves its corners open. Where one lies from the
// digit's middle, across the panel and along it.
const SIDE_REACH = 0.5 * (C.digitWidth - C.segmentThickness);
const BAR_REACH = 0.5 * (C.digitHeight - C.segmentThickness);
const BAR_LENGTH = C.digitWidth - 2 * C.segmentThickness;
const SIDE_LENGTH = 0.5 * (C.digitHeight - 3 * C.segmentThickness);
const SEGMENTS: {across: number, along: number, isBar: boolean}[] = [
    {across: 0, along: BAR_REACH, isBar: true},
    {across: SIDE_REACH, along: 0.5 * BAR_REACH, isBar: false},
    {across: SIDE_REACH, along: -0.5 * BAR_REACH, isBar: false},
    {across: 0, along: -BAR_REACH, isBar: true},
    {across: -SIDE_REACH, along: -0.5 * BAR_REACH, isBar: false},
    {across: -SIDE_REACH, along: 0.5 * BAR_REACH, isBar: false},
    {across: 0, along: 0, isBar: true},
];
// The segments each digit lights, bit i for SEGMENTS[i].
export const DIGIT_SEGMENTS = [0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F];

// A cannon's parts (see CannonCompositionConstants), and how they stand for where it aims and how many balls it has
// left: the same for whatever composes one, so that a cannon looks alike wherever it is drawn.
const CannonCompositionUtil =
{
    // Every part, in the order CannonCompositionConstants indexes them, its barrel pointing straight out, and its counters
    // as yet unposed (see pose).
    buildParts: (): InstancedMeshCompositionPart[] =>
    {
        const parts: InstancedMeshCompositionPart[] = [
            makePart("Box", INSTANCED_TIN_MATERIAL_ID, C.plateColor, C.plateSize, 0.5 * C.plateSize.z),
            makePart("Box", INSTANCED_TIN_MATERIAL_ID, C.pillarColor, C.pillarSize, C.plateSize.z + 0.5 * C.pillarSize.z),
            makePart("Cylinder", INSTANCED_TIN_MATERIAL_ID, C.barrelColor,
                {x: C.barrelDiameter, y: C.barrelDiameter, z: C.barrelLength}, C.pivotHeight),
            makePart("Cylinder", INSTANCED_EMISSIVE_MATERIAL_ID, C.muzzleColor,
                {x: C.muzzleDiameter, y: C.muzzleDiameter, z: C.muzzleThickness}, C.pivotHeight),
        ];
        for (const side of COUNTER_SIDES)
            parts.push(makeSquare(C.counterColor, side));
        for (let i = 0; i < NUM_SEGMENTS; ++i)
            parts.push(makeSquare(C.digitColor, COUNTER_SIDES[Math.floor(i / (C.digitsPerCounter * C.segmentsPerDigit))]));
        return parts;
    },
    // A cannon's ball: one sphere, as wide as told.
    buildBallParts: (diameter: number): InstancedMeshCompositionPart[] =>
    {
        return [makePart("Icosphere", INSTANCED_TIN_MATERIAL_ID, C.ballColor, {x: diameter, y: diameter, z: diameter}, 0)];
    },
    // Turns the barrel and its mouth to an aim (in the face's frame, see CannonAimUtil.getLocalDirection), and shows the
    // balls left on the counters: one digit in a panel's middle, or two side by side. facing: the normal of the face the
    // cannon stands on, which decides where its counters are (see getCounterPlace) and how each panel is turned in the
    // room, and so which way its digits read.
    pose: (parts: InstancedMeshCompositionPart[], facing: Vec3, aimDirection: Vec3, ballsLeft: number): void =>
    {
        const barrel = parts[C.barrelIndex];
        const muzzle = parts[C.muzzleIndex];
        if (barrel == undefined || muzzle == undefined)
            return;
        barrel.dir = {...aimDirection};
        muzzle.dir = {...aimDirection};
        muzzle.offset = Vector3DUtil.add(barrel.offset,
            Vector3DUtil.scale(aimDirection, 0.5 * C.barrelLength + C.muzzleProud));

        const shown = Math.max(0, Math.min(99, Math.round(ballsLeft)));
        const digits = (shown < 10) ? [undefined, shown] : [Math.floor(shown / 10), shown % 10];
        const digitSpacing = (shown < 10) ? 0 : 0.5 * (C.digitWidth + C.digitGap);
        const face = Geometry3DUtil.getAxisFacingBasis(facing);
        for (let i = 0; i < C.numCounters; ++i)
        {
            const {way, middle, seen} = getCounterPlace(i, face);
            const panel = parts[C.firstCounterIndex + i];
            if (panel != undefined)
            {
                panel.dir = {...way};
                panel.offset = Vector3DUtil.add(middle, Vector3DUtil.scale(way, RELIEF_STEP));
                panel.scale = seen ? {x: C.counterSize, y: C.counterSize, z: 1} : {x: 0, y: 0, z: 1};
            }
            // A square turned to face a way keeps the world's up as its own where it can (see
            // Geometry3DUtil.getFacingBasis): the digits run along its right and stand along its up, as it is seen.
            const own = Geometry3DUtil.getAxisFacingBasis(toRoom(way, face));
            const across = toFaceFrame(own.right, face);
            const along = toFaceFrame(own.up, face);
            const surface = Vector3DUtil.add(middle, Vector3DUtil.scale(way, 2 * RELIEF_STEP));
            for (let d = 0; d < C.digitsPerCounter; ++d)
            {
                const digit = digits[d];
                const lit = (digit == undefined || !seen) ? 0 : DIGIT_SEGMENTS[digit];
                const digitAcross = (d == 0 ? -1 : 1) * digitSpacing;
                for (let s = 0; s < C.segmentsPerDigit; ++s)
                {
                    const part = parts[C.firstSegmentIndex + (i * C.digitsPerCounter + d) * C.segmentsPerDigit + s];
                    if (part == undefined)
                        continue;
                    const segment = SEGMENTS[s];
                    part.dir = {...way};
                    part.offset = Vector3DUtil.add(surface, Vector3DUtil.add(
                        Vector3DUtil.scale(across, digitAcross + segment.across), Vector3DUtil.scale(along, segment.along)));
                    part.scale = ((lit & (1 << s)) == 0) ? {x: 0, y: 0, z: 1}
                        : segment.isBar ? {x: BAR_LENGTH, y: C.segmentThickness, z: 1}
                        : {x: C.segmentThickness, y: SIDE_LENGTH, z: 1};
                }
            }
        }
    },
    // Lights the counters' digits: green, or red while warning, dimmed toward the black behind them by a share of their
    // glow (none of it at 0), and as black as it while not lit. Whether that changed how any of them shows.
    setCounterLight: (parts: InstancedMeshCompositionPart[], glow: number, warning: boolean, lit: boolean): boolean =>
    {
        const share = lit ? Math.max(0, Math.min(1, glow)) : 0;
        const color = mix(C.counterColor, warning ? C.digitWarningColor : C.digitColor, share);
        let changed = false;
        for (let i = 0; i < NUM_SEGMENTS; ++i)
            changed = setColor(parts[C.firstSegmentIndex + i], color) || changed;
        return changed;
    },
}

// Where a counter is, in the frame of the face its cannon stands on: the way it faces, its middle on what carries it,
// and whether it is seen at all. Each stands on its side of the pillar, where whoever walks round the cannon reads one,
// as all four do on a floor. On a wall two of those sides face up and down the room: the upper one's counter lies on
// the plate instead, facing out of the wall, over the pillar, and the lower one's is unseen.
function getCounterPlace(index: number, face: {normal: Vec3, right: Vec3, up: Vec3}):
    {way: Vec3, middle: Vec3, seen: boolean}
{
    const side = COUNTER_SIDES[index];
    const rise = toRoom(side, face).y;
    if (rise > 0.5)
    {
        const lift = 0.5 * ((side.x != 0) ? C.plateSize.x : C.plateSize.y) - C.plateCounterInset - 0.5 * C.counterSize;
        return {way: OUT, middle: {x: side.x * lift, y: side.y * lift, z: C.plateSize.z}, seen: true};
    }
    const reach = 0.5 * ((side.x != 0) ? C.pillarSize.x : C.pillarSize.y);
    const middleZ = C.plateSize.z + C.counterBottom + 0.5 * C.counterSize;
    return {way: side, middle: {x: side.x * reach, y: side.y * reach, z: middleZ}, seen: rise > -0.5};
}

// A room direction, in the frame of the face a cannon stands on.
function toFaceFrame(direction: Vec3, face: {normal: Vec3, right: Vec3, up: Vec3}): Vec3
{
    return {x: Vector3DUtil.dot(direction, face.right), y: Vector3DUtil.dot(direction, face.up),
        z: Vector3DUtil.dot(direction, face.normal)};
}

// A direction in that frame, in the room.
function toRoom(direction: Vec3, face: {normal: Vec3, right: Vec3, up: Vec3}): Vec3
{
    return Vector3DUtil.add(Vector3DUtil.add(Vector3DUtil.scale(face.right, direction.x),
        Vector3DUtil.scale(face.up, direction.y)), Vector3DUtil.scale(face.normal, direction.z));
}

function mix(from: Vec3, to: Vec3, share: number): Vec3
{
    return {x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share, z: from.z + (to.z - from.z) * share};
}

// Whether that changed it.
function setColor(part: InstancedMeshCompositionPart | undefined, color: Vec3): boolean
{
    if (part == undefined || (part.color != undefined && Vector3DUtil.equal(part.color, color)))
        return false;
    part.color = {...color};
    return true;
}

function makePart(geometryId: string, materialId: string, color: Vec3, scale: Vec3, z: number): InstancedMeshCompositionPart
{
    return {geometryId, materialId, dir: {...OUT}, offset: {x: 0, y: 0, z}, scale: {...scale}, color: {...color}};
}

// Unseen until posed.
function makeSquare(color: Vec3, side: Vec3): InstancedMeshCompositionPart
{
    const part = makePart("Square", INSTANCED_EMISSIVE_MATERIAL_ID, color, {x: 0, y: 0, z: 1}, 0);
    part.dir = {...side};
    return part;
}

export default CannonCompositionUtil;
