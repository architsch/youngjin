import { InventoryItemTypeEnumMap } from "../../../shared/inventory/types/inventoryItemType";
import Vec3 from "../../../shared/math/types/vec3";
import Vector3DUtil from "../../../shared/math/util/vector3DUtil";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import DollarBillObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/dollarBillObjectTypeConfig";
import ObjectObstacleUtil from "../../../shared/object/util/objectObstacleUtil";
import Room from "../../../shared/room/types/room";
import { COLLISION_LAYER_HEIGHT, PLAYER_SHAPE_PRICE_DOLLARS } from "../../../shared/system/sharedConstants";
import VoxelVertex from "../../../shared/voxel/types/voxelVertex";
import VoxelPathUtil from "../../../shared/voxel/util/voxelPathUtil";
import AgentUserContext from "../types/agentUserContext";
import AgentAppearanceUtil from "./agentAppearanceUtil";
import AgentBodyUtil from "./agentBodyUtil";
import AgentRoomUtil from "./agentRoomUtil";
import AgentToolUtil from "./agentToolUtil";

// How many bills a call goes after, or walks after one the wind has moved, before giving up.
export const MAX_TRIES = 3;

const billTypeIndex = ObjectTypeConfigMap.getIndexByType(DollarBillObjectTypeConfig.objectType);

// What an agent holds, and getting more of it, by what a person's body does: collecting a bill takes no signal of its own,
// the server giving it to whoever comes near one, looking its way (see DollarBillUtil).
const AgentInventoryUtil =
{
    describe: (ctx: AgentUserContext): object =>
    {
        const {held, forSale} = AgentAppearanceUtil.getBoughtShapes(ctx);
        return {
            dollars: getDollars(ctx),
            shapes_held: held,
            shapes_for_sale: forSale,
            shape_price_dollars: PLAYER_SHAPE_PRICE_DOLLARS,
            note: "collect_bill gets you dollars, and coming back gives you some once a day. unlock_shape spends them on "
                + "a shape for sale, which is then yours for good. change_appearance puts on any shape you hold.",
        };
    },
    // Walks to the nearest bill it can reach, stopping as soon as it has it. A bill can blow away, or go to someone else.
    collectBill: async (ctx: AgentUserContext): Promise<object> =>
    {
        const room = AgentRoomUtil.getCurrentRoom(ctx);
        if (room == undefined)
            return {error: "You aren't in a room."};
        if (getBills(room).length == 0)
            return {error: "There are no bills in this room right now. They turn up now and then: try again in a while, "
                + "or in another room."};

        const before = getDollars(ctx);
        const unreachable = new Set<string>();
        for (let tries = 0; tries < MAX_TRIES; ++tries)
        {
            const bill = findNearestBill(ctx, room, unreachable);
            if (bill == undefined)
                break;
            const goal = findPlaceUnder(room, bill.transform.pos);
            const outcome = (goal == undefined) ? "noPath" : await AgentBodyUtil.walk(ctx, goal,
                {faceToward: bill.transform.pos, until: () => room.objectById[bill.objectId] != bill});
            if (getDollars(ctx) > before)
                return {collected: true, dollars: getDollars(ctx), you: AgentToolUtil.describeMe(ctx)};
            if (outcome == "interrupted" || outcome == "timedOut")
                break;
            if (outcome == "noPath")
                unreachable.add(bill.objectId);
        }
        return {collected: false, dollars: getDollars(ctx), you: AgentToolUtil.describeMe(ctx), note: "No bill came to you: the "
            + "wind or a fan took it out of reach, someone else got there first, there is no way there, or the walk was cut "
            + "short. look, and try again."};
    },
}

function getDollars(ctx: AgentUserContext): number
{
    return ctx.inventory[InventoryItemTypeEnumMap.Dollar] ?? 0;
}

function getBills(room: Room): AddObjectSignal[]
{
    return Object.values(room.objectById).filter(obj => obj.objectTypeIndex == billTypeIndex);
}

function findNearestBill(ctx: AgentUserContext, room: Room, unreachable: Set<string>): AddObjectSignal | undefined
{
    const me = AgentRoomUtil.getMyPlayer(ctx);
    if (me == undefined)
        return undefined;
    return getBills(room).filter(({objectId}) => !unreachable.has(objectId))
        .sort((a, b) => Vector3DUtil.distSqr(a.transform.pos, me.transform.pos)
            - Vector3DUtil.distSqr(b.transform.pos, me.transform.pos))[0];
}

// Where to stand for a bill, which may be up in the air: on the nearest floor below it.
function findPlaceUnder(room: Room, pos: Vec3): VoxelVertex | undefined
{
    const isOpen = ObjectObstacleUtil.getClearance(room.objectById);
    for (let y = pos.y; y >= 0; y -= COLLISION_LAYER_HEIGHT)
    {
        const vertex = VoxelPathUtil.findStandingVertexNear(room.voxelGrid.voxels, {x: pos.x, y, z: pos.z}, undefined,
            isOpen);
        if (vertex != undefined)
            return vertex;
    }
    return undefined;
}

export default AgentInventoryUtil;
