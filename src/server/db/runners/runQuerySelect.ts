import ServerLogUtil from "../../networking/util/serverLogUtil";
import DBQuery from "../types/dbQuery";
import DBQueryResponse from "../types/dbQueryResponse";
import { DBRow } from "../types/row/dbRow";
import runQueryVersionMigration from "./runQueryVersionMigration";

export default async function runSelect<T extends DBRow>(
    dbQuery: DBQuery<T>,
    docRef: FirebaseFirestore.DocumentReference | undefined,
    collectionQuery: FirebaseFirestore.Query
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
                ServerLogUtil.log(`DB Query Failed - doc.data() not found (docId = ${doc.id})`, dbQuery.getStateAsObject(), "medium");
                return { success: false, data: [] };
            }
            data.push(runQueryVersionMigration(dbQuery, docData) as T);
        }
    }
    else // Access multiple documents
    {
        const querySnapshot = await collectionQuery.get();
        const docs = querySnapshot.docs;
        docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
            let docData = doc.data();
            if (!docData)
            {
                ServerLogUtil.log(`DB Query Failed - doc.data() not found (docId = ${doc.id})`, dbQuery.getStateAsObject(), "medium");
                return { success: false, data: [] };
            }
            data.push(runQueryVersionMigration(dbQuery, docData) as T);
        });
    }

    ServerLogUtil.log("DB Query Succeeded", dbQuery.getStateAsObject(), "medium");
    return { success: true, data };
}