import * as admin from "firebase-admin";
import FirebaseUtil from "../../networking/util/firebaseUtil";
import DBQuery from "../types/dbQuery";
import DBQueryResponse from "../types/dbQueryResponse";
import { DBRow } from "../types/row/dbRow";
import LogUtil from "../../../shared/system/util/logUtil";

export default async function runQueryDelete<T extends DBRow>(
    dbQuery: DBQuery<T>,
    docRef: admin.firestore.DocumentReference | undefined,
    collectionQuery: admin.firestore.Query
): Promise<DBQueryResponse<T>>
{
    let numDocsAffected = 0;
    if (docRef)
    {
        await docRef.delete(dbQuery.columnValues);
        numDocsAffected = 1;
    }
    else
    {
        const querySnapshot = await collectionQuery.get();
        numDocsAffected = querySnapshot.docs.length;
        if (querySnapshot.docs.length > 1)
        {
            const db = FirebaseUtil.getDB();
            const batch = db.batch();
            querySnapshot.docs.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
                batch.delete(doc.ref);
            });
            await batch.commit();
        }
        else if (querySnapshot.docs.length == 1)
        {
            await querySnapshot.docs[0].ref.delete();
        }
    }
    LogUtil.log(`DB Query Succeeded (numDocsAffected = ${numDocsAffected})`, dbQuery.getStateAsObject(), "medium");
    return { success: true, data: [] };
}