import Vec3 from "../../../../math/types/vec3";
import { FORWARD_DIR, INSTANCED_EMISSIVE_MATERIAL_ID, INSTANCED_TIN_MATERIAL_ID } from "../../../../system/sharedConstants";
import { PetExpression, PetExpressionEnumMap } from "../../../../object/types/petExpression";
import PetCompositionConstants, { PET_BODY_HEIGHT, PET_BODY_WIDTH } from "../types/compositionConstants/petCompositionConstants";
import { EmissiveEyeStyleEnumMap } from "../types/emissiveEyeStyle";
import EmissiveGlyph from "../types/emissiveGlyph";
import InstancedMeshCompositionPart from "../types/instancedMeshCompositionPart";

const C = PetCompositionConstants;
// How far its lit squares stand off the faces they lie on.
const SCREEN_RELIEF = 0.005;
// The body, between its wheels' axles and its top, in two halves; the middle of the pet is the middle of its height.
const BODY_BOTTOM = -0.5 * PET_BODY_HEIGHT + 0.5 * C.wheelDiameter;
const BODY_TOP = 0.5 * PET_BODY_HEIGHT;
const HALF_HEIGHT = 0.5 * (BODY_TOP - BODY_BOTTOM);
const BASE_TOP = BODY_BOTTOM + HALF_HEIGHT;
const FRONT = -0.5 * PET_BODY_WIDTH;
// The tin's age (see TIN_RUST_ATTRIBUTE) at each of a pet's steps of rust from none (see PetShownStateUtil.getRust),
// and at the most, past the last, as scrap: measured so that the share of its tin that shows rust is the step's share
// of them all (see dev/scripts/graphics/measurePetRust.js), which the tin's own scale is far from.
const MIN_RUST = -1;
const MAX_RUST = 1;
const RUST_AGES = [-1, 0.0439, 0.1479, 0.216, 0.2789, 0.3419, 0.4083, 0.481, 0.5651, 0.6673, 1];
// How wide its eyes open in surprise, by their own size.
const WIDE_EYES = 1.35;

type Face = EmissiveGlyph & {kind: "face"};
const FACES: {[expression: number]: Face} = {
    [PetExpressionEnumMap.Neutral]: face(1, EmissiveEyeStyleEnumMap.Round, 0, 0),
    [PetExpressionEnumMap.Happy]: face(1, EmissiveEyeStyleEnumMap.Round, 1, 0),
    [PetExpressionEnumMap.Sad]: face(1, EmissiveEyeStyleEnumMap.Round, -1, 0),
    [PetExpressionEnumMap.Surprised]: face(WIDE_EYES, EmissiveEyeStyleEnumMap.Round, 0, 1),
    [PetExpressionEnumMap.Asleep]: face(0, EmissiveEyeStyleEnumMap.Round, 0, 0),
    [PetExpressionEnumMap.Angry]: face(1, EmissiveEyeStyleEnumMap.Slanted, -1, 0),
    [PetExpressionEnumMap.Panicked]: face(1, EmissiveEyeStyleEnumMap.Crossed, 0, 1),
    [PetExpressionEnumMap.Off]: {...face(0, EmissiveEyeStyleEnumMap.Round, 0, 0), brightness: 0},
};

// A pet's parts (see PetCompositionConstants), and how they show its rust, its charge and its face, or lie dark once it
// is scrap: the same for whatever composes one, so that a pet looks alike wherever it is drawn.
const PetCompositionUtil =
{
    // Every part, in the order PetCompositionConstants indexes them, without rust, charged, its face level.
    buildParts: (): InstancedMeshCompositionPart[] =>
    {
        const parts: InstancedMeshCompositionPart[] = [
            makeTinPart("Box", C.bodyColor, {x: 0, y: BODY_BOTTOM + 0.5 * HALF_HEIGHT, z: 0},
                {x: PET_BODY_WIDTH, y: HALF_HEIGHT, z: PET_BODY_WIDTH}, FORWARD_DIR),
            makeTinPart("Box", C.bodyColor, {x: 0, y: BASE_TOP + 0.5 * HALF_HEIGHT, z: FRONT + 0.5 * C.headDepth},
                {x: PET_BODY_WIDTH, y: HALF_HEIGHT, z: C.headDepth}, FORWARD_DIR),
        ];
        const wheelX = 0.5 * PET_BODY_WIDTH - C.wheelInset - 0.5 * C.wheelWidth;
        for (const [sideX, sideZ] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
        {
            parts.push(makeTinPart("Cylinder", C.wheelColor, {x: sideX * wheelX, y: BODY_BOTTOM, z: sideZ * C.wheelSpread},
                {x: C.wheelDiameter, y: C.wheelDiameter, z: C.wheelWidth}, {x: 1, y: 0, z: 0}));
        }
        parts.push(makeLitPart(C.faceColor, {x: 0, y: BODY_TOP - C.screenTop - 0.5 * C.screenSize.y, z: FRONT - SCREEN_RELIEF},
            C.screenSize, FORWARD_DIR, PetCompositionUtil.getFace(PetExpressionEnumMap.Neutral)));
        for (const side of [-1, 1])
        {
            parts.push(makeLitPart(C.batteryColors[C.batteryColors.length - 1],
                {x: side * (0.5 * PET_BODY_WIDTH + SCREEN_RELIEF), y: BASE_TOP - C.batteryDrop, z: C.batteryAft},
                C.batterySize, {x: side, y: 0, z: 0}, {kind: "battery", level: C.batteryColors.length}));
        }
        for (const label of getLabels())
            parts.push(makeTinPart("Box", C.labelColor, label.offset, label.size, FORWARD_DIR));
        return parts;
    },
    // Shows a living pet's rust, the cells its charge lights, and its face: blinking, its eyes drooping if it is
    // sleepy, and flickering if it is out of power.
    pose: (parts: InstancedMeshCompositionPart[], rust: number, numRustLevels: number, batteryLevel: number,
        expression: PetExpression, sleepy: boolean, powerless: boolean): void =>
    {
        const share = (numRustLevels > 0) ? Math.max(0, Math.min(1, rust / numRustLevels)) : 0;
        setRust(parts, getRustAge(share));
        const screen = parts[C.screenIndex];
        if (screen != undefined)
        {
            const awake = expression != PetExpressionEnumMap.Asleep && expression != PetExpressionEnumMap.Off;
            screen.glyph = {...PetCompositionUtil.getFace(expression), blinks: awake, droops: awake && sleepy,
                flickers: powerless};
        }
        const level = Math.max(0, Math.min(C.batteryColors.length, Math.round(batteryLevel)));
        for (let i = 0; i < C.numBatteries; ++i)
        {
            const battery = parts[C.firstBatteryIndex + i];
            if (battery == undefined)
                continue;
            battery.glyph = {kind: "battery", level};
            battery.color = {...C.batteryColors[Math.max(0, level - 1)]};
        }
    },
    // Paints its body, but not its face, wheels or labels, the color its owner chose (see PetIdentityUtil.getBodyColor).
    paint: (parts: InstancedMeshCompositionPart[], color: Vec3): void =>
    {
        for (const index of [C.baseIndex, C.headIndex])
            setColor(parts[index], color);
    },
    // The ink its model and barcode print in on a body of that color: light on a dark one, which dark ink is lost on.
    getPrintInk: (bodyColor: Vec3): Vec3 =>
    {
        const brightness = (0.299 * bodyColor.x + 0.587 * bodyColor.y + 0.114 * bodyColor.z) / 255;
        return {...((brightness < C.lightInkBelow) ? C.lightInkColor : C.inkColor)};
    },
    // The same parts as scrap: in one piece, rusted through but for its labels, which are dulled, its screen and its
    // charge dark.
    poseScrap: (parts: InstancedMeshCompositionPart[]): void =>
    {
        setRust(parts, MAX_RUST);
        for (const index of [C.baseIndex, C.headIndex])
            setColor(parts[index], C.scrapBodyColor);
        for (let i = 0; i < C.numWheels; ++i)
            setColor(parts[C.firstWheelIndex + i], C.scrapWheelColor);
        for (let i = 0; i < C.numLabels; ++i)
            setColor(parts[C.firstLabelIndex + i], C.scrapLabelColor);
        const screen = parts[C.screenIndex];
        if (screen != undefined)
            screen.glyph = PetCompositionUtil.getFace(PetExpressionEnumMap.Off);
        for (let i = 0; i < C.numBatteries; ++i)
        {
            const battery = parts[C.firstBatteryIndex + i];
            if (battery != undefined)
                battery.glyph = {kind: "battery", level: 0};
        }
    },
    // The face an expression is drawn as, at rest.
    getFace: (expression: PetExpression): Face =>
    {
        return {...(FACES[expression] ?? FACES[PetExpressionEnumMap.Neutral])};
    },
    // Where the plates a pet's name is printed on lie, on the front of its base and on the back of it, and the word over
    // each of its battery indicators, about its middle, for whatever draws them (see PetNamePlate).
    getPlates: (): {offset: Vec3, dir: Vec3, size: Vec3}[] =>
    {
        const y = BASE_TOP - C.plateTop - 0.5 * C.plateSize.y;
        return [-1, 1].map(side => ({offset: {x: 0, y, z: side * (0.5 * PET_BODY_WIDTH + SCREEN_RELIEF)},
            dir: {x: 0, y: 0, z: side}, size: C.plateSize}));
    },
    getBatteryLabels: (): {offset: Vec3, dir: Vec3, size: Vec3}[] =>
    {
        const y = BASE_TOP - C.batteryDrop + 0.5 * C.batterySize.y + C.batteryLabelGap + 0.5 * C.batteryLabelSize.y;
        return [-1, 1].map(side => ({offset: {x: side * (0.5 * PET_BODY_WIDTH + SCREEN_RELIEF), y, z: C.batteryAft},
            dir: {x: side, y: 0, z: 0}, size: C.batteryLabelSize}));
    },
}

function face(eyeOpen: number, eyeStyle: number, mouthCurve: number, mouthOpen: number): Face
{
    return {kind: "face", eyeOpen, eyeStyle, mouthCurve, mouthOpen, brightness: 1};
}

// The labels under the boxes the name is printed in, one on each plate, standing a little off the base.
function getLabels(): {offset: Vec3, size: Vec3}[]
{
    const box = C.nameBox;
    return PetCompositionUtil.getPlates().map(plate => ({
        offset: {x: plate.offset.x + (0.5 * (box.left + box.right) - 0.5) * plate.size.x,
            y: plate.offset.y + (0.5 - 0.5 * (box.top + box.bottom)) * plate.size.y,
            z: plate.dir.z * (0.5 * PET_BODY_WIDTH + C.labelRelief - 0.5 * C.labelThickness)},
        size: {x: (box.right - box.left) * plate.size.x, y: (box.bottom - box.top) * plate.size.y, z: C.labelThickness},
    }));
}

// The tin's age that rusts such a share of it, between the steps it was measured at.
function getRustAge(share: number): number
{
    const at = Math.max(0, Math.min(1, share)) * (RUST_AGES.length - 1);
    const below = Math.floor(at);
    const above = Math.min(RUST_AGES.length - 1, below + 1);
    return RUST_AGES[below] + (RUST_AGES[above] - RUST_AGES[below]) * (at - below);
}

// Every tin part but the labels.
function setRust(parts: InstancedMeshCompositionPart[], rust: number): void
{
    parts.forEach((part, i) => {
        const isLabel = i >= C.firstLabelIndex && i < C.firstLabelIndex + C.numLabels;
        if (part.materialId == INSTANCED_TIN_MATERIAL_ID && !isLabel)
            part.rust = rust;
    });
}

function setColor(part: InstancedMeshCompositionPart | undefined, color: Vec3): void
{
    if (part != undefined)
        part.color = {...color};
}

function makeTinPart(geometryId: string, color: Vec3, offset: Vec3, scale: Vec3, dir: Vec3): InstancedMeshCompositionPart
{
    return {geometryId, materialId: INSTANCED_TIN_MATERIAL_ID, dir: {...dir}, offset, scale: {...scale}, color: {...color},
        rust: MIN_RUST};
}

// A square that fades with the camera's distance, as all a pet lights up does.
function makeLitPart(color: Vec3, offset: Vec3, size: Vec3, dir: Vec3, glyph: EmissiveGlyph): InstancedMeshCompositionPart
{
    return {geometryId: "Square", materialId: INSTANCED_EMISSIVE_MATERIAL_ID, dir: {...dir}, offset,
        scale: {x: size.x, y: size.y, z: 1}, color: {...color}, glyph, dims: true};
}

export default PetCompositionUtil;
