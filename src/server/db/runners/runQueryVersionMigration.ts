import * as admin from "firebase-admin";
import { DBVersionMigration } from "../types/versionMigration/dbVersionMigration";
import DBUserVersionMigration from "../types/versionMigration/dbUserVersionMigration";
import DBRoomVersionMigration from "../types/versionMigration/dbRoomVersionMigration";
import DBQuery from "../types/dbQuery";
import { DBRow } from "../types/row/dbRow";
import { COLLECTION_ROOMS, COLLECTION_USERS } from "../../system/serverConstants";

export default function runQueryVersionMigration<T extends DBRow>(
    dbQuery: DBQuery<T>,
    docData: admin.firestore.DocumentData
): admin.firestore.DocumentData
{
    let versionMigration: DBVersionMigration;
    switch (dbQuery.tableId)
    {
        case COLLECTION_USERS:
            versionMigration = DBUserVersionMigration;
            break;
        case COLLECTION_ROOMS:
            versionMigration = DBRoomVersionMigration;
            break;
        default:
            throw new Error(`Unknown table ID: ${dbQuery.tableId}`);
    }
    const latestVersion = versionMigration.length;
    const version = docData.version;
    if (isNaN(version))
        throw new Error(`"version" field is not a number (tableId = ${dbQuery.tableId}, docData = ${JSON.stringify(docData)})`);
    
    let versionNumber = version as number;

    if (versionNumber < latestVersion)
    {
        let docDataAfterMigration = docData;
        while (versionNumber < latestVersion)
        {
            docDataAfterMigration = versionMigration[versionNumber](docDataAfterMigration);
            docDataAfterMigration.version = ++versionNumber;
        }
        docDataAfterMigration.version = versionNumber;
        return docDataAfterMigration;
    }
    else
    {
        return docData;
    }
}