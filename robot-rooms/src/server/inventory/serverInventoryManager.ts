import { InventoryItemType, InventoryItemTypeEnumMap } from "../../shared/inventory/types/inventoryItemType";
import BuyItemResultSignal from "../../shared/inventory/types/buyItemResultSignal";
import InventorySignal from "../../shared/inventory/types/inventorySignal";
import LoginRewardSignal from "../../shared/inventory/types/loginRewardSignal";
import PlayerShapeItemUtil from "../../shared/inventory/util/playerShapeItemUtil";
import PlayerCompositionParams from "../../shared/graphics/mesh/composition/types/compositionParams/playerCompositionParams";
import EncodableByteString from "../../shared/networking/types/encodableByteString";
import AddObjectSignal from "../../shared/object/types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../../shared/object/types/objectMetadataKey";
import ObjectCompositionUtil from "../../shared/object/util/objectCompositionUtil";
import { LOGIN_REWARD_DOLLARS } from "../../shared/system/sharedConstants";
import DBInventoryUtil from "../db/util/dbInventoryUtil";
import UserContext from "../sockets/types/userContext";
import { ItemPurchaseOutcome } from "./types/itemPurchaseOutcome";

// What users hold (see DBUser.inventory). A connected user's is kept on their UserContext for the visit, and each change
// reaches the row at once, as an increment, since a crash must lose nobody what they have earned.
const ServerInventoryManager =
{
    // Tells the user all they hold, as they arrive, with the day's reward for coming back if it is due (see
    // DBUser.lastLoginRewardAt), which by then is what they were read as holding, plus this.
    welcomeUser: async (ctx: UserContext): Promise<void> =>
    {
        const dollar = InventoryItemTypeEnumMap.Dollar;
        const rewarded = await DBInventoryUtil.claimLoginReward(ctx.user.id, dollar, LOGIN_REWARD_DOLLARS);
        if (rewarded)
            ctx.inventory[dollar] = (ctx.inventory[dollar] ?? 0) + LOGIN_REWARD_DOLLARS;
        ServerInventoryManager.tellUser(ctx);
        if (rewarded)
            ctx.addPendingSignalToUser("loginRewardSignal", new LoginRewardSignal(LOGIN_REWARD_DOLLARS));
    },
    // Tells the user all they hold.
    tellUser: (ctx: UserContext): void =>
    {
        ctx.addPendingSignalToUser("inventorySignal", new InventorySignal({...ctx.inventory}));
    },
    addItem: (ctx: UserContext, itemType: InventoryItemType, quantity: number): void =>
    {
        ctx.inventory[itemType] = (ctx.inventory[itemType] ?? 0) + quantity;
        ServerInventoryManager.tellUser(ctx);
        void DBInventoryUtil.addItem(ctx.user.id, itemType, quantity);
    },
    // Takes dollars from the user for something that isn't theirs to hold (a cannon set in a room), if they have them:
    // whether it did. What is kept here decides, at once, so that what is paid for is made in the same breath, with
    // nothing arriving in between; the row follows, as it does a gain.
    spendDollars: (ctx: UserContext, dollars: number): boolean =>
    {
        const dollar = InventoryItemTypeEnumMap.Dollar;
        if (!((ctx.inventory[dollar] ?? 0) >= dollars))
            return false;
        ServerInventoryManager.addItem(ctx, dollar, -dollars);
        return true;
    },
    // Spends the user's dollars on an item for sale that they don't hold yet, and answers. The row decides, in one
    // transaction (see DBInventoryUtil.buyItem): what is kept here only spares it the requests that can't succeed. Asking
    // for what they hold costs nothing, so that a request repeated for want of an answer isn't paid for twice.
    buyItem: async (ctx: UserContext, itemType: InventoryItemType): Promise<void> =>
    {
        const dollar = InventoryItemTypeEnumMap.Dollar;
        const price = PlayerShapeItemUtil.getPrice(itemType);
        let outcome: ItemPurchaseOutcome = "refused";
        if (price != undefined && ctx.inventory[itemType] > 0)
            outcome = "held";
        else if (price != undefined && ctx.inventory[dollar] >= price)
            outcome = await DBInventoryUtil.buyItem(ctx.user.id, itemType, price);

        if (outcome == "bought")
            ctx.inventory[dollar] -= price!;
        if (outcome != "refused")
            ctx.inventory[itemType] = 1;
        ServerInventoryManager.tellUser(ctx);
        ctx.addPendingSignalToUser("buyItemResultSignal", new BuyItemResultSignal(itemType, outcome != "refused"));
    },
    // Whether the user may change their character's look to this. A shape it wears already stays allowed, or a look
    // from before shapes had to be bought could never change color. Judged on what browsers would draw from it.
    canWear: (ctx: UserContext, player: AddObjectSignal, look: string): boolean =>
    {
        const worn = readLook(player);
        const wanted = readLook({...player, metadata: {...player.metadata,
            [ObjectMetadataKeyEnumMap.InstancedMeshComposition]: new EncodableByteString(look)}} as AddObjectSignal);
        return (Object.keys(wanted.types) as (keyof PlayerCompositionParams["types"])[]).every(part =>
            wanted.types[part] == worn.types[part] || !PlayerShapeItemUtil.isLocked(ctx.inventory, part, wanted.types[part]));
    },
}

function readLook(player: AddObjectSignal): PlayerCompositionParams
{
    const params = {} as PlayerCompositionParams;
    ObjectCompositionUtil.decode(player, params, []);
    return params;
}

export default ServerInventoryManager;
