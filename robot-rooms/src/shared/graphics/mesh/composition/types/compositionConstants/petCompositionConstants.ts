import Vec3 from "../../../../../math/types/vec3";

// A pet stands this tall on its wheels, three fifths of a player, and is this wide and deep (see PetObjectTypeConfig).
export const PET_BODY_HEIGHT = 1.5;
export const PET_BODY_WIDTH = 0.8;
// Its hitbox is as wide as a player's, so that it gets through wherever a way two voxels wide leads (see
// VoxelPathUtil), and it climbs this many blocks at a step, where a player climbs one.
export const PET_HITBOX_WIDTH = 0.75;
export const PET_CLIMB_LAYERS = 2;
// While it is excited it hops this high (see PetGameObject), which its speech bubble stays clear of.
export const PET_HOP_HEIGHT = 0.22;

// A pet's parts, about the middle of its body: x across it, y up, and -z the way it looks (see FORWARD_DIR), in world
// units. A flat front, a screen wide, carries its face over its name; behind it the upper half is shallower than the
// base, like a desktop computer of the 1980s on its side. It rolls on four wheels tucked under the base, and shows its
// charge on either side of it. Its name is printed under the screen, and on its back, by PetNamePlate, which is no part
// of this, on a label which is.
const PetCompositionConstants =
{
    wheelDiameter: 0.36,
    wheelWidth: 0.2,
    // How far in from the body's sides the wheels' outer faces are, and how far fore and aft of its middle their axles.
    wheelInset: 0.04,
    wheelSpread: 0.21,
    // The upper half's depth: the base is as deep as the body is wide.
    headDepth: 0.46,
    // The screen on the front of the upper half, and how far under the body's top its upper edge is.
    screenSize: {x: 0.68, y: 0.5} as Vec3,
    screenTop: 0.07,
    // The name plate on the front of the base and on the back of it, and how far under the base's top its upper edge is.
    plateSize: {x: 0.66, y: 0.38} as Vec3,
    plateTop: 0.04,
    // The box on each plate the name is printed in, as shares of the plate: across from its left edge, and down from its
    // top (see PetPlateDrawUtil). A label of its own color lies under it, which never rusts, so the name always reads;
    // it stands this far off the base, short of the printing, and is this thick.
    nameBox: {left: 6 / 256, right: 250 / 256, top: 60 / 144, bottom: 138 / 144},
    labelRelief: 0.0025,
    labelThickness: 0.01,
    // A battery indicator on each side of the base: its size, how far behind the body's middle and how far under the
    // base's top its middle is; and the word over it, as high as this.
    batterySize: {x: 0.22, y: 0.11} as Vec3,
    batteryAft: 0.16,
    batteryDrop: 0.33,
    batteryLabelSize: {x: 0.22, y: 0.07} as Vec3,
    batteryLabelGap: 0.02,

    // Colors, as [0,255] RGB (see InstancedMeshCompositionPart): the body's until it is painted its own (see
    // PetCompositionUtil.paint), its wheels, what its screen and its battery indicator light up in, the ink of what is
    // printed on it, and the light, dull yellow of the label its name is printed on.
    bodyColor: {x: 255, y: 255, z: 255} as Vec3,
    wheelColor: {x: 118, y: 118, z: 122} as Vec3,
    faceColor: {x: 96, y: 232, z: 118} as Vec3,
    batteryColors: [{x: 255, y: 52, z: 40}, {x: 255, y: 150, z: 36}, {x: 96, y: 232, z: 118}] as Vec3[],
    inkColor: {x: 58, y: 55, z: 52} as Vec3,
    // The model and barcode print in this instead on a body darker than this, in brightness from 0 to 1.
    lightInkColor: {x: 236, y: 234, z: 228} as Vec3,
    lightInkBelow: 0.3,
    batteryLabelColor: {x: 52, y: 142, z: 70} as Vec3,
    labelColor: {x: 236, y: 220, z: 158} as Vec3,
    // As scrap.
    scrapBodyColor: {x: 104, y: 84, z: 70} as Vec3,
    scrapWheelColor: {x: 50, y: 46, z: 44} as Vec3,
    scrapInkColor: {x: 34, y: 28, z: 24} as Vec3,
    scrapLabelColor: {x: 128, y: 114, z: 80} as Vec3,

    // Where each part is in the list a pet is composed of (see PetCompositionUtil.buildParts).
    baseIndex: 0,
    headIndex: 1,
    firstWheelIndex: 2,
    numWheels: 4,
    screenIndex: 6,
    firstBatteryIndex: 7,
    numBatteries: 2,
    firstLabelIndex: 9,
    numLabels: 2,
};

export default PetCompositionConstants;
