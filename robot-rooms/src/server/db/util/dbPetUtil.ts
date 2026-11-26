import { FieldPath, FieldValue } from "firebase-admin/firestore";
import FirebaseUtil from "../../networking/util/firebaseUtil";
import LogUtil from "../../../shared/system/util/logUtil";
import ErrorUtil from "../../../shared/system/util/errorUtil";
import { InventoryItemTypeEnumMap } from "../../../shared/inventory/types/inventoryItemType";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import { COLLECTION_USERS } from "../../system/serverConstants";
import runQueryVersionMigration from "../runners/runQueryVersionMigration";
import DBQuery from "../types/dbQuery";
import DBUser from "../types/row/dbUser";
import DBUserVersionMigration from "../types/versionMigration/dbUserVersionMigration";
import DBCacheUtil from "./dbCacheUtil";
import DBRowIdentityUtil from "./dbRowIdentityUtil";

// Users' pets, in their rows' "playerMetadata" maps (see PetRecordUtil), where their players' other metadata is kept
// between visits (see DBUserUtil.savePlayerMetadata). Written by the field's own path, in a transaction, so that it
// neither touches the rest of the map nor depends on what was last read of it.
const DBPetUtil =
{
    // Writes which pets a user owns, and a change in their dollars with it, as one write: a pet is never paid for and
    // not kept, nor sold and still kept. False if it couldn't be written. Every entry point swallows errors, so
    // gameplay is never interrupted.
    savePets: async (userID: string, pets: string, dollarsChange: number): Promise<boolean> =>
    {
        try
        {
            const db = await FirebaseUtil.getDB();
            const doc = db.collection(COLLECTION_USERS).doc(userID);
            const petsField = new FieldPath("playerMetadata", `${ObjectMetadataKeyEnumMap.Pets}`);
            await db.runTransaction(async transaction => {
                const stored = (await transaction.get(doc)).data();
                if (stored == undefined)
                    throw new Error("The user's row doesn't exist");
                // A row not migrated yet is migrated with it. Left as it was, the rewrite of the row as an earlier read
                // migrated it (see DBMigrationWriteBackUtil), which goes by the row's version alone, could land after
                // this and undo it.
                if (stored.version !== DBUserVersionMigration.length)
                {
                    const migrated = await runQueryVersionMigration(new DBQuery<DBUser>().update(COLLECTION_USERS),
                        DBRowIdentityUtil.fromDocument(stored, userID));
                    transaction.set(doc, DBRowIdentityUtil.forStorage(migrated), {merge: false});
                }
                if (dollarsChange == 0)
                    transaction.update(doc, petsField, pets);
                else
                {
                    transaction.update(doc, petsField, pets, new FieldPath("inventory", InventoryItemTypeEnumMap.Dollar),
                        FieldValue.increment(dollarsChange));
                }
            });
            DBCacheUtil.invalidate(COLLECTION_USERS, userID);
            return true;
        }
        catch (err)
        {
            LogUtil.log("DBPetUtil - failed to save a user's pets",
                {userID, dollarsChange, errorMessage: ErrorUtil.getErrorMessage(err)}, "high", "error");
            return false;
        }
    },
}

export default DBPetUtil;
