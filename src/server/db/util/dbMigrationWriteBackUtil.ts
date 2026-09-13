import * as admin from "firebase-admin";
import MigratedDocRewrite from "../types/migratedDocRewrite";
import DBRowIdentityUtil from "./dbRowIdentityUtil";
import LogUtil from "../../../shared/system/util/logUtil";
import ErrorUtil from "../../../shared/system/util/errorUtil";
import { DB_MAX_WRITES_PER_COMMIT } from "../../system/serverConstants";

const DBMigrationWriteBackUtil =
{
    // Persists migrated documents. Not awaited by callers, never rejects (failures are logged).
    writeBack: async (firestore: admin.firestore.Firestore, rewrites: MigratedDocRewrite[]): Promise<void> =>
    {
        for (let i = 0; i < rewrites.length; i += DB_MAX_WRITES_PER_COMMIT)
        {
            const chunk = rewrites.slice(i, i + DB_MAX_WRITES_PER_COMMIT);
            try {
                await firestore.runTransaction(async (tx: admin.firestore.Transaction) => {
                    // Transactions require all reads before writes, so the chunk is read up front.
                    const freshDocs = await tx.getAll(...chunk.map(rewrite => rewrite.ref));
                    for (let j = 0; j < chunk.length; j++)
                    {
                        const rewrite = chunk[j];
                        const freshDoc = freshDocs[j];
                        // Skip if the version changed meanwhile (someone else already migrated or updated it).
                        if (freshDoc.exists && freshDoc.data()?.version === rewrite.originalVersion)
                            tx.set(rewrite.ref, DBRowIdentityUtil.forStorage(rewrite.newDocData), { merge: false });
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

export default DBMigrationWriteBackUtil;
