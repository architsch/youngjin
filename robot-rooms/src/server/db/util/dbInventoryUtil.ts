import { FieldValue } from "firebase-admin/firestore";
import FirebaseUtil from "../../networking/util/firebaseUtil";
import LogUtil from "../../../shared/system/util/logUtil";
import { InventoryItemType, InventoryItemTypeEnumMap } from "../../../shared/inventory/types/inventoryItemType";
import { COLLECTION_USERS, LOGIN_REWARD_INTERVAL_MS } from "../../system/serverConstants";
import { ItemPurchaseOutcome } from "../../inventory/types/itemPurchaseOutcome";
import DBCacheUtil from "./dbCacheUtil";

// What users hold, in their rows' "inventory" maps (see DBUser). Written directly with an atomic increment rather than
// through DBQuery, whose rewrite of a row being migrated would take a nested field's path for a field's name; so an
// old row can hold items before it is migrated (see DBUserVersionMigration).
const DBInventoryUtil =
{
    // False if it couldn't be written. Every entry point swallows errors, so gameplay is never interrupted.
    addItem: async (userID: string, itemType: InventoryItemType, quantity: number): Promise<boolean> =>
    {
        try
        {
            const db = await FirebaseUtil.getDB();
            await db.collection(COLLECTION_USERS).doc(userID).update({[`inventory.${itemType}`]: FieldValue.increment(quantity)});
            DBCacheUtil.invalidate(COLLECTION_USERS, userID);
            return true;
        }
        catch (err)
        {
            LogUtil.log("DBInventoryUtil - failed to add an item", {userID, itemType, quantity, err}, "high", "error");
            return false;
        }
    },
    // Gives what a login earns if it is due (see LOGIN_REWARD_INTERVAL_MS): true only for the one call that gave it, however
    // many arrive together. A row not migrated yet is read as its migration will have it.
    claimLoginReward: async (userID: string, itemType: InventoryItemType, quantity: number): Promise<boolean> =>
    {
        try
        {
            const db = await FirebaseUtil.getDB();
            const doc = db.collection(COLLECTION_USERS).doc(userID);
            const now = Date.now();
            const claimed = await db.runTransaction(async transaction => {
                const row = (await transaction.get(doc)).data();
                if (row == undefined || now - (row.lastLoginRewardAt ?? row.lastLoginAt ?? 0) < LOGIN_REWARD_INTERVAL_MS)
                    return false;
                transaction.update(doc, {lastLoginRewardAt: now, [`inventory.${itemType}`]: FieldValue.increment(quantity)});
                return true;
            });
            if (claimed)
                DBCacheUtil.invalidate(COLLECTION_USERS, userID);
            return claimed;
        }
        catch (err)
        {
            LogUtil.log("DBInventoryUtil - failed to claim a login's reward", {userID, err}, "high", "error");
            return false;
        }
    },
    // Takes the dollars and gives the item in one transaction, so that neither can happen without the other, whatever
    // else is arriving: "bought" only for the one call that paid, however many arrive together.
    buyItem: async (userID: string, itemType: InventoryItemType, dollars: number): Promise<ItemPurchaseOutcome> =>
    {
        try
        {
            const db = await FirebaseUtil.getDB();
            const doc = db.collection(COLLECTION_USERS).doc(userID);
            const dollar = InventoryItemTypeEnumMap.Dollar;
            const outcome = await db.runTransaction<ItemPurchaseOutcome>(async transaction => {
                const inventory = (await transaction.get(doc)).data()?.inventory ?? {};
                if (inventory[itemType] > 0)
                    return "held";
                if (!(inventory[dollar] >= dollars))
                    return "refused";
                transaction.update(doc, {[`inventory.${dollar}`]: FieldValue.increment(-dollars), [`inventory.${itemType}`]: 1});
                return "bought";
            });
            if (outcome == "bought")
                DBCacheUtil.invalidate(COLLECTION_USERS, userID);
            return outcome;
        }
        catch (err)
        {
            LogUtil.log("DBInventoryUtil - failed to buy an item", {userID, itemType, dollars, err}, "high", "error");
            return "refused";
        }
    },
    // Makes a login's reward due at once, for testing it (see UserCommandUtil).
    fastForwardLoginRewardClock: async (userID: string): Promise<void> =>
    {
        try
        {
            const db = await FirebaseUtil.getDB();
            await db.collection(COLLECTION_USERS).doc(userID).update({lastLoginRewardAt: Date.now() - LOGIN_REWARD_INTERVAL_MS});
            DBCacheUtil.invalidate(COLLECTION_USERS, userID);
        }
        catch (err)
        {
            LogUtil.log("DBInventoryUtil - failed to fast-forward a login's reward", {userID, err}, "high", "error");
        }
    },
}

export default DBInventoryUtil;
