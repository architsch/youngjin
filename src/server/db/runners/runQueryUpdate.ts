import * as admin from "firebase-admin";
import FirebaseUtil from "../../networking/util/firebaseUtil";
import DBQuery from "../types/dbQuery";
import DBQueryResponse from "../types/dbQueryResponse";
import { DBRow } from "../types/row/dbRow";
import runQueryVersionMigration from "./runQueryVersionMigration";
import LogUtil from "../../../shared/system/util/logUtil";

export default async function runQueryUpdate<T extends DBRow>(
    dbQuery: DBQuery<T>,
    docRef: admin.firestore.DocumentReference | undefined,
    collectionQuery: admin.firestore.Query
): Promise<DBQueryResponse<T>>
{
    let numDocsAffected = 0;
    if (docRef)
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
            const originalVersion = docData.version;
            const newDocData = runQueryVersionMigration(dbQuery, docData);
            if (newDocData.version != originalVersion)
            {
                Object.assign(newDocData, dbQuery.columnValues);
                await docRef.set(newDocData, {merge: false});
            }
            else
            {
                await docRef.update(dbQuery.columnValues);
            }
            numDocsAffected = 1;
        }
        else
        {
            LogUtil.log(`DB Query Failed - doc doesn't exist (docRef.id = ${docRef.id})`, dbQuery.getStateAsObject(), "high", "error");
            return { success: false, data: [] };
        }
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
                const docData = doc.data();
                const originalVersion = docData.version;
                const newDocData = runQueryVersionMigration(dbQuery, docData);
                if (newDocData.version != originalVersion)
                {
                    Object.assign(newDocData, dbQuery.columnValues);
                    batch.set(doc.ref, newDocData, {merge: false});
                }
                else
                {
                    batch.update(doc.ref, dbQuery.columnValues);
                }
            });
            await batch.commit();
        }
        else if (querySnapshot.docs.length == 1)
        {
            const doc = querySnapshot.docs[0];
            const docData = doc.data();
            const originalVersion = docData.version;
            const newDocData = runQueryVersionMigration(dbQuery, docData);
            if (newDocData.version != originalVersion)
            {
                Object.assign(newDocData, dbQuery.columnValues);
                doc.ref.set(newDocData, {merge: false});
            }
            else
            {
                await doc.ref.update(dbQuery.columnValues);
            }
        }
    }
    LogUtil.log(`DB Query Succeeded (numDocsAffected = ${numDocsAffected})`, dbQuery.getStateAsObject(), "medium");
    return { success: true, data: [] };
}