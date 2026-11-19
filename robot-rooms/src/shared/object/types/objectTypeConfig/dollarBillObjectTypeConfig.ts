import { ObjectCategoryEnumMap } from "../objectCategory";
import ObjectTypeConfig from "./objectTypeConfig";

// Its size unfolded, in world units: its length across the crease, and its width along it.
export const DOLLAR_BILL_LENGTH = 0.7;
export const DOLLAR_BILL_WIDTH = 0.3;
// How steeply each half slopes down from the crease as it lies at rest, in radians, and how high that stands the crease
// over what it lies on.
export const DOLLAR_BILL_REST_SLOPE = 0.6;
export const DOLLAR_BILL_REST_HEIGHT = 0.5 * DOLLAR_BILL_LENGTH * Math.sin(DOLLAR_BILL_REST_SLOPE);
// How far across the room from a player's middle they collect a bill, in world units, whether or not it is still on their
// screen: one at their feet has dropped below a first-person view.
export const DOLLAR_BILL_REACH = 4;
// How many bills a room holds before it brings no more of its own, however those came: the ones cannon balls leave
// count too, though they may take a room past it (see ObjectCategoryConfigMap).
export const DOLLAR_BILL_SPAWN_CAP = 2;

// A $1 bill folded in half, which the server spawns in a multiplayer room and blows about, and whoever comes near it,
// looking its way, collects (see DollarBillUtil). Nobody may touch it by any signal. It is no part of what is built,
// though the room's saves keep it (see ObjectTypeConfigMap.isStoredWithRoom). It has no collider: wind moves it along
// paths rather than physics, and nothing is ever stopped by it. Its position is the crease's middle as it stands on its
// two edges, however it lies: that is for each browser to draw (see DollarBillGameObject).
const DollarBillObjectTypeConfig =
{
    objectType: "DollarBill",
    persistent: false,
    autoUnload: true,
    category: ObjectCategoryEnumMap.Collectible,
    canUserAddObject: () => false,
    canUserRemoveObject: () => false,
    canUserSetObjectTransform: () => false,
    canUserSetObjectMetadata: () => false,
    components: {
        spawnedByAny: {
            instancedMeshGraphics: {},
        },
    },
} satisfies ObjectTypeConfig;

export default DollarBillObjectTypeConfig;
