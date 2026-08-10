import * as admin from "firebase-admin";

// A document that has been brought up to the latest schema version in memory, paired with the
// version it was read at. The original version is what lets the write-back tell whether anyone
// else has touched the document in the meantime, and thus whether the rewrite is still valid.
export default interface MigratedDocRewrite
{
    ref: admin.firestore.DocumentReference;
    originalVersion: number;
    newDocData: admin.firestore.DocumentData;
}
