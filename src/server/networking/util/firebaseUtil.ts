import * as admin from "firebase-admin";
import LogUtil from "../../../shared/system/util/logUtil";
import ErrorUtil from "../../../shared/system/util/errorUtil";

const FirebaseUtil =
{
    getDB: async (): Promise<admin.firestore.Firestore> =>
    {
        await ensureFirebaseInitialized();
        return db;
    },
    getStorage: async (): Promise<admin.storage.Storage> =>
    {
        await ensureFirebaseInitialized();
        return storage;
    },
}

// The initialization in flight, or the finished one. A boolean flag cannot stand in for this:
// the startup below awaits a round-trip to Firestore before it could set one, and every caller
// arriving inside that window would find the flag still false and call initializeApp() a second
// time — which throws, and reaches the caller as a failed query rather than as a startup error.
let firebaseInitialization: Promise<void> | undefined;
let db: admin.firestore.Firestore;
let storage: admin.storage.Storage;

function ensureFirebaseInitialized(): Promise<void>
{
    if (!firebaseInitialization)
    {
        // Forgotten if it fails, so that a startup which never got as far as creating the app is
        // retried by the next caller rather than being remembered as a permanent verdict.
        firebaseInitialization = initializeFirebase()
            .catch(err => { firebaseInitialization = undefined; throw err; });
    }
    return firebaseInitialization;
}

async function initializeFirebase()
{
    const app = admin.initializeApp({
        storageBucket: "thingspool.firebasestorage.app",
    });

    db = admin.firestore();
    storage = admin.storage();

    try {
        const optionsObj = getAppOptionsObj(app.options);
        LogUtil.log("Firebase App Initialized", { options: optionsObj }, "high", "info");
    } catch (err) {
        LogUtil.log("Failed to get Firebase app options", { errorMessage: ErrorUtil.getErrorMessage(err) }, "high", "error");
    }

    try {
        const cols = await db.listCollections();
        LogUtil.log("Firestore collections", { count: cols.length, names: cols.map(c => c.id) }, "high", "info");
    } catch (err) {
        LogUtil.log("Firestore listCollections failed", { errorMessage: ErrorUtil.getErrorMessage(err) }, "high", "error");
    }
}

function getAppOptionsObj(options: admin.AppOptions): any
{
    const result: any = {};
    if (!options)
        return "{}";

    if (options.projectId)
        result.projectId = options.projectId;
    if (options.storageBucket)
        result.storageBucket = options.storageBucket;
    if (options.databaseURL)
        result.databaseURL = options.databaseURL;
    if (options.serviceAccountId)
        result.serviceAccountId = options.serviceAccountId;
    if (options.databaseAuthVariableOverride !== undefined)
        result.databaseAuthVariableOverride = options.databaseAuthVariableOverride;
    if (options.httpAgent)
        result.httpAgent = { constructorName: (options.httpAgent as any).constructor?.name || "Agent" };

    if (options.credential)
    {
        const c: any = options.credential as any;
        const credInfo: any = { present: true };
        if (typeof c.getAccessToken === "function")
            credInfo.getAccessToken = true;
        if (c.projectId)
            credInfo.projectId = c.projectId;
        if (c.client_email)
            credInfo.clientEmail = c.client_email;
        if (c.private_key)
            credInfo.privateKey = "[REDACTED]";
        result.credential = credInfo;
    }

    return result;
}

export default FirebaseUtil;