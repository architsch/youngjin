import Vec3 from "../../../../math/types/vec3";
import Geometry3DUtil from "../../../../math/util/geometry3DUtil";
import Vector3DUtil from "../../../../math/util/vector3DUtil";
import { INSTANCED_EMISSIVE_MATERIAL_ID, INSTANCED_TIN_MATERIAL_ID, RELIEF_STEP } from "../../../../system/sharedConstants";
import CannonCompositionConstants from "../types/compositionConstants/cannonCompositionConstants";
import InstancedMeshCompositionPart from "../types/instancedMeshCompositionPart";

const C = CannonCompositionConstants;
// The sides of the pillar its gauges are on, in the face's frame.
const GAUGE_SIDES: Vec3[] = [{x: 1, y: 0, z: 0}, {x: -1, y: 0, z: 0}, {x: 0, y: 1, z: 0}, {x: 0, y: -1, z: 0}];
const OUT: Vec3 = {x: 0, y: 0, z: 1};

// A cannon's parts (see CannonCompositionConstants), and how they stand for where it aims and how many balls it has
// left: the same for whatever composes one, so that a cannon looks alike wherever it is drawn.
const CannonCompositionUtil =
{
    // Every part, in the order CannonCompositionConstants indexes them, posed for no aim and a full load.
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
        for (const color of [C.gaugeColor, C.gaugeFillColor])
        {
            for (const side of GAUGE_SIDES)
            {
                const part = makePart("Square", INSTANCED_EMISSIVE_MATERIAL_ID, color, {x: 0, y: 0, z: 1}, 0);
                part.dir = {...side};
                parts.push(part);
            }
        }
        return parts;
    },
    // A cannon's ball: one sphere, as wide as told.
    buildBallParts: (diameter: number): InstancedMeshCompositionPart[] =>
    {
        return [makePart("Icosphere", INSTANCED_TIN_MATERIAL_ID, C.ballColor, {x: diameter, y: diameter, z: diameter}, 0)];
    },
    // Turns the barrel and its mouth to an aim (in the face's frame, see CannonAimUtil.getLocalDirection), and fills
    // the gauges to a share of a full load. facing: the normal of the face the cannon stands on, which the strips'
    // lengths are laid along.
    pose: (parts: InstancedMeshCompositionPart[], facing: Vec3, aimDirection: Vec3, loadShare: number): void =>
    {
        const barrel = parts[C.barrelIndex];
        const muzzle = parts[C.muzzleIndex];
        if (barrel == undefined || muzzle == undefined)
            return;
        barrel.dir = {...aimDirection};
        muzzle.dir = {...aimDirection};
        muzzle.offset = Vector3DUtil.add(barrel.offset,
            Vector3DUtil.scale(aimDirection, 0.5 * C.barrelLength + C.muzzleProud));

        const {normal, right, up} = Geometry3DUtil.getAxisFacingBasis(facing);
        const share = Math.max(0, Math.min(1, loadShare));
        const bottomZ = C.plateSize.z + C.gaugeBottom;
        const middleZ = bottomZ + 0.5 * C.gaugeLength;
        const fillLength = share * (C.gaugeLength - 2 * C.gaugeFillMargin);
        const fillMiddleZ = bottomZ + C.gaugeFillMargin + 0.5 * fillLength;
        GAUGE_SIDES.forEach((side, i) => {
            // A square turned to face a way keeps the world's up as its own where it can (see
            // Geometry3DUtil.getFacingBasis), so which of its two sides runs along the pillar depends on the face.
            const sideInRoom = Vector3DUtil.add(Vector3DUtil.scale(right, side.x), Vector3DUtil.scale(up, side.y));
            const lengthIsHeight = Math.abs(Vector3DUtil.dot(Geometry3DUtil.getFacingBasis(sideInRoom).up, normal)) > 0.5;
            const reach = 0.5 * ((side.x != 0) ? C.pillarSize.x : C.pillarSize.y);
            poseStrip(parts[C.firstGaugeIndex + i], side, reach + RELIEF_STEP, middleZ, C.gaugeWidth, C.gaugeLength,
                lengthIsHeight);
            poseStrip(parts[C.firstGaugeIndex + C.numGauges + i], side, reach + 2 * RELIEF_STEP, fillMiddleZ,
                C.gaugeFillWidth, fillLength, lengthIsHeight);
        });
    },
    // Dims the gauges' green strips to a share of their glow, toward the dark strips behind them: their own color at 1,
    // and no more to be told from those at 0. Whether that changed how any of them shows.
    setGaugeGlow: (parts: InstancedMeshCompositionPart[], glow: number): boolean =>
    {
        const share = Math.max(0, Math.min(1, glow));
        const dimmed = (dark: number, bright: number) => dark + (bright - dark) * share;
        const color: Vec3 = {x: dimmed(C.gaugeColor.x, C.gaugeFillColor.x), y: dimmed(C.gaugeColor.y, C.gaugeFillColor.y),
            z: dimmed(C.gaugeColor.z, C.gaugeFillColor.z)};
        let changed = false;
        for (let i = 0; i < C.numGauges; ++i)
        {
            const part = parts[C.firstGaugeIndex + C.numGauges + i];
            if (part == undefined || (part.color != undefined && Vector3DUtil.equal(part.color, color)))
                continue;
            part.color = {...color};
            changed = true;
        }
        return changed;
    },
}

function makePart(geometryId: string, materialId: string, color: Vec3, scale: Vec3, z: number): InstancedMeshCompositionPart
{
    return {geometryId, materialId, dir: {...OUT}, offset: {x: 0, y: 0, z}, scale: {...scale}, color: {...color}};
}

function poseStrip(part: InstancedMeshCompositionPart | undefined, side: Vec3, reach: number, z: number, width: number,
    length: number, lengthIsHeight: boolean): void
{
    if (part == undefined)
        return;
    part.offset = {x: side.x * reach, y: side.y * reach, z};
    part.scale = lengthIsHeight ? {x: width, y: length, z: 1} : {x: length, y: width, z: 1};
}

export default CannonCompositionUtil;
