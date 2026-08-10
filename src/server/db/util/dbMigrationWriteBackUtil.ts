import * as admin from "firebase-admin";
import MigratedDocRewrite from "../types/migratedDocRewrite";
import LogUtil from "../../../shared/system/util/logUtil";
import ErrorUtil from "../../../shared/system/util/errorUtil";
import { DB_MAX_WRITES_PER_COMMIT } from "../../system/serverConstants";

const DBMigrationWriteBackUtil =
{
    // Persists documents that a read had to migrate, so that the next read finds them already
    // current. Callers deliberately don't await this: the migrated data has been handed to the
    // caller either way, so a read must never be delayed — or failed — by the write-back. The
    // returned promise never rejects; every failure is logged instead.
    writeBack: async (firestore: admin.firestore.Firestore, rewrites: MigratedDocRewrite[]): Promise<void> =>
    {
        for (let i = 0; i < rewrites.length; i += DB_MAX_WRITES_PER_COMMIT)
        {
            const chunk = rewrites.slice(i, i + DB_MAX_WRITES_PER_COMMIT);
            try {
                await firestore.runTransaction(async (tx: admin.firestore.Transaction) => {
                    // Firestore requires every read in a transaction to precede every write, so the
                    // whole chunk is re-read up front instead of one document at a time.
                    const freshDocs = await tx.getAll(...chunk.map(rewrite => rewrite.ref));
                    for (let j = 0; j < chunk.length; j++)
                    {
                        const rewrite = chunk[j];
                        const freshDoc = freshDocs[j];
                        // If the version already changed, someone else must have migrated or updated
                        // it already. If that's the case, don't do anything.
                        if (freshDoc.exists && freshDoc.data()?.version === rewrite.originalVersion)
                            tx.set(rewrite.ref, withoutRowID(rewrite.newDocData), { merge: false });
                    }
                });
            }
            catch (err) {
                LogUtil.log("Migration write-back failed",
                    { numDocs: chunk.length, errorMessage: ErrorUtil.getErrorMessage(err) }, "low", "error");
            }
        }
    },
}

// A row carries an "id" so that callers can tell which document it came from, but that identity
// belongs to the document itself, not to its contents — writing it back would store a second,
// redundant copy of it inside the document.
function withoutRowID(docData: admin.firestore.DocumentData): admin.firestore.DocumentData
{
    const { id, ...rest } = docData;
    return rest;
}

export default DBMigrationWriteBackUtil;
