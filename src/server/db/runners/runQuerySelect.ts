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

            const originalVersion = docData.version;
            const newDocData = runQueryVersionMigration(dbQuery, docData);
            if (newDocData.version !== originalVersion)
            {
                // Write back the updated data to the DB (Note: This is a fire-and-forget operation. Don't await, don't block the read)
                docRef.firestore.runTransaction(async (tx: admin.firestore.Transaction) => {
                    const freshDoc = await tx.get(docRef);
                    if (freshDoc.exists && freshDoc.data()?.version === originalVersion)
                        tx.set(docRef, newDocData, { merge: false });
                    // If the version already changed, someone else must have migrated or updated it already. If that's the case, don't do anything.
                }).catch(err => LogUtil.log("Migration write-back failed", { err }, "low", "error"));
            }
            data.push(newDocData as T);
        }
    }
    else // Access multiple documents
    {
        const querySnapshot = await collectionQuery.get();
        const docs = querySnapshot.docs;
        const staleDocEntries: { ref: admin.firestore.DocumentReference, originalVersion: number, newDocData: admin.firestore.DocumentData }[] = [];

        docs.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
            if (doc.exists)
            {
                let docData = doc.data();
                if (!docData)
                {
                    LogUtil.log(`DB Query Failed - doc.data() not found (docId = ${doc.id})`, dbQuery.getStateAsObject(), "high", "error");
                    return;
                }
                docData.id = doc.id;
                const originalVersion = docData.version;
                const newDocData = runQueryVersionMigration(dbQuery, docData);
                if (newDocData.version !== originalVersion)
                    staleDocEntries.push({ ref: doc.ref, originalVersion, newDocData });
                data.push(newDocData as T);
            }
        });

        if (staleDocEntries.length > 0)
        {
            // Note: Each Firestore transaction can process only upt o 500 reads/writes.
            
            // Write back the updated data to the DB (Note: This is a fire-and-forget operation. Don't await, don't block the read)
            collectionQuery.firestore.runTransaction(async (tx: admin.firestore.Transaction) => {
                for (const entry of staleDocEntries)
                {
                    const freshDoc = await tx.get(entry.ref);
                    if (freshDoc.exists && freshDoc.data()?.version === entry.originalVersion)
                        tx.set(entry.ref, entry.newDocData, { merge: false });
                    // If the version already changed, someone else must have migrated or updated it already. If that's the case, don't do anything.
                }
            }).catch(err => LogUtil.log("Migration write-back failed", { err }, "low", "error"));
        }
    }

    LogUtil.log("DB Query Succeeded", dbQuery.getStateAsObject(), "medium");
    return { success: true, data };
}