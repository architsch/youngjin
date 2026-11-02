import * as admin from "firebase-admin";
import FirebaseUtil from "../../networking/util/firebaseUtil";
import DBQuery from "../types/dbQuery";
import DBQueryResponse from "../types/dbQueryResponse";
import { DBRow } from "../types/row/dbRow";
import runQueryVersionMigration from "./runQueryVersionMigration";
import LogUtil from "../../../shared/system/util/logUtil";
import DBCacheUtil from "../util/dbCacheUtil";
import DBRowIdentityUtil from "../util/dbRowIdentityUtil";
import { DB_MAX_WRITES_PER_COMMIT } from "../../system/serverConstants";

export default async function runQueryUpdate<T extends DBRow>(
    dbQuery: DBQuery<T>,
    docRef: admin.firestore.DocumentReference | undefined,
    collectionQuery: admin.firestore.Query
): Promise<DBQueryResponse<T>>
{
    let numDocsAffected = 0;
    if (docRef)
    {
        if (!dbQuery._skipCacheInvalidation)
            DBCacheUtil.invalidate(dbQuery.tableId, docRef.id);

        const doc = await docRef.get();
        if (doc.exists)
        {
            const docData = doc.data();
            if (!docData)
            {
                LogUtil.log(`DB Query Failed - doc.data() not found (docId = ${doc.id})`, dbQuery.getStateAsObject(), "high", "error");
                return { success: false, data: [] };
            }
            DBRowIdentityUtil.fromDocument(docData, doc.id);
            const originalVersion = docData.version;
            const newDocData = await runQueryVersionMigration(dbQuery, docData);
            if (newDocData.version != originalVersion)
            {
                const batch = docRef.firestore.batch();
                rewriteMigrated(batch, docRef, newDocData, dbQuery);
                await batch.commit();
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

        if (!dbQuery._skipCacheInvalidation)
        {
            for (const doc of querySnapshot.docs)
                DBCacheUtil.invalidate(dbQuery.tableId, doc.id);
        }

        if (querySnapshot.docs.length > 1)
        {
            const db = await FirebaseUtil.getDB();
            const migrated = await Promise.all(querySnapshot.docs.map(async (doc: admin.firestore.QueryDocumentSnapshot) => {
                const docData = DBRowIdentityUtil.fromDocument(doc.data(), doc.id);
                const originalVersion = docData.version;
                const newDocData = await runQueryVersionMigration(dbQuery, docData);
                return { ref: doc.ref, originalVersion, newDocData };
            }));
            // Chunked to Firestore's per-commit write limit, a migrated row taking two.
            let batch = db.batch();
            let numWrites = 0;
            for (const { ref, originalVersion, newDocData } of migrated)
            {
                const isMigrated = newDocData.version != originalVersion;
                if (numWrites + (isMigrated ? 2 : 1) > DB_MAX_WRITES_PER_COMMIT)
                {
                    await batch.commit();
                    batch = db.batch();
                    numWrites = 0;
                }
                if (isMigrated)
                    rewriteMigrated(batch, ref, newDocData, dbQuery);
                else
                    batch.update(ref, dbQuery.columnValues);
                numWrites += isMigrated ? 2 : 1;
            }
            await batch.commit();
        }
        else if (querySnapshot.docs.length == 1)
        {
            const doc = querySnapshot.docs[0];
            const docData = DBRowIdentityUtil.fromDocument(doc.data(), doc.id);
            const originalVersion = docData.version;
            const newDocData = await runQueryVersionMigration(dbQuery, docData);
            if (newDocData.version != originalVersion)
            {
                const batch = doc.ref.firestore.batch();
                rewriteMigrated(batch, doc.ref, newDocData, dbQuery);
                await batch.commit();
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

// The row as migrated, then the update on top as a write of its own, in one commit. Folded into the rewrite, an increment
// would count from nothing, the rewrite having replaced what it adds to.
function rewriteMigrated<T extends DBRow>(batch: admin.firestore.WriteBatch, ref: admin.firestore.DocumentReference,
    newDocData: admin.firestore.DocumentData, dbQuery: DBQuery<T>): void
{
    batch.set(ref, DBRowIdentityUtil.forStorage(newDocData), {merge: false});
    batch.update(ref, dbQuery.columnValues);
}