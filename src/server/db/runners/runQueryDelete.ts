import FirebaseUtil from "../../networking/util/firebaseUtil";
import ServerLogUtil from "../../networking/util/serverLogUtil";
import DBQuery from "../types/dbQuery";
import DBQueryResponse from "../types/dbQueryResponse";
import { DBRow } from "../types/row/dbRow";

export default async function runDelete<T extends DBRow>(
    dbQuery: DBQuery<T>,
    docRef: FirebaseFirestore.DocumentReference | undefined,
    collectionQuery: FirebaseFirestore.Query
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
            querySnapshot.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
                batch.delete(doc.ref);
            });
            await batch.commit();
        }
        else if (querySnapshot.docs.length == 1)
        {
            await querySnapshot.docs[0].ref.delete();
        }
    }
    ServerLogUtil.log(`DB Query Succeeded (numDocsAffected = ${numDocsAffected})`, dbQuery.getStateAsObject(), "medium");
    return { success: true, data: [] };
}