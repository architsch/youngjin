import * as admin from "firebase-admin";
import DBQuery from "../types/dbQuery";
import DBQueryResponse from "../types/dbQueryResponse";
import { DBRow } from "../types/row/dbRow";
import runQueryVersionMigration from "./runQueryVersionMigration";
import LogUtil from "../../../shared/system/util/logUtil";

export default async function runQuerySelect<T extends DBRow>(
    dbQuery: DBQuery<T>,
    docRef: admin.firestore.DocumentReference | undefined,
    collectionQuery: admin.firestore.Query
): Promise<DBQueryResponse<T>>
{
    let data: T[] = [];

    if (docRef) // Access a single document by its ID
    {
        const doc = await docRef.get();
        if (doc.exists)
        {
            const docData = doc.data();
            if (!docData)
            {
                LogUtil.log(`DB Query Failed - doc.data() not found (docId = ${doc.id})`, dbQuery.getStateAsObject(), "high", "error");
                return { success: false, data: [] };
            }
            docData.id = doc.id;
            data.push(runQueryVersionMigration(dbQuery, docData) as T);
        }
    }
    else // Access multiple documents
    {
        const querySnapshot = await collectionQuery.get();
        const docs = querySnapshot.docs;
        docs.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
            if (doc.exists)
            {
                let docData = doc.data();
                if (!docData)
                {
                    LogUtil.log(`DB Query Failed - doc.data() not found (docId = ${doc.id})`, dbQuery.getStateAsObject(), "high", "error");
                    return { success: false, data: [] };
                }
                docData.id = doc.id;
                data.push(runQueryVersionMigration(dbQuery, docData) as T);
            }
        });
    }

    LogUtil.log("DB Query Succeeded", dbQuery.getStateAsObject(), "medium");
    return { success: true, data };
}