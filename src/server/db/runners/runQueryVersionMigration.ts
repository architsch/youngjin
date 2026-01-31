import * as admin from "firebase-admin";
import { DBVersionMigration } from "../types/versionMigration/dbVersionMigration";
import DBUserVersionMigration from "../types/versionMigration/dbUserVersionMigration";
import DBRoomVersionMigration from "../types/versionMigration/dbRoomVersionMigration";
import DBQuery from "../types/dbQuery";
import { DBRow } from "../types/row/dbRow";

export default function runQueryVersionMigration<T extends DBRow>(
    dbQuery: DBQuery<T>,
    docData: admin.firestore.DocumentData
): admin.firestore.DocumentData
{
    let versionMigration: DBVersionMigration;
    switch (dbQuery.tableId)
    {
        case "users":
            versionMigration = DBUserVersionMigration;
            break;
        case "rooms":
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

        // TODO: Register a queued task that replaces the original document with the new one.
        //...

        return docDataAfterMigration;
    }
    else
    {
        return docData;
    }
}