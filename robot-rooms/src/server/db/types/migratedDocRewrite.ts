import * as admin from "firebase-admin";

// A document migrated in memory, with the version it was read at (so the write-back can detect
// concurrent changes).
export default interface MigratedDocRewrite
{
    ref: admin.firestore.DocumentReference;
    originalVersion: number;
    newDocData: admin.firestore.DocumentData;
}
